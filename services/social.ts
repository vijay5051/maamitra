/**
 * Social platform Firestore service.
 *
 * Collections:
 *  communityPosts/{postId}                  — posts
 *  communityPosts/{postId}/comments/{id}    — comments subcollection
 *  follows/{myUid}_{toUid}                  — accepted follow relationships
 *  followRequests/{requestId}               — pending follow requests
 *  blocks/{myUid}_{targetUid}               — blocked relationships
 *  notifications/{uid}/items/{notifId}      — per-user notifications
 *  publicProfiles/{uid}                     — public profile data for community
 */

import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  increment,
  writeBatch,
  runTransaction,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  type DocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CommunityPost {
  id: string;
  authorUid: string;
  authorName: string;
  authorInitial: string;
  authorPhotoUrl?: string;                    // profile photo at post-creation time
  badge: string;
  topic: string;
  text: string;
  imageUri?: string;
  imageAspectRatio?: number;
  imageEmoji?: string;
  imageCaption?: string;
  reactions: Record<string, number>;          // { '❤️': 5 }
  reactionsByUser: Record<string, string[]>;  // { uid: ['❤️'] }
  commentCount: number;
  /** Snapshot: was author's "followers-only" setting on at post time? */
  authorFollowersOnly?: boolean;
  /** Set by an admin via hidePost(). Hidden posts are skipped in the feed. */
  hidden?: boolean;
  hiddenReason?: string;
  createdAt: Date;
}

export interface PostComment {
  id: string;
  authorUid: string;
  authorName: string;
  authorInitial: string;
  authorPhotoUrl?: string;                    // profile photo at comment-creation time
  text: string;
  createdAt: Date;
}

export interface FollowEntry {
  uid: string;
  name: string;
  photoUrl?: string;
  followedAt: Date;
}

export interface FollowRequest {
  id: string;
  fromUid: string;
  toUid: string;
  fromName: string;
  fromPhotoUrl?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
}

export type NotifType = 'reaction' | 'comment' | 'follow_request' | 'follow_accepted' | 'message' | 'moderation';

export interface AppNotification {
  id: string;
  type: NotifType;
  fromUid: string;
  fromName: string;
  fromPhotoUrl?: string;
  postId?: string;
  postText?: string;
  emoji?: string;
  requestId?: string;
  /** For follow_request notifs: tracks whether the user has acted on it.
   *  We retain the row in the feed after Accept/Decline (just stripped of
   *  the action buttons) so the user can see what happened — instead of
   *  silently deleting the notification, which used to confuse people. */
  requestStatus?: 'pending' | 'accepted' | 'declined';
  text?: string;
  commentId?: string;
  read: boolean;
  createdAt: Date;
}

