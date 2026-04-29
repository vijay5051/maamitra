import { create } from 'zustand';
import type { PostComment } from '../services/social';
import {
  fetchRecentPosts,
  POSTS_PAGE_SIZE,
  createPost,
  updatePost,
  deletePost,
  deleteComment,
  togglePostReaction,
  addPostComment,
  fetchPostComments,
  incrementPublicProfilePostCount,
} from '../services/social';
import type { DocumentSnapshot } from 'firebase/firestore';

export interface Comment {
  id: string;
  authorName: string;
  authorInitial: string;
  authorUid: string;
  authorPhotoUrl?: string;
  text: string;
  createdAt: Date;
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
  authorFollowersOnly?: boolean;
  createdAt: Date;
  showComments: boolean;
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
  deletePostFirestore: (postId: string, authorUid: string) => Promise<void>;
  deleteCommentFirestore: (postId: string, commentId: string) => Promise<void>;
  resetCommunity: () => void;
}

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
          ? { ...post, comments: [...post.comments, comment], showComments: true }
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

      const mappedPosts: Post[] = fsPosts.map((fsPost) => ({
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
        commentCount: fsPost.commentCount ?? 0,
        authorFollowersOnly: (fsPost as any).authorFollowersOnly ?? false,
        createdAt: fsPost.createdAt instanceof Date ? fsPost.createdAt : new Date(fsPost.createdAt),
        showComments: false,
      }));

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

      const newPosts: Post[] = fsPosts.map((fsPost) => ({
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
        commentCount: fsPost.commentCount ?? 0,
        authorFollowersOnly: (fsPost as any).authorFollowersOnly ?? false,
        createdAt: fsPost.createdAt instanceof Date ? fsPost.createdAt : new Date(fsPost.createdAt),
        showComments: false,
      }));

      set((state) => ({
        posts: [...state.posts, ...newPosts],
        lastPostDoc: lastDoc,
        hasMorePosts: fsPosts.length >= POSTS_PAGE_SIZE,
        isLoadingMore: false,
      }));
    } catch (error) {
      console.error('loadMorePosts error:', error);
      set({ isLoadingMore: false });
    }
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

    try {
      const comment = await addPostComment(
        postId,
        {
          authorUid,
          authorName,
          authorInitial: authorName.charAt(0).toUpperCase(),
          ...(authorPhotoUrl && { authorPhotoUrl }),
          text,
        },
        postAuthorUid,
        authorName
      );

      // Also build a local Comment for backward-compat `comments` array
      const localComment: Comment = {
        id: comment.id,
        authorName: comment.authorName ?? authorName,
        authorInitial: (comment.authorName ?? authorName).charAt(0).toUpperCase(),
        authorUid,
        authorPhotoUrl: comment.authorPhotoUrl,
        text,
        createdAt: comment.createdAt instanceof Date ? comment.createdAt : new Date(comment.createdAt),
      };

      // Dedupe by id when appending: a concurrent fetchPostComments
      // (e.g. user expanded the comment list mid-send) can deliver this
      // comment from the server before the optimistic add runs.
      set((state) => ({
        posts: state.posts.map((p) => {
          if (p.id !== postId) return p;
          const commentsAlreadyHas = p.comments.some((c) => c.id === localComment.id);
          const listAlreadyHas = (p.commentList ?? []).some((c) => c.id === comment.id);
          return {
            ...p,
            comments: commentsAlreadyHas ? p.comments : [...p.comments, localComment],
            commentList: listAlreadyHas
              ? (p.commentList ?? [])
              : [...(p.commentList ?? []), comment],
            commentCount: commentsAlreadyHas || listAlreadyHas
              ? (p.commentCount ?? p.comments.length)
              : (p.commentCount ?? p.comments.length) + 1,
            showComments: true,
          };
        }),
      }));
    } catch (error) {
      console.error('addCommentFirestore error:', error);
      throw error;
    }
  },

  loadCommentsForPost: async (postId: string) => {
    try {
      const comments = await fetchPostComments(postId);

      set((state) => ({
        posts: state.posts.map((p) =>
          p.id === postId ? { ...p, commentList: comments } : p
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
          return {
            ...p,
            commentList: newCommentList,
            comments: newComments,
            commentCount: Math.max(0, (p.commentCount ?? p.comments.length) - 1),
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
