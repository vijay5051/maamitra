import { create } from 'zustand';
import type { PostComment } from '../services/social';
import {
  fetchRecentPosts,
  POSTS_PAGE_SIZE,
  createPost,
  updatePost,
  updateComment,
  deletePost,
  deleteComment,
  togglePostReaction,
  addPostComment,
  fetchPostComments,
  repairPostCommentSummary,
  incrementPublicProfilePostCount,
  subscribeRecentPosts,
  subscribePostComments,
} from '../services/social';
import type { DocumentSnapshot, Unsubscribe } from 'firebase/firestore';

export interface Comment {
  id: string;
  authorName: string;
  authorInitial: string;
  authorUid: string;
  authorPhotoUrl?: string;
  text: string;
  createdAt: Date;
  editedAt?: Date;
}

export interface LastCommentPreview {
  id: string;
  authorName: string;
  authorInitial: string;
  authorUid: string;
  authorPhotoUrl?: string;
  text: string;
  createdAt?: Date;
}

export interface Post {
  id: string;
  authorName: string;
  authorInitial: string;
  authorUid: string;         // Firebase UID of the author — empty string for seed posts
  authorPhotoUrl?: string;   // profile photo snapshot at post-creation time
  badge: string;
  topic: string;
  text: string;
  imageUri?: string;
  imageAspectRatio?: number; // width/height ratio after cropping
  imageEmoji?: string;
  imageCaption?: string;
  reactions: Record<string, number>;
  userReactions: string[];
  reactionsByUser?: Record<string, string[]>; // keyed by uid
  comments: Comment[];
  commentList?: PostComment[]; // Loaded comments from Firestore subcollection
  commentCount?: number;
  lastComment?: LastCommentPreview;
  lastCommentAt?: Date;
  authorFollowersOnly?: boolean;
  createdAt: Date;
  showComments: boolean;
}

function reconcileCommentCount(
  commentCount: number | undefined,
  comments?: Array<{ text?: string }>,
  lastComment?: { text?: string },
  secondaryComments?: Array<{ text?: string }>,
): number {
  return Math.max(
    0,
    commentCount ?? 0,
    comments?.length ?? 0,
    secondaryComments?.length ?? 0,
    lastComment?.text ? 1 : 0,
  );
}

// No SEED_POSTS — the production app must never render fake authors
// ("Priya S." / "Ananya K." / etc.). The community feed starts empty and is
// populated exclusively by loadPostsFromFirestore. Reacting to seed posts
// silently failed because their ids don't exist in Firestore, which is what
// caused the "reaction lost on restart" bug.

const FILTERS = ['All', 'Newborn', 'Pregnancy', 'Nutrition', 'Mental Health', 'Milestones', 'Products'] as const;
export type CommunityFilter = typeof FILTERS[number];

interface CommunityState {
  posts: Post[];
  activeFilter: CommunityFilter;
  motherName: string;
  isLoadingPosts: boolean;
  isLoadingMore: boolean;
  hasMorePosts: boolean;
  lastPostDoc: DocumentSnapshot | null;

  addPost: (text: string, topic: string, authorName: string, imageUri?: string, imageAspectRatio?: number) => void;
  toggleReaction: (postId: string, emoji: string) => void;
  addComment: (postId: string, authorName: string, text: string) => void;
  toggleComments: (postId: string) => void;
  setFilter: (filter: CommunityFilter) => void;
  getFilteredPosts: () => Post[];
  getUserPostCount: (authorName: string) => number;

  // Firestore-backed actions
  loadPostsFromFirestore: () => Promise<void>;
  loadMorePosts: () => Promise<void>;
  addPostFirestore: (text: string, topic: string, authorUid: string, imageUri?: string, imageAspectRatio?: number, authorPhotoUrl?: string, authorFollowersOnly?: boolean) => Promise<void>;
  toggleReactionFirestore: (postId: string, myUid: string, myName: string, emoji: string) => Promise<void>;
  addCommentFirestore: (postId: string, authorUid: string, authorName: string, text: string, authorPhotoUrl?: string) => Promise<void>;
  loadCommentsForPost: (postId: string) => Promise<void>;
  updatePostFirestore: (postId: string, authorUid: string, updates: { text?: string; topic?: string }) => Promise<void>;
  updateCommentFirestore: (postId: string, commentId: string, authorUid: string, text: string) => Promise<void>;
  deletePostFirestore: (postId: string, authorUid: string) => Promise<void>;
  deleteCommentFirestore: (postId: string, commentId: string) => Promise<void>;
  // Realtime subscriptions — see comments where they live for the lifecycle
  // contract. The store remembers the unsubscribe handles so the screen
  // can re-subscribe across remounts without leaking listeners.
  subscribeToFeed: () => () => void;
  subscribeToComments: (postId: string) => () => void;
  resetCommunity: () => void;
}