export interface UserPublicProfile {
  uid: string;
  name: string;
  photoUrl?: string;
  bio?: string;
  expertise?: string[];
  state?: string;
  parentGender?: string;
  badge?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

export function firestoreDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  // Firestore Timestamp
  if (typeof val.toDate === 'function') return val.toDate();
  // ISO string or number
  return new Date(val);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

export async function incrementPublicProfilePostCount(uid: string, delta: number): Promise<void> {
  if (!db) return;
  try {
    const ref = doc(db, 'publicProfiles', uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, { postsCount: increment(delta) });
    } else {
      await setDoc(ref, { uid, postsCount: Math.max(0, delta), followersCount: 0, followingCount: 0 }, { merge: true });
    }
  } catch (error) {
    console.error('incrementPublicProfilePostCount error:', error);
  }
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export async function updatePost(
  postId: string,
  updates: { text?: string; topic?: string },
): Promise<void> {
  if (!db) return;
  try {
    const clean: Record<string, any> = {};
    if (typeof updates.text === 'string') clean.text = updates.text;
    if (typeof updates.topic === 'string') clean.topic = updates.topic;
    if (Object.keys(clean).length === 0) return;
    clean.editedAt = serverTimestamp();
    await updateDoc(doc(db, 'communityPosts', postId), clean);
  } catch (error) {
    console.error('updatePost error:', error);
    throw error;
  }
}

export async function deletePost(postId: string): Promise<void> {
  if (!db) return;
  // Phase 1: comments. Best-effort — if the subcollection read or batch fails
  // for any reason (rules, transient network, orphaned writes), we still
  // attempt phase 2 so the post itself goes away. Orphan comment docs are
  // unreachable once the parent is gone and can be swept later if needed.
  try {
    const commentsSnap = await getDocs(collection(db, 'communityPosts', postId, 'comments'));
    if (commentsSnap.docs.length > 0) {
      const batch = writeBatch(db);
      commentsSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (commentsErr) {
    console.warn(`deletePost(${postId}): comments cleanup failed, continuing with post delete`, commentsErr);
  }

  // Phase 2: the post itself. THIS is the one that must succeed — if it
  // fails, surface the error so the caller (admin UI) can show it.
  try {
    await deleteDoc(doc(db, 'communityPosts', postId));
  } catch (error) {
    console.error('deletePost error:', error);
    throw error;
  }
}

/**
 * Admin-only bulk cleanup: deletes every post authored by one of the listed
 * uids. Used to wipe the four demo personas (Priya/Ananya/Deepika/Meena)
 * that scripts/seed-demo-users.mjs wrote into communityPosts. Returns the
 * count of posts deleted plus any errors that didn't kill the loop.
 */
export async function deletePostsByAuthorUids(
  authorUids: string[],
): Promise<{ deleted: number; errors: { postId: string; error: string }[] }> {
  if (!db || authorUids.length === 0) return { deleted: 0, errors: [] };
  const errors: { postId: string; error: string }[] = [];
  let deleted = 0;
  // Page through ALL posts in chunks to find seeded ones. We can't `where()`
  // efficiently because authorUids may not be indexed (and the seed posts
  // could have been written before any composite index existed). Reading
  // 100 posts at a time is cheap enough for a one-off admin sweep.
  let lastDoc: DocumentSnapshot | null = null;
  const targetSet = new Set(authorUids);
  // Cap iterations to avoid infinite loops on bad data.
  for (let page = 0; page < 50; page++) {
    const q: any = lastDoc
      ? query(collection(db, 'communityPosts'), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(100))
      : query(collection(db, 'communityPosts'), orderBy('createdAt', 'desc'), limit(100));
    const snap: any = await getDocs(q);
    if (snap.empty) break;
    for (const d of snap.docs) {
      const data = d.data();
      if (!targetSet.has(data.authorUid)) continue;
      try {
        await deletePost(d.id);
        deleted += 1;
      } catch (err: any) {
        errors.push({ postId: d.id, error: err?.message ?? String(err) });
      }
    }
    if (snap.docs.length < 100) break;
    lastDoc = snap.docs[snap.docs.length - 1];
  }
  return { deleted, errors };
}

/**
 * Admin-only soft-hide. Doesn't touch the post text or author data — it
 * just sets hidden=true so feed queries skip it. The author gets a
 * moderation notification citing the reason. Replaces the previous "edit"
 * privilege so admins can't silently rewrite a user's words.
 */
export async function hidePost(
  postId: string,
  reason: string,
  admin: { uid: string; name: string; photoUrl?: string },
  authorUid: string,
  postText: string,
): Promise<void> {
  if (!db) return;
  try {
    await updateDoc(doc(db, 'communityPosts', postId), {
      hidden: true,
      hiddenAt: serverTimestamp(),
      hiddenReason: reason,
      hiddenBy: admin.uid,
    });
    if (authorUid && authorUid !== admin.uid) {
      await createNotification(authorUid, {
        type: 'moderation',
        fromUid: admin.uid,
        fromName: admin.name || 'MaaMitra Moderation',
        fromPhotoUrl: admin.photoUrl,
        postId,
        postText: postText.slice(0, 240),
        emoji: '🛡️',
      });
    }
  } catch (error) {
    console.error('hidePost error:', error);
    throw error;
  }
}

/** Admin: restore a previously-hidden post. */
export async function unhidePost(postId: string): Promise<void> {
  if (!db) return;
  try {
    await updateDoc(doc(db, 'communityPosts', postId), {
      hidden: false,
      hiddenAt: null,
      hiddenReason: null,
      hiddenBy: null,
    });
  } catch (error) {
    console.error('unhidePost error:', error);
    throw error;
  }
}

export async function deleteComment(postId: string, commentId: string): Promise<void> {
  if (!db) return;
  try {
    await deleteDoc(doc(db, 'communityPosts', postId, 'comments', commentId));
    // Atomic decrement — no read needed
    await updateDoc(doc(db, 'communityPosts', postId), { commentCount: increment(-1) });
  } catch (error) {
    console.error('deleteComment error:', error);
    throw error;
  }
}

export async function createPost(data: {
  authorUid: string;
  authorName: string;
  authorInitial: string;
  authorPhotoUrl?: string;
  badge: string;
  topic: string;
  text: string;
  imageUri?: string;
  imageAspectRatio?: number;
  imageEmoji?: string;
  imageCaption?: string;
  /** Snapshot of author's followers-only privacy setting at creation time */
  authorFollowersOnly?: boolean;
}): Promise<string> {
  if (!db) return '';
  try {
    const ref = await addDoc(collection(db, 'communityPosts'), {
      ...data,
      reactions: {},
      reactionsByUser: {},
      commentCount: 0,
      approved: true,
      createdAt: serverTimestamp(),
    });
    // fire and forget
    incrementPublicProfilePostCount(data.authorUid, 1);
    return ref.id;
  } catch (error) {
    console.error('createPost error:', error);
    return '';
  }
}

/** Page size used by the community feed for infinite scroll */
export const POSTS_PAGE_SIZE = 15;

export interface FetchPostsResult {
  posts: CommunityPost[];
  lastDoc: DocumentSnapshot | null;
}

export async function fetchRecentPosts(
  limitN = POSTS_PAGE_SIZE,
  afterDoc?: DocumentSnapshot | null,
  opts?: { includeHidden?: boolean },
): Promise<FetchPostsResult> {
  if (!db) return { posts: [], lastDoc: null };
  try {
    const col = collection(db, 'communityPosts');
    const q = afterDoc
      ? query(col, orderBy('createdAt', 'desc'), startAfter(afterDoc), limit(limitN))
      : query(col, orderBy('createdAt', 'desc'), limit(limitN));
    const snap = await getDocs(q);
    const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

    const includeHidden = !!opts?.includeHidden;
    const posts = snap.docs
      // Skip moderator-hidden posts in the public feed. Admin paths pass
      // includeHidden=true so the moderation queue can still show them.
      .filter((d) => includeHidden || d.data().hidden !== true)
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          authorUid: data.authorUid ?? '',
          authorName: data.authorName ?? '',
          authorInitial: data.authorInitial ?? '',
          authorPhotoUrl: data.authorPhotoUrl ?? undefined,
          badge: data.badge ?? '',
          topic: data.topic ?? '',
          text: data.text ?? '',
          imageUri: data.imageUri,
          imageAspectRatio: data.imageAspectRatio,
          imageEmoji: data.imageEmoji,
          imageCaption: data.imageCaption,
          reactions: data.reactions ?? {},
          reactionsByUser: data.reactionsByUser ?? {},
          commentCount: data.commentCount ?? 0,
          authorFollowersOnly: data.authorFollowersOnly ?? false,
          hidden: data.hidden === true,
          hiddenReason: data.hiddenReason ?? '',
          createdAt: firestoreDate(data.createdAt),
        } as CommunityPost;
      });

    return { posts, lastDoc };
  } catch (error) {
    console.error('fetchRecentPosts error:', error);
    return { posts: [], lastDoc: null };
  }
}

