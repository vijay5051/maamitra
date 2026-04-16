import { create } from 'zustand';
import type { PostComment } from '../services/social';
import {
  fetchRecentPosts,
  createPost,
  deletePost,
  deleteComment,
  togglePostReaction,
  addPostComment,
  fetchPostComments,
} from '../services/social';

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
  createdAt: Date;
  showComments: boolean;
}

const SEED_POSTS: Post[] = [
  {
    id: 'seed-1',
    authorName: 'Priya S.',
    authorInitial: 'P',
    authorUid: '',
    badge: 'New Mom · Mumbai',
    topic: 'Newborn',
    text: 'Finally figured out the perfect latch after 3 weeks of struggling! Turns out the laid-back nursing position works best for us. Sharing for any other mamas struggling 🤱 Don\'t give up, it gets easier!',
    reactions: { '❤️': 47, '🤱': 23, '😊': 12 },
    userReactions: [],
    comments: [],
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    showComments: false,
  },
  {
    id: 'seed-2',
    authorName: 'Ananya K.',
    authorInitial: 'A',
    authorUid: '',
    badge: '3rd Trimester · Bangalore',
    topic: 'Pregnancy',
    text: 'Monsoon is here and I\'m worried about mosquitoes and dengue for my newborn (due next month). Any tips from experienced moms? Sleeping under mosquito nets enough?',
    reactions: { '❤️': 31, '💜': 18, '🙏': 9 },
    userReactions: [],
    comments: [],
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    showComments: false,
  },
  {
    id: 'seed-3',
    authorName: 'Deepika R.',
    authorInitial: 'D',
    authorUid: '',
    badge: 'Mom of 2 · Delhi',
    topic: 'Sleep',
    text: '4-month sleep regression is REAL. My baby who was sleeping 6-hour stretches is now up every 2 hours. Doctor says it\'s developmental. Surviving on chai ☕ Anyone else in this boat?',
    reactions: { '❤️': 89, '😊': 44, '💪': 37 },
    userReactions: [],
    comments: [],
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    showComments: false,
  },
  {
    id: 'seed-4',
    authorName: 'Meena T.',
    authorInitial: 'M',
    authorUid: '',
    badge: 'First-time Mom · Pune',
    topic: 'Mental Health',
    text: 'Just wanted to say — this community has been my lifeline during those 3am feeds when I felt so alone. Thank you all. 💜 MaaMitra\'s chat feature answered questions I was too embarrassed to ask anyone.',
    reactions: { '❤️': 134, '💜': 67, '😊': 52 },
    userReactions: [],
    comments: [],
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    showComments: false,
  },
];

const FILTERS = ['All', 'Newborn', 'Pregnancy', 'Nutrition', 'Mental Health', 'Milestones', 'Products'] as const;
export type CommunityFilter = typeof FILTERS[number];

interface CommunityState {
  posts: Post[];
  activeFilter: CommunityFilter;
  motherName: string;
  isLoadingPosts: boolean;

  addPost: (text: string, topic: string, authorName: string, imageUri?: string, imageAspectRatio?: number) => void;
  toggleReaction: (postId: string, emoji: string) => void;
  addComment: (postId: string, authorName: string, text: string) => void;
  toggleComments: (postId: string) => void;
  setFilter: (filter: CommunityFilter) => void;
  getFilteredPosts: () => Post[];
  getUserPostCount: (authorName: string) => number;

  // Firestore-backed actions
  loadPostsFromFirestore: () => Promise<void>;
  addPostFirestore: (text: string, topic: string, authorUid: string, imageUri?: string, imageAspectRatio?: number, authorPhotoUrl?: string) => Promise<void>;
  toggleReactionFirestore: (postId: string, myUid: string, myName: string, emoji: string) => Promise<void>;
  addCommentFirestore: (postId: string, authorUid: string, authorName: string, text: string, authorPhotoUrl?: string) => Promise<void>;
  loadCommentsForPost: (postId: string) => Promise<void>;
  deletePostFirestore: (postId: string, authorUid: string) => Promise<void>;
  deleteCommentFirestore: (postId: string, commentId: string) => Promise<void>;
}

export const useCommunityStore = create<CommunityState>((set, get) => ({
  posts: SEED_POSTS,
  activeFilter: 'All',
  motherName: '',
  isLoadingPosts: false,

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
    set({ isLoadingPosts: true });
    try {
      const fsPosts = await fetchRecentPosts();

      if (fsPosts.length === 0) {
        // No Firestore posts yet — keep seed posts as fallback
        set({ isLoadingPosts: false });
        return;
      }

      const mappedPosts: Post[] = fsPosts.map((fsPost) => ({
        id: fsPost.id,
        authorName: fsPost.authorName ?? '',
        authorInitial: (fsPost.authorName ?? '?').charAt(0).toUpperCase(),
        authorUid: fsPost.authorUid ?? '',
        badge: fsPost.badge ?? 'Community Member',
        topic: fsPost.topic ?? 'General',
        text: fsPost.text ?? '',
        imageUri: fsPost.imageUri,
        imageAspectRatio: fsPost.imageAspectRatio,
        reactions: fsPost.reactions ?? {},
        userReactions: [],
        reactionsByUser: fsPost.reactionsByUser,
        comments: [],
        commentList: [],
        commentCount: fsPost.commentCount ?? 0,
        createdAt: fsPost.createdAt instanceof Date ? fsPost.createdAt : new Date(fsPost.createdAt),
        showComments: false,
      }));

      // Sort by createdAt descending
      mappedPosts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Seed posts are replaced entirely by Firestore posts when Firestore has data
      set({ posts: mappedPosts });
    } catch (error) {
      console.error('loadPostsFromFirestore error:', error);
      // On error, keep whatever posts are already in state
    } finally {
      set({ isLoadingPosts: false });
    }
  },

  addPostFirestore: async (
    text: string,
    topic: string,
    authorUid: string,
    imageUri?: string,
    imageAspectRatio?: number,
    authorPhotoUrl?: string
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
        createdAt: new Date(),
        showComments: false,
      };

      set((state) => ({ posts: [newPost, ...state.posts] }));
    } catch (error) {
      console.error('addPostFirestore error:', error);
      throw error;
    }
  },

  toggleReactionFirestore: async (postId: string, myUid: string, myName: string, emoji: string) => {
    try {
      const { reactions, myReactions } = await togglePostReaction(postId, myUid, myName, emoji);

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

      set((state) => ({
        posts: state.posts.map((p) => {
          if (p.id !== postId) return p;
          return {
            ...p,
            comments: [...p.comments, localComment],
            commentList: [...(p.commentList ?? []), comment],
            commentCount: (p.commentCount ?? p.comments.length) + 1,
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

  deletePostFirestore: async (postId: string, authorUid: string) => {
    // Guard: only allow if the post belongs to this user
    const post = get().posts.find((p) => p.id === postId);
    if (!post || post.authorUid !== authorUid) return;
    try {
      await deletePost(postId);
      // Decrement publicProfile post count
      set((state) => ({ posts: state.posts.filter((p) => p.id !== postId) }));
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
}));
