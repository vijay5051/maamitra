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
  type DocumentSnapshot,
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

export type NotifType = 'reaction' | 'comment' | 'follow_request' | 'follow_accepted' | 'message';

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
  try {
    // Delete all comments in the subcollection first
    const commentsSnap = await getDocs(collection(db, 'communityPosts', postId, 'comments'));
    const batch = writeBatch(db);
    commentsSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, 'communityPosts', postId));
    await batch.commit();
  } catch (error) {
    console.error('deletePost error:', error);
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
): Promise<FetchPostsResult> {
  if (!db) return { posts: [], lastDoc: null };
  try {
    const col = collection(db, 'communityPosts');
    const q = afterDoc
      ? query(col, orderBy('createdAt', 'desc'), startAfter(afterDoc), limit(limitN))
      : query(col, orderBy('createdAt', 'desc'), limit(limitN));
    const snap = await getDocs(q);
    const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

    const posts = snap.docs.map((d) => {
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
        createdAt: firestoreDate(data.createdAt),
      } as CommunityPost;
    });

    return { posts, lastDoc };
  } catch (error) {
    console.error('fetchRecentPosts error:', error);
    return { posts: [], lastDoc: null };
  }
}

export async function fetchUserPosts(uid: string): Promise<CommunityPost[]> {
  if (!db) return [];
  try {
    // where(authorUid) + orderBy(createdAt) requires a composite index;
    // drop the approved filter — all posts are approved:true at write time.
    const q = query(
      collection(db, 'communityPosts'),
      where('authorUid', '==', uid),
      orderBy('createdAt', 'desc'),
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
        createdAt: firestoreDate(data.createdAt),
      } as CommunityPost;
    });
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
  } catch (error) {
    console.error('createNotification error:', error);
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
    await setDoc(
      doc(db, 'publicProfiles', uid),
      { ...data, updatedAt: serverTimestamp() },
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