/**
 * Fetch a single community post by id. Powers the public share route
 * (/post/[id]) which shows a single post to any signed-in user so they can
 * share a direct link from the app. Returns null if the post doesn't exist
 * or Firestore throws.
 */
export async function fetchPostById(postId: string): Promise<CommunityPost | null> {
  if (!db || !postId) return null;
  try {
    const ref = doc(db, 'communityPosts', postId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    const createdAt = data.createdAt?.toDate
      ? data.createdAt.toDate()
      : data.createdAt instanceof Date
      ? data.createdAt
      : new Date();
    return {
      id: snap.id,
      authorUid: data.authorUid ?? '',
      authorName: data.authorName ?? '',
      authorInitial: data.authorInitial ?? '',
      authorPhotoUrl: data.authorPhotoUrl ?? undefined,
      badge: data.badge ?? '',
      topic: data.topic ?? '',
      text: data.text ?? '',
      imageUri: data.imageUri,
      imageAspectRatio: data.imageAspectRatio,
      imageEmoji: data.imageEmoji,
      imageCaption: data.imageCaption,
      reactions: data.reactions ?? {},
      reactionsByUser: data.reactionsByUser ?? {},
      commentCount: data.commentCount ?? 0,
      authorFollowersOnly: !!data.authorFollowersOnly,
      createdAt,
    } as CommunityPost;
  } catch (err) {
    console.error('fetchPostById error:', err);
    return null;
  }
}

export async function fetchUserPosts(uid: string): Promise<CommunityPost[]> {
  if (!db) return [];
  try {
    // Try with ordering first (requires composite index on authorUid + createdAt).
    // Fall back to unordered query if index isn't ready, then sort client-side.
    let snap;
    try {
      snap = await getDocs(query(
        collection(db, 'communityPosts'),
        where('authorUid', '==', uid),
        orderBy('createdAt', 'desc'),
      ));
    } catch {
      snap = await getDocs(query(
        collection(db, 'communityPosts'),
        where('authorUid', '==', uid),
      ));
    }
    const results = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        authorUid: data.authorUid ?? '',
        authorName: data.authorName ?? '',
        authorInitial: data.authorInitial ?? '',
        authorPhotoUrl: data.authorPhotoUrl ?? undefined,
        badge: data.badge ?? '',
        topic: data.topic ?? '',
        text: data.text ?? '',
        imageUri: data.imageUri,
        imageAspectRatio: data.imageAspectRatio,
        imageEmoji: data.imageEmoji,
        imageCaption: data.imageCaption,
        reactions: data.reactions ?? {},
        reactionsByUser: data.reactionsByUser ?? {},
        commentCount: data.commentCount ?? 0,
        authorFollowersOnly: data.authorFollowersOnly ?? false,
        createdAt: firestoreDate(data.createdAt),
      } as CommunityPost;
    });
    // Client-side sort (always correct, handles fallback path too)
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return results;
  } catch (error) {
    console.error('fetchUserPosts error:', error);
    return [];
  }
}

export async function togglePostReaction(
  postId: string,
  myUid: string,
  myName: string,
  emoji: string,
): Promise<{ reactions: Record<string, number>; myReactions: string[] }> {
  if (!db) return { reactions: {}, myReactions: [] };
  try {
    const postRef = doc(db, 'communityPosts', postId);

    // Use a transaction so concurrent reactions don't overwrite each other
    const result = await runTransaction(db, async (tx) => {
      const snap = await tx.get(postRef);
      if (!snap.exists()) return { reactions: {} as Record<string, number>, myReactions: [] as string[], authorUid: '', text: '' };

      const data = snap.data();
      const reactions: Record<string, number> = { ...(data.reactions ?? {}) };
      const reactionsByUser: Record<string, string[]> = { ...(data.reactionsByUser ?? {}) };
      const myReactionsList: string[] = reactionsByUser[myUid] ? [...reactionsByUser[myUid]] : [];

      const alreadyReacted = myReactionsList.includes(emoji);

      if (alreadyReacted) {
        reactions[emoji] = Math.max(0, (reactions[emoji] ?? 1) - 1);
        if (reactions[emoji] === 0) delete reactions[emoji];
        reactionsByUser[myUid] = myReactionsList.filter((e) => e !== emoji);
      } else {
        reactions[emoji] = (reactions[emoji] ?? 0) + 1;
        reactionsByUser[myUid] = [...myReactionsList, emoji];
      }

      tx.update(postRef, { reactions, reactionsByUser });
      return {
        reactions,
        myReactions: reactionsByUser[myUid] ?? [],
        authorUid: data.authorUid ?? '',
        text: data.text ?? '',
      };
    });

    // Notification stays outside the transaction (fire-and-forget)
    if (result.authorUid && myUid !== result.authorUid && result.myReactions.includes(emoji)) {
      createNotification(result.authorUid, {
        type: 'reaction',
        fromUid: myUid,
        fromName: myName,
        postId,
        postText: result.text.slice(0, 60),
        emoji,
      });
    }

    return { reactions: result.reactions, myReactions: result.myReactions };
  } catch (error) {
    console.error('togglePostReaction error:', error);
    return { reactions: {}, myReactions: [] };
  }
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function addPostComment(
  postId: string,
  data: {
    authorUid: string;
    authorName: string;
    authorInitial: string;
    authorPhotoUrl?: string;
    text: string;
  },
  postAuthorUid: string,
  myName: string,
): Promise<PostComment> {
  if (!db) {
    return {
      id: '',
      authorUid: data.authorUid,
      authorName: data.authorName,
      authorInitial: data.authorInitial,
      authorPhotoUrl: data.authorPhotoUrl,
      text: data.text,
      createdAt: new Date(),
    };
  }
  try {
    // Prevent commenting if either user has blocked the other
    if (postAuthorUid && data.authorUid !== postAuthorUid) {
      if (await isEitherBlocked(data.authorUid, postAuthorUid)) {
        throw new Error('blocked');
      }
    }

    const commentsRef = collection(db, 'communityPosts', postId, 'comments');
    const ref = await addDoc(commentsRef, {
      ...data,
      createdAt: serverTimestamp(),
    });

    // increment commentCount on parent post
    await updateDoc(doc(db, 'communityPosts', postId), { commentCount: increment(1) });

    // notify post author
    if (data.authorUid !== postAuthorUid) {
      // get post text for notification
      const postSnap = await getDoc(doc(db, 'communityPosts', postId));
      const postText = postSnap.exists() ? (postSnap.data().text ?? '').slice(0, 60) : '';
      createNotification(postAuthorUid, {
        type: 'comment',
        fromUid: data.authorUid,
        fromName: data.authorName,
        postId,
        postText,
      });
    }

    return {
      id: ref.id,
      authorUid: data.authorUid,
      authorName: data.authorName,
      authorInitial: data.authorInitial,
      authorPhotoUrl: data.authorPhotoUrl,
      text: data.text,
      createdAt: new Date(),
    };
  } catch (error) {
    console.error('addPostComment error:', error);
    return {
      id: '',
      authorUid: data.authorUid,
      authorName: data.authorName,
      authorInitial: data.authorInitial,
      authorPhotoUrl: data.authorPhotoUrl,
      text: data.text,
      createdAt: new Date(),
    };
  }
}

export async function fetchPostComments(postId: string): Promise<PostComment[]> {
  if (!db) return [];
  try {
    const q = query(
      collection(db, 'communityPosts', postId, 'comments'),
      orderBy('createdAt', 'asc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        authorUid: data.authorUid ?? '',
        authorName: data.authorName ?? '',
        authorInitial: data.authorInitial ?? '',
        authorPhotoUrl: data.authorPhotoUrl ?? undefined,
        text: data.text ?? '',
        createdAt: firestoreDate(data.createdAt),
      } as PostComment;
    });
  } catch (error) {
    console.error('fetchPostComments error:', error);
    return [];
  }
}