// Module-scoped unsubscribe handles. Stored outside Zustand state so they
// don't trigger re-renders when set/cleared and don't get serialised by
// any future persist middleware.
let _feedUnsub: Unsubscribe | null = null;
const _commentUnsubs = new Map<string, Unsubscribe>();

export const useCommunityStore = create<CommunityState>((set, get) => ({
  posts: [],
  activeFilter: 'All',
  motherName: '',
  isLoadingPosts: false,
  isLoadingMore: false,
  hasMorePosts: true,
  lastPostDoc: null,

  addPost: (text: string, topic: string, authorName: string, imageUri?: string, imageAspectRatio?: number) => {
    const initial = authorName.charAt(0).toUpperCase();
    const newPost: Post = {
      id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      authorName,
      authorInitial: initial,
      authorUid: '',
      badge: 'Community Member',
      topic,
      text,
      imageUri,
      imageAspectRatio,
      reactions: {},
      userReactions: [],
      comments: [],
      createdAt: new Date(),
      showComments: false,
    };
    set((state) => ({ posts: [newPost, ...state.posts] }));
  },

  toggleReaction: (postId: string, emoji: string) => {
    set((state) => ({
      posts: state.posts.map((post) => {
        if (post.id !== postId) return post;

        const reactions = { ...post.reactions };
        const userReactions = [...post.userReactions];

        if (userReactions.includes(emoji)) {
          reactions[emoji] = Math.max(0, (reactions[emoji] || 1) - 1);
          if (reactions[emoji] === 0) delete reactions[emoji];
          return {
            ...post,
            reactions,
            userReactions: userReactions.filter((e) => e !== emoji),
          };
        } else {
          reactions[emoji] = (reactions[emoji] || 0) + 1;
          return {
            ...post,
            reactions,
            userReactions: [...userReactions, emoji],
          };
        }
      }),
    }));
  },

  addComment: (postId: string, authorName: string, text: string) => {
    const comment: Comment = {
      id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      authorName,
      authorInitial: authorName.charAt(0).toUpperCase(),
      authorUid: '',
      text,
      createdAt: new Date(),
    };
    set((state) => ({
      posts: state.posts.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: [...post.comments, comment],
              commentCount: (post.commentCount ?? post.comments.length) + 1,
              lastComment: comment,
              lastCommentAt: comment.createdAt,
              showComments: true,
            }
          : post
      ),
    }));
  },

  toggleComments: (postId: string) => {
    set((state) => ({
      posts: state.posts.map((post) =>
        post.id === postId ? { ...post, showComments: !post.showComments } : post
      ),
    }));
  },

  setFilter: (filter: CommunityFilter) => set({ activeFilter: filter }),

  getFilteredPosts: () => {
    const { posts, activeFilter } = get();
    if (activeFilter === 'All') return posts;
    return posts.filter((p) => p.topic.toLowerCase() === activeFilter.toLowerCase());
  },

  getUserPostCount: (authorName: string) => {
    return get().posts.filter((p) => p.authorName === authorName).length;
  },

  // ─── Firestore-backed actions ────────────────────────────────────────────────

  loadPostsFromFirestore: async () => {
    set({ isLoadingPosts: true, hasMorePosts: true, lastPostDoc: null });
    try {
      const { posts: fsPosts, lastDoc } = await fetchRecentPosts();

      if (fsPosts.length === 0) {
        set({ isLoadingPosts: false, hasMorePosts: false });
        return;
      }

      const mappedPosts: Post[] = fsPosts.map((fsPost) => {
        const lastComment = fsPost.lastComment;
        return {
          id: fsPost.id,
          authorName: fsPost.authorName ?? '',
          authorInitial: (fsPost.authorName ?? '?').charAt(0).toUpperCase(),
          authorUid: fsPost.authorUid ?? '',
          authorPhotoUrl: (fsPost as any).authorPhotoUrl ?? undefined,
          badge: fsPost.badge ?? 'Community Member',
          topic: fsPost.topic ?? 'General',
          text: fsPost.text ?? '',
          imageUri: fsPost.imageUri,
          imageAspectRatio: fsPost.imageAspectRatio,
          imageEmoji: (fsPost as any).imageEmoji,
          imageCaption: (fsPost as any).imageCaption,
          reactions: fsPost.reactions ?? {},
          userReactions: [],
          reactionsByUser: fsPost.reactionsByUser ?? {},
          comments: [],
          commentList: [],
          commentCount: reconcileCommentCount(fsPost.commentCount, undefined, lastComment),
          lastComment,
          lastCommentAt: fsPost.lastCommentAt,
          authorFollowersOnly: (fsPost as any).authorFollowersOnly ?? false,
          createdAt: fsPost.createdAt instanceof Date ? fsPost.createdAt : new Date(fsPost.createdAt),
          showComments: false,
        };
      });

      mappedPosts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      set({
        posts: mappedPosts,
        lastPostDoc: lastDoc,
        hasMorePosts: fsPosts.length >= POSTS_PAGE_SIZE,
      });
    } catch (error) {
      console.error('loadPostsFromFirestore error:', error);
    } finally {
      set({ isLoadingPosts: false });
    }
  },

  loadMorePosts: async () => {
    const { isLoadingMore, hasMorePosts, lastPostDoc } = get();
    if (isLoadingMore || !hasMorePosts || !lastPostDoc) return;

    set({ isLoadingMore: true });
    try {
      const { posts: fsPosts, lastDoc } = await fetchRecentPosts(POSTS_PAGE_SIZE, lastPostDoc);

      if (fsPosts.length === 0) {
        set({ isLoadingMore: false, hasMorePosts: false });
        return;
      }

      const newPosts: Post[] = fsPosts.map((fsPost) => {
        const lastComment = fsPost.lastComment;
        return {
          id: fsPost.id,
          authorName: fsPost.authorName ?? '',
          authorInitial: (fsPost.authorName ?? '?').charAt(0).toUpperCase(),
          authorUid: fsPost.authorUid ?? '',
          authorPhotoUrl: (fsPost as any).authorPhotoUrl ?? undefined,
          badge: fsPost.badge ?? 'Community Member',
          topic: fsPost.topic ?? 'General',
          text: fsPost.text ?? '',
          imageUri: fsPost.imageUri,
          imageAspectRatio: fsPost.imageAspectRatio,
          imageEmoji: (fsPost as any).imageEmoji,
          imageCaption: (fsPost as any).imageCaption,
          reactions: fsPost.reactions ?? {},
          userReactions: [],
          reactionsByUser: fsPost.reactionsByUser ?? {},
          comments: [],
          commentList: [],
          commentCount: reconcileCommentCount(fsPost.commentCount, undefined, lastComment),
          lastComment,
          lastCommentAt: fsPost.lastCommentAt,
          authorFollowersOnly: (fsPost as any).authorFollowersOnly ?? false,
          createdAt: fsPost.createdAt instanceof Date ? fsPost.createdAt : new Date(fsPost.createdAt),
          showComments: false,
        };
      });

      // Dedupe by id when appending: a fresh post created mid-scroll
      // (or a re-fired onEndReached racing the previous batch) would
      // otherwise insert a duplicate row. Map keeps the first-seen
      // entry so optimistic local state isn't clobbered by older
      // server data.
      set((state) => {
        const seen = new Set(state.posts.map((p) => p.id));
        const additions = newPosts.filter((p) => !seen.has(p.id));
        return {
          posts: [...state.posts, ...additions],
          lastPostDoc: lastDoc,
          hasMorePosts: fsPosts.length >= POSTS_PAGE_SIZE,
          isLoadingMore: false,
        };
      });
    } catch (error) {
      console.error('loadMorePosts error:', error);
      set({ isLoadingMore: false });
    }
  },

  subscribeToFeed: () => {
    // Idempotent: if a subscription is already running (hot reload, double
    // mount), tear it down and start fresh so the callback set always
    // points at the latest store closure.
    if (_feedUnsub) { try { _feedUnsub(); } catch (_) {} _feedUnsub = null; }
    set({ isLoadingPosts: true });
    const unsub = subscribeRecentPosts(POSTS_PAGE_SIZE, (fsPosts, lastDoc) => {
      // Realtime-derived posts replace the FIRST PAGE only. Older pages
      // loaded via loadMorePosts (which appends after lastPostDoc) stay
      // in place — we identify them by ids that aren't in the live set
      // and merge them after the live page so infinite-scroll history
      // isn't wiped on every snapshot.
      const liveIds = new Set(fsPosts.map((p) => p.id));
      const livePosts: Post[] = fsPosts.map((fsPost) => {
        const lastComment = fsPost.lastComment;
        // Preserve local-only state on existing posts (showComments,
        // optimistic commentList) so a snapshot doesn't collapse an
        // open comments thread or wipe an in-flight comment.
        const existing = get().posts.find((p) => p.id === fsPost.id);
        return {
          id: fsPost.id,
          authorName: fsPost.authorName ?? '',
          authorInitial: (fsPost.authorName ?? '?').charAt(0).toUpperCase(),
          authorUid: fsPost.authorUid ?? '',
          authorPhotoUrl: (fsPost as any).authorPhotoUrl ?? undefined,
          badge: fsPost.badge ?? 'Community Member',
          topic: fsPost.topic ?? 'General',
          text: fsPost.text ?? '',
          imageUri: fsPost.imageUri,
          imageAspectRatio: fsPost.imageAspectRatio,
          imageEmoji: (fsPost as any).imageEmoji,
          imageCaption: (fsPost as any).imageCaption,
          reactions: fsPost.reactions ?? {},
          userReactions: existing?.userReactions ?? [],
          reactionsByUser: fsPost.reactionsByUser ?? {},
          comments: existing?.comments ?? [],
          commentList: existing?.commentList ?? [],
          commentCount: reconcileCommentCount(
            fsPost.commentCount,
            existing?.comments,
            lastComment,
            existing?.commentList,
          ),
          lastComment,
          lastCommentAt: fsPost.lastCommentAt,
          authorFollowersOnly: (fsPost as any).authorFollowersOnly ?? false,
          createdAt: fsPost.createdAt instanceof Date
            ? fsPost.createdAt
            : new Date(fsPost.createdAt),
          showComments: existing?.showComments ?? false,
        };
      });
      set((state) => {
        const olderPages = state.posts.filter((p) => !liveIds.has(p.id));
        return {
          posts: [...livePosts, ...olderPages],
          lastPostDoc: lastDoc ?? state.lastPostDoc,
          isLoadingPosts: false,
          // Only reset hasMorePosts on the very first snapshot, so
          // pagination state survives reactions/comment edits that
          // re-fire the snapshot but don't change pagination depth.
          hasMorePosts: state.lastPostDoc === null
            ? fsPosts.length >= POSTS_PAGE_SIZE
            : state.hasMorePosts,
        };
      });
    });
    if (unsub) _feedUnsub = unsub;
    return () => {
      if (_feedUnsub) { try { _feedUnsub(); } catch (_) {} _feedUnsub = null; }
    };
  },

  subscribeToComments: (postId: string) => {
    if (!postId) return () => {};
    // One subscription per post; re-subscribing replaces the prior one
    // so the latest closure is always active.
    const prior = _commentUnsubs.get(postId);
    if (prior) { try { prior(); } catch (_) {} _commentUnsubs.delete(postId); }
    const unsub = subscribePostComments(postId, (comments) => {
      set((state) => ({
        posts: state.posts.map((post) => {
          if (post.id !== postId) return post;
          // Drop optimistic temp ids that have a server twin (matched on
          // text + author, since the server-issued id is different).
          const realIds = new Set(comments.map((c) => c.id));
          const surviving = (post.commentList ?? []).filter((c) => {
            const isOptimistic = c.id.startsWith('opt-');
            if (!isOptimistic) return false;
            return !comments.some(
              (s) => s.authorUid === c.authorUid && s.text === c.text,
            );
          });
          const merged = [...comments, ...surviving]
            .sort((a, b) => {
              const ta = a.createdAt?.getTime?.() ?? 0;
              const tb = b.createdAt?.getTime?.() ?? 0;
              return ta - tb;
            });
          return {
            ...post,
            commentList: merged,
            commentCount: Math.max(post.commentCount ?? 0, merged.length),
          };
        }),
      }));
    });
    if (unsub) _commentUnsubs.set(postId, unsub);
    return () => {
      const u = _commentUnsubs.get(postId);
      if (u) { try { u(); } catch (_) {} _commentUnsubs.delete(postId); }
    };
  },

  addPostFirestore: async (
    text: string,
    topic: string,
    authorUid: string,
    imageUri?: string,
    imageAspectRatio?: number,
    authorPhotoUrl?: string,
    authorFollowersOnly?: boolean,
  ) => {
    const { motherName } = get();
    const authorName = motherName || 'Community Member';
    const authorInitial = authorName.charAt(0).toUpperCase();

    try {
      const postData = {
        authorUid,
        authorName,
        authorInitial,
        ...(authorPhotoUrl && { authorPhotoUrl }),
        badge: 'Community Member',
        topic,
        text,
        ...(imageUri !== undefined && { imageUri }),
        ...(imageAspectRatio !== undefined && { imageAspectRatio }),
        ...(authorFollowersOnly !== undefined && { authorFollowersOnly }),
      };

      const postId = await createPost(postData);

      const newPost: Post = {
        id: postId,
        authorName,
        authorInitial,
        authorUid,
        authorPhotoUrl,
        badge: 'Community Member',
        topic,
        text,
        imageUri,
        imageAspectRatio,
        reactions: {},
        userReactions: [],
        reactionsByUser: {},
        comments: [],
        commentList: [],
        commentCount: 0,
        authorFollowersOnly,
        createdAt: new Date(),
        showComments: false,
      };

      // Dedupe by id: if a refresh fired during the create round-trip
      // and pulled this post back from Firestore, prepending again would
      // double it for one render — users reported "shows 2 entries and 1
      // disappears on next load" on the web app.
      set((state) => ({
        posts: state.posts.some((p) => p.id === newPost.id)
          ? state.posts
          : [newPost, ...state.posts],
      }));
    } catch (error) {
      console.error('addPostFirestore error:', error);
      throw error;
    }
  },

  toggleReactionFirestore: async (postId: string, myUid: string, myName: string, emoji: string) => {
    // Optimistic update — the pill flips the instant the user taps instead
    // of waiting ~1-3s for the Firestore transaction (which goes through
    // App Check / reCAPTCHA). Users were confused seeing the pill visually
    // freeze or disappear during that wait. Server response below confirms
    // or corrects the optimistic state.
    const snapshot = get().posts.find((p) => p.id === postId);
    let rolledBack = false;
    if (snapshot) {
      const myCurrent = (snapshot.reactionsByUser?.[myUid] ?? []) as string[];
      const alreadyHas = myCurrent.includes(emoji);
      const nextMine = alreadyHas
        ? myCurrent.filter((e) => e !== emoji)
        : [...myCurrent, emoji];
      const currCount = (snapshot.reactions?.[emoji] as number) ?? 0;
      const nextCount = Math.max(0, currCount + (alreadyHas ? -1 : 1));
      const nextReactions: Record<string, number> = { ...(snapshot.reactions ?? {}) };
      if (nextCount === 0) delete nextReactions[emoji];
      else nextReactions[emoji] = nextCount;

      set((state) => ({
        posts: state.posts.map((post) =>
          post.id === postId
            ? {
                ...post,
                reactions: nextReactions,
                userReactions: nextMine,
                reactionsByUser: {
                  ...(post.reactionsByUser ?? {}),
                  [myUid]: nextMine,
                },
              }
            : post,
        ),
      }));
    }

    try {
      const { reactions, myReactions } = await togglePostReaction(postId, myUid, myName, emoji);

      // Authoritative server state — overwrite optimistic.
      set((state) => ({
        posts: state.posts.map((post) =>
          post.id === postId
            ? {
                ...post,
                reactions,
                userReactions: myReactions,
                reactionsByUser: {
                  ...(post.reactionsByUser ?? {}),
                  [myUid]: myReactions,
                },
              }
            : post
        ),
      }));
    } catch (error) {
      console.error('toggleReactionFirestore error:', error);
      // Roll back the optimistic update so the UI doesn't drift from server.
      if (snapshot && !rolledBack) {
        rolledBack = true;
        set((state) => ({
          posts: state.posts.map((post) =>
            post.id === postId ? snapshot : post,
          ),
        }));
      }
      throw error;
    }
  },

  addCommentFirestore: async (
    postId: string,
    authorUid: string,
    authorName: string,
    text: string,
    authorPhotoUrl?: string
  ) => {
    const posts = get().posts;
    const post = posts.find((p) => p.id === postId);
    const postAuthorUid = post?.authorUid ?? '';
    const authorInitial = authorName.charAt(0).toUpperCase();

    // Optimistic insert FIRST so the comment appears in the thread
    // instantly. Temp id is replaced when the server responds (or
    // backed out on failure). The realtime subscriptionToComments
    // filter uses the 'opt-' prefix to dedupe its own twin.
    const tempId = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optimisticComment: PostComment = {
      id: tempId,
      authorUid,
      authorName,
      authorInitial,
      authorPhotoUrl,
      text,
      createdAt: new Date(),
    };
    const optimisticLocal: Comment = {
      id: tempId,
      authorName,
      authorInitial,
      authorUid,
      authorPhotoUrl,
      text,
      createdAt: new Date(),
    };

    set((state) => ({
      posts: state.posts.map((p) => {
        if (p.id !== postId) return p;
        return {
          ...p,
          comments: [...p.comments, optimisticLocal],
          commentList: [...(p.commentList ?? []), optimisticComment],
          commentCount: (p.commentCount ?? 0) + 1,
          lastComment: {
            id: tempId,
            authorUid,
            authorName,
            authorInitial,
            authorPhotoUrl,
            text,
          },
          lastCommentAt: new Date(),
          showComments: true,
        };
      }),
    }));

    try {
      const comment = await addPostComment(
        postId,
        {
          authorUid,
          authorName,
          authorInitial,
          ...(authorPhotoUrl && { authorPhotoUrl }),
          text,
        },
        postAuthorUid,
        authorName
      );

      // Swap the optimistic temp entry for the real server doc. If the
      // realtime subscription already swept the temp out, this is a
      // no-op for that path but updates lastComment to the real id.
      set((state) => ({
        posts: state.posts.map((p) => {
          if (p.id !== postId) return p;
          const realCommentList = (p.commentList ?? []).map((c) =>
            c.id === tempId ? { ...comment } : c,
          );
          const realLocal = p.comments.map((c) =>
            c.id === tempId
              ? { ...c, id: comment.id, createdAt: comment.createdAt instanceof Date ? comment.createdAt : c.createdAt }
              : c,
          );
          return {
            ...p,
            comments: realLocal,
            commentList: realCommentList,
            lastComment: p.lastComment?.id === tempId
              ? { ...p.lastComment, id: comment.id }
              : p.lastComment,
          };
        }),
      }));
    } catch (error) {
      // Roll back the optimistic insert so the user sees their message
      // didn't go through (caller surfaces a toast). The Wave 4 polish
      // will add a "retry" affordance keyed on this rollback path.
      set((state) => ({
        posts: state.posts.map((p) => {
          if (p.id !== postId) return p;
          const cleanedList = (p.commentList ?? []).filter((c) => c.id !== tempId);
          const cleanedLocal = p.comments.filter((c) => c.id !== tempId);
          return {
            ...p,
            comments: cleanedLocal,
            commentList: cleanedList,
            commentCount: Math.max(0, (p.commentCount ?? 1) - 1),
            lastComment: p.lastComment?.id === tempId
              ? cleanedList[cleanedList.length - 1]
                ? {
                    id: cleanedList[cleanedList.length - 1].id,
                    authorUid: cleanedList[cleanedList.length - 1].authorUid,
                    authorName: cleanedList[cleanedList.length - 1].authorName,
                    authorInitial: cleanedList[cleanedList.length - 1].authorInitial,
                    authorPhotoUrl: cleanedList[cleanedList.length - 1].authorPhotoUrl,
                    text: cleanedList[cleanedList.length - 1].text,
                  }
                : undefined
              : p.lastComment,
          };
        }),
      }));
      console.error('addCommentFirestore error:', error);
      throw error;
    }
  },

  loadCommentsForPost: async (postId: string) => {
    try {
      const comments = await fetchPostComments(postId);
      repairPostCommentSummary(postId, comments);

      set((state) => ({
        posts: state.posts.map((p) =>
          p.id === postId
            ? {
                ...p,
                comments: comments as Comment[],
                commentList: comments,
                commentCount: reconcileCommentCount(p.commentCount, comments, p.lastComment, p.comments),
                lastComment: p.lastComment ?? comments[comments.length - 1],
                lastCommentAt: p.lastCommentAt ?? comments[comments.length - 1]?.createdAt,
              }
            : p
        ),
      }));
    } catch (error) {
      console.error('loadCommentsForPost error:', error);
    }
  },

  updatePostFirestore: async (postId: string, authorUid: string, updates: { text?: string; topic?: string }) => {
    // Guard: only own posts
    const post = get().posts.find((p) => p.id === postId);
    if (!post || post.authorUid !== authorUid) return;
    try {
      await updatePost(postId, updates);
      set((state) => ({
        posts: state.posts.map((p) =>
          p.id === postId ? { ...p, ...updates } : p
        ),
      }));
    } catch (error) {
      console.error('updatePostFirestore error:', error);
      throw error;
    }
  },

  updateCommentFirestore: async (postId: string, commentId: string, authorUid: string, text: string) => {
    const trimmed = text.trim();
    if (!commentId || !trimmed) return;
    try {
      await updateComment(postId, commentId, authorUid, trimmed);
      set((state) => ({
        posts: state.posts.map((p) => {
          if (p.id !== postId) return p;
          const updateOne = <T extends { id: string; text: string }>(comment: T): T =>
            comment.id === commentId
              ? { ...comment, text: trimmed, editedAt: new Date() } as T
              : comment;
          const nextCommentList = (p.commentList ?? []).map(updateOne);
          const nextComments = p.comments.map(updateOne);
          const nextLastComment = p.lastComment?.id === commentId
            ? { ...p.lastComment, text: trimmed }
            : p.lastComment;
          return {
            ...p,
            commentList: nextCommentList,
            comments: nextComments,
            lastComment: nextLastComment,
          };
        }),
      }));
    } catch (error) {
      console.error('updateCommentFirestore error:', error);
      throw error;
    }
  },

  deletePostFirestore: async (postId: string, authorUid: string) => {
    // Guard: only allow if the post belongs to this user
    const post = get().posts.find((p) => p.id === postId);
    if (!post || post.authorUid !== authorUid) return;
    try {
      // Await Firestore delete FIRST — only remove from local state on success
      await deletePost(postId);
      set((state) => ({ posts: state.posts.filter((p) => p.id !== postId) }));
      // Fire-and-forget: decrement public profile postsCount
      incrementPublicProfilePostCount(authorUid, -1);
    } catch (error) {
      console.error('deletePostFirestore error:', error);
      throw error;
    }
  },

  deleteCommentFirestore: async (postId: string, commentId: string) => {
    if (!commentId) return;
    try {
      await deleteComment(postId, commentId);
      set((state) => ({
        posts: state.posts.map((p) => {
          if (p.id !== postId) return p;
          const newCommentList = (p.commentList ?? []).filter((c) => c.id !== commentId);
          const newComments = p.comments.filter((c) => c.id !== commentId);
          const nextLast = p.lastComment?.id === commentId
            ? (newCommentList[newCommentList.length - 1] ?? newComments[newComments.length - 1])
            : p.lastComment;
          return {
            ...p,
            commentList: newCommentList,
            comments: newComments,
            commentCount: reconcileCommentCount(
              Math.max(0, (p.commentCount ?? p.comments.length) - 1),
              newCommentList.length > 0 ? newCommentList : newComments,
              nextLast,
              newComments,
            ),
            lastComment: nextLast,
            lastCommentAt: nextLast?.createdAt,
          };
        }),
      }));
    } catch (error) {
      console.error('deleteCommentFirestore error:', error);
      throw error;
    }
  },

  resetCommunity: () => set({
    posts: [],
    activeFilter: 'All',
    motherName: '',
    isLoadingPosts: false,
    isLoadingMore: false,
    hasMorePosts: true,
    lastPostDoc: null,
  }),
}));
