import { create } from 'zustand';

export interface Comment {
  id: string;
  authorName: string;
  authorInitial: string;
  text: string;
  createdAt: Date;
}

export interface Post {
  id: string;
  authorName: string;
  authorInitial: string;
  badge: string;
  topic: string;
  text: string;
  imageUri?: string;
  imageAspectRatio?: number; // width/height ratio after cropping
  imageEmoji?: string;
  imageCaption?: string;
  reactions: Record<string, number>;
  userReactions: string[];
  comments: Comment[];
  createdAt: Date;
  showComments: boolean;
}

const SEED_POSTS: Post[] = [
  {
    id: 'seed-1',
    authorName: 'Priya S.',
    authorInitial: 'P',
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

  addPost: (text: string, topic: string, authorName: string, imageUri?: string, imageAspectRatio?: number) => void;
  toggleReaction: (postId: string, emoji: string) => void;
  addComment: (postId: string, authorName: string, text: string) => void;
  toggleComments: (postId: string) => void;
  setFilter: (filter: CommunityFilter) => void;
  getFilteredPosts: () => Post[];
  getUserPostCount: (authorName: string) => number;
}

export const useCommunityStore = create<CommunityState>((set, get) => ({
  posts: SEED_POSTS,
  activeFilter: 'All',

  addPost: (text: string, topic: string, authorName: string, imageUri?: string, imageAspectRatio?: number) => {
    const initial = authorName.charAt(0).toUpperCase();
    const newPost: Post = {
      id: Date.now().toString(),
      authorName,
      authorInitial: initial,
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
      id: Date.now().toString(),
      authorName,
      authorInitial: authorName.charAt(0).toUpperCase(),
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
    return posts.filter((p) => p.topic === activeFilter);
  },

  getUserPostCount: (authorName: string) => {
    return get().posts.filter((p) => p.authorName === authorName).length;
  },
}));