// ─── Block check helper ──────────────────────────────────────────────────────

/** Returns true if either user has blocked the other */
export async function isEitherBlocked(uid1: string, uid2: string): Promise<boolean> {
  if (!db) return false;
  try {
    const [a, b] = await Promise.all([
      getDoc(doc(db, 'blocks', `${uid1}_${uid2}`)),
      getDoc(doc(db, 'blocks', `${uid2}_${uid1}`)),
    ]);
    return a.exists() || b.exists();
  } catch { return false; }
}

// ─── Follow System ────────────────────────────────────────────────────────────

export async function sendFollowRequest(
  myUid: string,
  myName: string,
  myPhotoUrl: string,
  toUid: string,
  toName: string,
): Promise<string> {
  if (!db) return '';
  try {
    // Check if either user has blocked the other
    if (await isEitherBlocked(myUid, toUid)) throw new Error('blocked');

    // Check if already following
    const followSnap = await getDoc(doc(db, 'follows', `${myUid}_${toUid}`));
    if (followSnap.exists()) throw new Error('already_following');

    // Check if request pending
    const pendingQ = query(
      collection(db, 'followRequests'),
      where('fromUid', '==', myUid),
      where('toUid', '==', toUid),
      where('status', '==', 'pending'),
    );
    const pendingSnap = await getDocs(pendingQ);
    if (!pendingSnap.empty) throw new Error('request_pending');

    const ref = await addDoc(collection(db, 'followRequests'), {
      fromUid: myUid,
      toUid,
      fromName: myName,
      fromPhotoUrl: myPhotoUrl,
      status: 'pending',
      createdAt: serverTimestamp(),
    });

    // notify target user
    createNotification(toUid, {
      type: 'follow_request',
      fromUid: myUid,
      fromName: myName,
      fromPhotoUrl: myPhotoUrl,
      requestId: ref.id,
    });

    return ref.id;
  } catch (error) {
    console.error('sendFollowRequest error:', error);
    throw error;
  }
}

export async function acceptFollowRequest(
  requestId: string,
  fromUid: string,
  fromName: string,
  fromPhotoUrl: string,
  toUid: string,
  toName: string,
  toPhotoUrl: string,
): Promise<void> {
  if (!db) return;
  try {
    // Atomic batch: accept request + create follow + update counts
    const batch = writeBatch(db);
    const toRef = doc(db, 'publicProfiles', toUid);
    const fromRef = doc(db, 'publicProfiles', fromUid);

    batch.update(doc(db, 'followRequests', requestId), { status: 'accepted' });
    batch.set(doc(db, 'follows', `${fromUid}_${toUid}`), {
      fromUid, toUid, fromName, toName, fromPhotoUrl, toPhotoUrl,
      createdAt: serverTimestamp(),
    });
    // Use set-merge so profiles are created if missing, incremented if existing
    batch.set(toRef, { uid: toUid, followersCount: increment(1) }, { merge: true });
    batch.set(fromRef, { uid: fromUid, followingCount: increment(1) }, { merge: true });

    await batch.commit();

    // notify fromUid that request was accepted
    createNotification(fromUid, {
      type: 'follow_accepted',
      fromUid: toUid,
      fromName: toName,
      fromPhotoUrl: toPhotoUrl,
      requestId,
    });
  } catch (error) {
    console.error('acceptFollowRequest error:', error);
  }
}

export async function declineFollowRequest(requestId: string): Promise<void> {
  if (!db) return;
  try {
    await updateDoc(doc(db, 'followRequests', requestId), { status: 'declined' });
  } catch (error) {
    console.error('declineFollowRequest error:', error);
  }
}

export async function cancelFollowRequest(
  requestId: string,
  myUid: string,
  toUid: string,
): Promise<void> {
  if (!db) return;
  try {
    await deleteDoc(doc(db, 'followRequests', requestId));
  } catch (error) {
    console.error('cancelFollowRequest error:', error);
  }
}

export async function unfollowUser(myUid: string, targetUid: string): Promise<void> {
  if (!db) return;
  try {
    // Atomic batch: delete follow + decrement both profiles' counts
    const batch = writeBatch(db);
    batch.delete(doc(db, 'follows', `${myUid}_${targetUid}`));
    batch.set(doc(db, 'publicProfiles', targetUid), { followersCount: increment(-1) }, { merge: true });
    batch.set(doc(db, 'publicProfiles', myUid), { followingCount: increment(-1) }, { merge: true });
    await batch.commit();
  } catch (error) {
    console.error('unfollowUser error:', error);
  }
}

export async function getFollowers(uid: string): Promise<FollowEntry[]> {
  if (!db) return [];
  try {
    const q = query(collection(db, 'follows'), where('toUid', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        uid: data.fromUid,
        name: data.fromName,
        photoUrl: data.fromPhotoUrl,
        followedAt: firestoreDate(data.createdAt),
      } as FollowEntry;
    });
  } catch (error) {
    console.error('getFollowers error:', error);
    return [];
  }
}

export async function getFollowing(uid: string): Promise<FollowEntry[]> {
  if (!db) return [];
  try {
    const q = query(collection(db, 'follows'), where('fromUid', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        uid: data.toUid,
        name: data.toName,
        photoUrl: data.toPhotoUrl,
        followedAt: firestoreDate(data.createdAt),
      } as FollowEntry;
    });
  } catch (error) {
    console.error('getFollowing error:', error);
    return [];
  }
}

export async function getFollowStatus(
  myUid: string,
  targetUid: string,
): Promise<'none' | 'pending_outgoing' | 'following'> {
  if (!db) return 'none';
  try {
    const followSnap = await getDoc(doc(db, 'follows', `${myUid}_${targetUid}`));
    if (followSnap.exists()) return 'following';

    const pendingQ = query(
      collection(db, 'followRequests'),
      where('fromUid', '==', myUid),
      where('toUid', '==', targetUid),
      where('status', '==', 'pending'),
    );
    const pendingSnap = await getDocs(pendingQ);
    if (!pendingSnap.empty) return 'pending_outgoing';

    return 'none';
  } catch (error) {
    console.error('getFollowStatus error:', error);
    return 'none';
  }
}

export async function getIncomingFollowRequests(uid: string): Promise<FollowRequest[]> {
  if (!db) return [];
  try {
    const q = query(
      collection(db, 'followRequests'),
      where('toUid', '==', uid),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        fromUid: data.fromUid,
        toUid: data.toUid,
        fromName: data.fromName,
        fromPhotoUrl: data.fromPhotoUrl,
        status: data.status,
        createdAt: firestoreDate(data.createdAt),
      } as FollowRequest;
    });
  } catch (error) {
    console.error('getIncomingFollowRequests error:', error);
    return [];
  }
}

export async function getOutgoingFollowRequests(uid: string): Promise<FollowRequest[]> {
  if (!db) return [];
  try {
    const q = query(
      collection(db, 'followRequests'),
      where('fromUid', '==', uid),
      where('status', '==', 'pending'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        fromUid: data.fromUid,
        toUid: data.toUid,
        fromName: data.fromName,
        fromPhotoUrl: data.fromPhotoUrl,
        status: data.status,
        createdAt: firestoreDate(data.createdAt),
      } as FollowRequest;
    });
  } catch (error) {
    console.error('getOutgoingFollowRequests error:', error);
    return [];
  }
}

// ─── Blocks ───────────────────────────────────────────────────────────────────

export async function blockUser(myUid: string, targetUid: string): Promise<void> {
  if (!db) return;
  try {
    await setDoc(doc(db, 'blocks', `${myUid}_${targetUid}`), {
      blockerUid: myUid,
      blockedUid: targetUid,
      createdAt: serverTimestamp(),
    });

    // also update blockedUids array in publicProfile
    await setDoc(doc(db, 'publicProfiles', myUid), { blockedUids: arrayUnion(targetUid) }, { merge: true });

    // Remove both follow directions and decrement publicProfile counts
    const myFollowsTarget = await getDoc(doc(db, 'follows', `${myUid}_${targetUid}`));
    const targetFollowsMe = await getDoc(doc(db, 'follows', `${targetUid}_${myUid}`));

    if (myFollowsTarget.exists()) {
      await deleteDoc(doc(db, 'follows', `${myUid}_${targetUid}`));
      // I was following them: decrement my followingCount, their followersCount
      try { await updateDoc(doc(db, 'publicProfiles', myUid), { followingCount: increment(-1) }); } catch (_) {}
      try { await updateDoc(doc(db, 'publicProfiles', targetUid), { followersCount: increment(-1) }); } catch (_) {}
    }

    if (targetFollowsMe.exists()) {
      await deleteDoc(doc(db, 'follows', `${targetUid}_${myUid}`));
      // They were following me: decrement their followingCount, my followersCount
      try { await updateDoc(doc(db, 'publicProfiles', targetUid), { followingCount: increment(-1) }); } catch (_) {}
      try { await updateDoc(doc(db, 'publicProfiles', myUid), { followersCount: increment(-1) }); } catch (_) {}
    }
  } catch (error) {
    console.error('blockUser error:', error);
  }
}

export async function unblockUser(myUid: string, targetUid: string): Promise<void> {
  if (!db) return;
  try {
    await deleteDoc(doc(db, 'blocks', `${myUid}_${targetUid}`));
    await updateDoc(doc(db, 'publicProfiles', myUid), { blockedUids: arrayRemove(targetUid) });
  } catch (error) {
    console.error('unblockUser error:', error);
  }
}

export async function isBlockedBy(myUid: string, targetUid: string): Promise<boolean> {
  if (!db) return false;
  try {
    const snap = await getDoc(doc(db, 'blocks', `${targetUid}_${myUid}`));
    return snap.exists();
  } catch (error) {
    console.error('isBlockedBy error:', error);
    return false;
  }
}

export async function getBlockedUsers(uid: string): Promise<string[]> {
  if (!db) return [];
  try {
    const snap = await getDoc(doc(db, 'publicProfiles', uid));
    if (!snap.exists()) return [];
    return (snap.data().blockedUids as string[]) ?? [];
  } catch (error) {
    console.error('getBlockedUsers error:', error);
    return [];
  }
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function createNotification(
  toUid: string,
  data: {
    type: NotifType;
    fromUid: string;
    fromName: string;
    fromPhotoUrl?: string;
    postId?: string;
    postText?: string;
    emoji?: string;
    requestId?: string;
  },
): Promise<void> {
  if (!db) return;
  if (toUid === data.fromUid) return;
  try {
    await addDoc(collection(db, 'notifications', toUid, 'items'), {
      ...data,
      read: false,
      createdAt: serverTimestamp(),
    });
    // Also enqueue a push job. The dispatcher (Cloud Function / worker
    // subscribed to push_queue) reads this, looks up the recipient's
    // fcmTokens + per-topic prefs, and fires FCM. Fire-and-forget — if
    // the write fails (rules or network) the in-app notification is
    // still delivered.
    const push = buildPushFromNotif(toUid, data);
    if (push) {
      try {
        await addDoc(collection(db, 'push_queue'), {
          kind: 'personal',
          toUid,
          fromUid: data.fromUid,
          // The dispatcher uses notifType to decide which of the user's
          // per-topic prefs to check (reactions/comments/dms/follows).
          notifType: data.type,
          ...push,
          status: 'pending',
          createdAt: serverTimestamp(),
        });
      } catch (_) {
        // Non-blocking — silent fail is fine here, in-app UI already works.
      }
    }
  } catch (error) {
    console.error('createNotification error:', error);
  }
}

/**
 * Map an in-app notification to the (title, body, data) payload the
 * push dispatcher will send. Returns null for types we'd rather not
 * push (keeps the notification tray quieter). data.url tells the SW
 * where to route the user on click.
 */
function buildPushFromNotif(
  _toUid: string,
  d: {
    type: NotifType;
    fromName: string;
    postId?: string;
    postText?: string;
    emoji?: string;
  },
): { title: string; body: string; data: Record<string, string> } | null {
  const snippet = (d.postText ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
  const tail = (d.postText ?? '').length > 80 ? '…' : '';
  switch (d.type) {
    case 'reaction':
      return {
        title: `${d.fromName} reacted ${d.emoji ?? '❤️'}`,
        body: snippet ? `on your post: "${snippet}${tail}"` : 'on your post',
        data: { url: d.postId ? `/post/${d.postId}` : '/(tabs)/community', tag: `reaction:${d.postId ?? ''}` },
      };
    case 'comment':
      return {
        title: `${d.fromName} commented`,
        body: snippet ? `on your post: "${snippet}${tail}"` : 'on your post',
        data: { url: d.postId ? `/post/${d.postId}` : '/(tabs)/community', tag: `comment:${d.postId ?? ''}` },
      };
    case 'follow_request':
      return {
        title: `${d.fromName} wants to follow you`,
        body: 'Tap to review the request.',
        data: { url: '/(tabs)/community', tag: 'follow-request' },
      };
    case 'follow_accepted':
      return {
        title: `${d.fromName} accepted your follow`,
        body: 'You can now see their posts in your feed.',
        data: { url: '/(tabs)/community', tag: 'follow-accepted' },
      };
    case 'message':
      return {
        title: `${d.fromName} sent you a message`,
        body: 'Open MaaMitra to reply.',
        data: { url: '/(tabs)/community', tag: 'message' },
      };
    default:
      return null;
  }
}

export async function getNotifications(uid: string, limitN = 40): Promise<AppNotification[]> {
  if (!db) return [];
  try {
    const q = query(
      collection(db, 'notifications', uid, 'items'),
      orderBy('createdAt', 'desc'),
      limit(limitN),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        type: data.type,
        fromUid: data.fromUid ?? '',
        fromName: data.fromName ?? '',
        fromPhotoUrl: data.fromPhotoUrl,
        postId: data.postId,
        postText: data.postText,
        emoji: data.emoji,
        requestId: data.requestId,
        requestStatus: data.requestStatus,
        text: data.text,
        commentId: data.commentId,
        read: data.read ?? false,
        createdAt: firestoreDate(data.createdAt),
      } as AppNotification;
    });
  } catch (error) {
    console.error('getNotifications error:', error);
    return [];
  }
}

export async function markNotificationRead(uid: string, notifId: string): Promise<void> {
  if (!db) return;
  try {
    await updateDoc(doc(db, 'notifications', uid, 'items', notifId), { read: true });
  } catch (error) {
    console.error('markNotificationRead error:', error);
  }
}

/**
 * Mark a follow-request notification with the action the user took
 * (accepted or declined). Replaces the old "delete on action" flow —
 * we now keep the row in the feed so the user can see the outcome
 * instead of having it silently disappear.
 */
export async function markNotificationRequestStatus(
  uid: string,
  notifIds: string[],
  status: 'accepted' | 'declined',
): Promise<void> {
  if (!db || notifIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    notifIds.forEach((id) => {
      batch.update(doc(db!, 'notifications', uid, 'items', id), {
        requestStatus: status,
        read: true,
      });
    });
    await batch.commit();
  } catch (error) {
    console.error('markNotificationRequestStatus error:', error);
  }
}

/**
 * Delete a single notification document. Used after the user has actioned
 * an actionable notification (e.g. accepted/declined a follow request) so
 * it doesn't reappear on next open. Non-actionable notifications (reactions,
 * comments) stay in the feed and are just marked read.
 */
export async function deleteNotification(uid: string, notifId: string): Promise<void> {
  if (!db) return;
  try {
    await deleteDoc(doc(db, 'notifications', uid, 'items', notifId));
  } catch (error) {
    console.error('deleteNotification error:', error);
  }
}

/**
 * Delete multiple notifications in one batch. Used after accept/decline
 * to wipe the follow_request entry so it doesn't reappear across sessions.
 */
export async function deleteNotifications(uid: string, notifIds: string[]): Promise<void> {
  if (!db || notifIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    notifIds.forEach((id) => {
      batch.delete(doc(db!, 'notifications', uid, 'items', id));
    });
    await batch.commit();
  } catch (error) {
    console.error('deleteNotifications error:', error);
  }
}

export async function markAllNotificationsRead(uid: string): Promise<void> {
  if (!db) return;
  try {
    const q = query(
      collection(db, 'notifications', uid, 'items'),
      where('read', '==', false),
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => {
      batch.update(d.ref, { read: true });
    });
    await batch.commit();
  } catch (error) {
    console.error('markAllNotificationsRead error:', error);
  }
}

export async function getUnreadCount(uid: string): Promise<number> {
  if (!db) return 0;
  try {
    const q = query(
      collection(db, 'notifications', uid, 'items'),
      where('read', '==', false),
    );
    const snap = await getDocs(q);
    return snap.size;
  } catch (error) {
    console.error('getUnreadCount error:', error);
    return 0;
  }
}

// ─── Public Profiles ──────────────────────────────────────────────────────────

export async function upsertPublicProfile(uid: string, data: Partial<UserPublicProfile>): Promise<void> {
  if (!db) return;
  try {
    // Mirror `name` into a lowercased `nameLower` so searchPublicProfiles
    // can do a case-insensitive prefix range query without full-text search.
    const withLower: Record<string, any> = { ...data, updatedAt: serverTimestamp() };
    if (typeof data.name === 'string') {
      withLower.nameLower = data.name.trim().toLowerCase();
    }
    await setDoc(
      doc(db, 'publicProfiles', uid),
      withLower,
      { merge: true },
    );
  } catch (error) {
    console.error('upsertPublicProfile error:', error);
  }
}

export async function getPublicProfile(uid: string): Promise<UserPublicProfile | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'publicProfiles', uid));
    if (!snap.exists()) return null;
    return snap.data() as UserPublicProfile;
  } catch (error) {
    console.error('getPublicProfile error:', error);
    return null;
  }
}

/**
 * Cheap count of public profiles in a given state. We cap the read at 50
 * so a very popular state doesn't scan the whole collection — for the
 * Home "Moms near you" card we only need "N moms in your state" where
 * showing "50+" is fine. Returns 0 on error so the UI silently hides.
 */
export async function countProfilesInState(
  state: string,
  excludeUid?: string,
  cap: number = 50,
): Promise<number> {
  if (!db || !state) return 0;
  try {
    const col = collection(db, 'publicProfiles');
    const q = query(col, where('state', '==', state), limit(cap));
    const snap = await getDocs(q);
    return snap.docs.filter((d) => (excludeUid ? d.id !== excludeUid : true)).length;
  } catch (error) {
    console.warn('countProfilesInState error:', error);
    return 0;
  }
}

/**
 * Fetch multiple public profiles in one shot. Keeps reads cheap when a list
 * view (e.g. reactors, followers) needs to render 5–50 user cards.
 * Falls back to one-by-one getDoc if the uid list is long — Firestore's
 * `in` operator only accepts 30 values per query, so we chunk above that.
 */
export async function getPublicProfiles(uids: string[]): Promise<UserPublicProfile[]> {
  if (!db || uids.length === 0) return [];
  try {
    const unique = Array.from(new Set(uids));
    // Parallel single reads — avoids the 30-item `in` cap and is simple.
    const snaps = await Promise.all(unique.map((uid) => getDoc(doc(db!, 'publicProfiles', uid))));
    return snaps
      .filter((s) => s.exists())
      .map((s) => s.data() as UserPublicProfile);
  } catch (error) {
    console.error('getPublicProfiles error:', error);
    return [];
  }
}

/**
 * Case-insensitive "starts with" search over the publicProfiles collection
 * by name. Firestore doesn't support true full-text or case-insensitive
 * search, so we store a lowercased mirror field `nameLower` when the
 * profile is upserted, then use a range query against it.
 *
 * Results are capped at 30. Blocked users filter happens client-side via
 * `excludeUids` so we don't need a composite index.
 */
export async function searchPublicProfiles(
  queryText: string,
  excludeUids: string[] = []
): Promise<UserPublicProfile[]> {
  if (!db) return [];
  const raw = queryText.trim().toLowerCase();
  if (!raw) return [];
  try {
    const col = collection(db, 'publicProfiles');
    // Prefix range: all names that start with `raw`.
    const q = query(
      col,
      orderBy('nameLower'),
      where('nameLower', '>=', raw),
      where('nameLower', '<', raw + '\uf8ff'),
      limit(30)
    );
    const snap = await getDocs(q);
    const excluded = new Set(excludeUids);
    return snap.docs
      .map((d) => d.data() as UserPublicProfile)
      .filter((p) => !excluded.has(p.uid));
  } catch (error) {
    // Missing `nameLower` field on older profiles: fall back to an un-sorted
    // `name` prefix scan, which works for users whose display name happens
    // to already be lowercase or match exact case. Not ideal, but safer than
    // crashing the UI when the collection is mid-migration.
    console.warn('searchPublicProfiles primary query failed, falling back:', error);
    try {
      const col = collection(db, 'publicProfiles');
      const q2 = query(col, orderBy('name'), limit(100));
      const snap = await getDocs(q2);
      const excluded = new Set(excludeUids);
      return snap.docs
        .map((d) => d.data() as UserPublicProfile)
        .filter((p) => !excluded.has(p.uid))
        .filter((p) => (p.name || '').toLowerCase().startsWith(raw))
        .slice(0, 30);
    } catch (fallbackErr) {
      console.error('searchPublicProfiles fallback also failed:', fallbackErr);
      return [];
    }
  }
}

// ─── Reactor list ────────────────────────────────────────────────────────────
// Post docs already store `reactionsByUser: Record<uid, emoji[]>`. We don't
// need another Firestore read to know WHO reacted — we just need to resolve
// each uid to their public profile for name/photo.

export interface ReactorEntry {
  uid: string;
  emojis: string[];
  profile: UserPublicProfile | null;
}

/**
 * Given a post, return the list of users who have reacted (any emoji),
 * each with their public profile joined in. If `emojiFilter` is set, only
 * includes users who reacted with that specific emoji.
 */
export async function fetchPostReactors(
  post: CommunityPost,
  emojiFilter?: string
): Promise<ReactorEntry[]> {
  const byUser = (post as any).reactionsByUser as Record<string, string[]> | undefined;
  if (!byUser) return [];
  const entries = Object.entries(byUser)
    .map(([uid, emojis]) => ({ uid, emojis: emojis || [] }))
    .filter((e) => e.emojis.length > 0)
    .filter((e) => !emojiFilter || e.emojis.includes(emojiFilter));
  if (entries.length === 0) return [];
  const profiles = await getPublicProfiles(entries.map((e) => e.uid));
  const byUid = new Map(profiles.map((p) => [p.uid, p]));
  return entries.map((e) => ({
    uid: e.uid,
    emojis: e.emojis,
    profile: byUid.get(e.uid) ?? null,
  }));
}

// ─── Real-time subscriptions ─────────────────────────────────────────────────
// Instagram/Facebook-level UX needs live updates: when target accepts your
// follow request, your button flips from "Requested" to "Following" without
// the user lifting a finger. Each helper below returns an Unsubscribe the
// store cleans up on sign-out or uid change.

export function subscribeNotifications(
  uid: string,
  cb: (items: AppNotification[]) => void,
): Unsubscribe | null {
  if (!db) return null;
  const q = query(
    collection(db, 'notifications', uid, 'items'),
    orderBy('createdAt', 'desc'),
    limit(60),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          type: data.type,
          fromUid: data.fromUid,
          fromName: data.fromName,
          fromPhotoUrl: data.fromPhotoUrl,
          postId: data.postId,
          postText: data.postText,
          commentId: data.commentId,
          text: data.text,
          emoji: data.emoji,
          requestId: data.requestId,
          requestStatus: data.requestStatus,
          createdAt: firestoreDate(data.createdAt),
          read: data.read === true,
        } as AppNotification;
      });
      cb(items);
    },
    (err) => {
      console.warn('subscribeNotifications error:', err);
    },
  );
}

export function subscribeFollowers(
  uid: string,
  cb: (items: FollowEntry[]) => void,
): Unsubscribe | null {
  if (!db) return null;
  const q = query(collection(db, 'follows'), where('toUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      cb(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            uid: data.fromUid,
            name: data.fromName,
            photoUrl: data.fromPhotoUrl,
            followedAt: firestoreDate(data.createdAt),
          } as FollowEntry;
        }),
      );
    },
    (err) => console.warn('subscribeFollowers error:', err),
  );
}

export function subscribeFollowing(
  uid: string,
  cb: (items: FollowEntry[]) => void,
): Unsubscribe | null {
  if (!db) return null;
  const q = query(collection(db, 'follows'), where('fromUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      cb(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            uid: data.toUid,
            name: data.toName,
            photoUrl: data.toPhotoUrl,
            followedAt: firestoreDate(data.createdAt),
          } as FollowEntry;
        }),
      );
    },
    (err) => console.warn('subscribeFollowing error:', err),
  );
}

export function subscribeIncomingRequests(
  uid: string,
  cb: (items: FollowRequest[]) => void,
): Unsubscribe | null {
  if (!db) return null;
  // We deliberately do NOT filter on status==pending in the query so we
  // only need a single-field index. Filter on the client.
  const q = query(collection(db, 'followRequests'), where('toUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      cb(
        snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              fromUid: data.fromUid,
              fromName: data.fromName,
              fromPhotoUrl: data.fromPhotoUrl,
              toUid: data.toUid,
              status: data.status ?? 'pending',
              createdAt: firestoreDate(data.createdAt),
            } as FollowRequest;
          })
          .filter((r) => r.status === 'pending'),
      );
    },
    (err) => console.warn('subscribeIncomingRequests error:', err),
  );
}

export function subscribeOutgoingRequests(
  uid: string,
  cb: (items: FollowRequest[]) => void,
): Unsubscribe | null {
  if (!db) return null;
  const q = query(collection(db, 'followRequests'), where('fromUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      cb(
        snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              fromUid: data.fromUid,
              fromName: data.fromName,
              fromPhotoUrl: data.fromPhotoUrl,
              toUid: data.toUid,
              status: data.status ?? 'pending',
              createdAt: firestoreDate(data.createdAt),
            } as FollowRequest;
          })
          .filter((r) => r.status === 'pending'),
      );
    },
    (err) => console.warn('subscribeOutgoingRequests error:', err),
  );
}
