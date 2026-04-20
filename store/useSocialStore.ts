import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';
import { useProfileStore } from './useProfileStore';
import { useCommunityStore } from './useCommunityStore';
import * as SocialService from '../services/social';
import type { FollowEntry, FollowRequest, AppNotification } from '../services/social';
import type { Unsubscribe } from 'firebase/firestore';

interface SocialState {
  // Social graph
  followers: FollowEntry[];
  following: FollowEntry[];
  incomingRequests: FollowRequest[];
  outgoingRequests: FollowRequest[];
  blockedUids: string[];
  followersCount: number;
  followingCount: number;

  // Notifications
  notifications: AppNotification[];
  unreadCount: number;

  // Follow status cache: targetUid → status
  followStatusCache: Record<string, 'none' | 'pending_outgoing' | 'following'>;

  // Loading
  isLoadingSocial: boolean;
  isLoadingNotifs: boolean;

  // Actions
  loadSocialData: () => Promise<void>;
  sendFollowRequest: (toUid: string, toName: string) => Promise<void>;
  acceptRequest: (requestId: string, fromUid: string, fromName: string, fromPhotoUrl?: string) => Promise<void>;
  declineRequest: (requestId: string) => Promise<void>;
  cancelRequest: (requestId: string, toUid: string) => Promise<void>;
  unfollow: (targetUid: string) => Promise<void>;
  blockUser: (targetUid: string) => Promise<void>;
  unblockUser: (targetUid: string) => Promise<void>;
  getFollowStatus: (targetUid: string) => 'none' | 'pending_outgoing' | 'following';
  isBlocked: (targetUid: string) => boolean;
  loadFollowStatus: (targetUid: string) => Promise<void>;

  loadNotifications: () => Promise<void>;
  markRead: (notifId: string) => Promise<void>;
  markAllRead: () => Promise<void>;

  /** Start real-time listeners for everything — notifications, followers,
   *  following, incoming & outgoing requests. Idempotent: calling twice
   *  tears down the first set before opening the second. Returns an
   *  unsubscribe function. */
  subscribeAll: (uid: string) => () => void;
  unsubscribeAll: () => void;

  syncPublicProfile: () => Promise<void>;

  reset: () => void;
}

// Stash the current set of Firestore listeners outside the zustand state
// so zustand doesn't try to serialize them. Keyed on uid so we can detect
// a switch between users.
let _subs: {
  uid: string | null;
  unsubs: Array<Unsubscribe | null | undefined>;
} = { uid: null, unsubs: [] };

function tearDownSubs() {
  for (const u of _subs.unsubs) {
    try { u?.(); } catch { /* no-op */ }
  }
  _subs = { uid: null, unsubs: [] };
}

const initialState = {
  followers: [] as FollowEntry[],
  following: [] as FollowEntry[],
  incomingRequests: [] as FollowRequest[],
  outgoingRequests: [] as FollowRequest[],
  blockedUids: [] as string[],
  followersCount: 0,
  followingCount: 0,
  notifications: [] as AppNotification[],
  unreadCount: 0,
  followStatusCache: {} as Record<string, 'none' | 'pending_outgoing' | 'following'>,
  isLoadingSocial: false,
  isLoadingNotifs: false,
};

export const useSocialStore = create<SocialState>((set, get) => ({
  ...initialState,

  loadSocialData: async () => {
    const uid = useAuthStore.getState().user?.uid;
    if (!uid) return;

    set({ isLoadingSocial: true });
    try {
      const [followers, following, incomingRequests, outgoingRequests, blockedUids] =
        await Promise.all([
          SocialService.getFollowers(uid),
          SocialService.getFollowing(uid),
          SocialService.getIncomingFollowRequests(uid),
          SocialService.getOutgoingFollowRequests(uid),
          SocialService.getBlockedUsers(uid),
        ]);

      set({
        followers,
        following,
        incomingRequests,
        outgoingRequests,
        blockedUids,
        followersCount: followers.length,
        followingCount: following.length,
      });
    } catch (error) {
      console.error('loadSocialData error:', error);
    } finally {
      set({ isLoadingSocial: false });
    }
  },

  sendFollowRequest: async (toUid: string, toName: string) => {
    const uid = useAuthStore.getState().user?.uid;
    const name = useProfileStore.getState().motherName || useAuthStore.getState().user?.name || '';
    if (!uid) return;

    const photoUrl = useProfileStore.getState().photoUrl;
    try {
      const requestId = await SocialService.sendFollowRequest(uid, name, photoUrl || '', toUid, toName);
      const newRequest: FollowRequest = {
        id: requestId,
        fromUid: uid,
        fromName: name,
        fromPhotoUrl: photoUrl || '',
        toUid,
        status: 'pending',
        createdAt: new Date(),
      };

      set((state) => ({
        outgoingRequests: [...state.outgoingRequests, newRequest],
        followStatusCache: { ...state.followStatusCache, [toUid]: 'pending_outgoing' },
      }));
    } catch (error) {
      console.error('sendFollowRequest error:', error);
      throw error;
    }
  },

  acceptRequest: async (requestId: string, fromUid: string, fromName: string, fromPhotoUrl?: string) => {
    const uid = useAuthStore.getState().user?.uid;
    const myName = useProfileStore.getState().motherName || useAuthStore.getState().user?.name || '';
    if (!uid) return;

    const photoUrl = useProfileStore.getState().photoUrl;
    try {
      await SocialService.acceptFollowRequest(
        requestId,
        fromUid,
        fromName,
        fromPhotoUrl || '',
        uid,
        myName,
        photoUrl || ''
      );

      const newFollower: FollowEntry = {
        uid: fromUid,
        name: fromName,
        photoUrl: fromPhotoUrl || '',
        followedAt: new Date(),
      } as FollowEntry;

      set((state) => ({
        incomingRequests: state.incomingRequests.filter((r) => r.id !== requestId),
        followers: [...state.followers, newFollower],
        followersCount: state.followersCount + 1,
        // Do NOT set fromUid to 'following' — accepting their request means
        // THEY follow US, not that we follow them. Leave their outgoing status
        // as whatever it already is (none or pending_outgoing from our side).
        notifications: state.notifications.map((n) =>
          n.fromUid === fromUid && n.type === 'follow_request'
            ? { ...n, read: true }
            : n
        ),
      }));
    } catch (error) {
      console.error('acceptRequest error:', error);
      throw error;
    }
  },

  declineRequest: async (requestId: string) => {
    try {
      await SocialService.declineFollowRequest(requestId);
      set((state) => ({
        incomingRequests: state.incomingRequests.filter((r) => r.id !== requestId),
      }));
    } catch (error) {
      console.error('declineRequest error:', error);
      throw error;
    }
  },

  cancelRequest: async (requestId: string, toUid: string) => {
    const uid = useAuthStore.getState().user?.uid;
    if (!uid) return;

    try {
      await SocialService.cancelFollowRequest(requestId, uid, toUid);
      set((state) => ({
        outgoingRequests: state.outgoingRequests.filter((r) => r.id !== requestId),
        followStatusCache: { ...state.followStatusCache, [toUid]: 'none' },
      }));
    } catch (error) {
      console.error('cancelRequest error:', error);
      throw error;
    }
  },

  unfollow: async (targetUid: string) => {
    const uid = useAuthStore.getState().user?.uid;
    if (!uid) return;

    try {
      await SocialService.unfollowUser(uid, targetUid);
      set((state) => ({
        following: state.following.filter((f) => f.uid !== targetUid),
        followingCount: Math.max(0, state.followingCount - 1),
        followStatusCache: { ...state.followStatusCache, [targetUid]: 'none' },
      }));
    } catch (error) {
      console.error('unfollow error:', error);
      throw error;
    }
  },

  blockUser: async (targetUid: string) => {
    const uid = useAuthStore.getState().user?.uid;
    if (!uid) return;

    try {
      await SocialService.blockUser(uid, targetUid);
      set((state) => ({
        blockedUids: [...state.blockedUids, targetUid],
        followers: state.followers.filter((f) => f.uid !== targetUid),
        following: state.following.filter((f) => f.uid !== targetUid),
        followersCount: state.followers.some((f) => f.uid === targetUid)
          ? Math.max(0, state.followersCount - 1)
          : state.followersCount,
        followingCount: state.following.some((f) => f.uid === targetUid)
          ? Math.max(0, state.followingCount - 1)
          : state.followingCount,
        followStatusCache: { ...state.followStatusCache, [targetUid]: 'none' },
      }));
    } catch (error) {
      console.error('blockUser error:', error);
      throw error;
    }
  },

  unblockUser: async (targetUid: string) => {
    const uid = useAuthStore.getState().user?.uid;
    if (!uid) return;

    try {
      await SocialService.unblockUser(uid, targetUid);
      set((state) => ({
        blockedUids: state.blockedUids.filter((id) => id !== targetUid),
      }));
    } catch (error) {
      console.error('unblockUser error:', error);
      throw error;
    }
  },

  getFollowStatus: (targetUid: string) => {
    // DERIVED from live state — no more stale cache. Subscriptions on
    // follows + outgoingRequests keep these arrays current; this function
    // is always correct without any cache invalidation dance.
    const { following, outgoingRequests, followStatusCache } = get();
    if (following.some((f) => f.uid === targetUid)) return 'following';
    if (outgoingRequests.some((r) => r.toUid === targetUid && r.status === 'pending'))
      return 'pending_outgoing';
    // Fall back to explicit cache entry if present (set by loadFollowStatus
    // for users whose profiles we visit before subscriptions have loaded).
    return followStatusCache[targetUid] ?? 'none';
  },

  isBlocked: (targetUid: string) => {
    return get().blockedUids.includes(targetUid);
  },

  loadFollowStatus: async (targetUid: string) => {
    const uid = useAuthStore.getState().user?.uid;
    if (!uid) return;

    try {
      const status = await SocialService.getFollowStatus(uid, targetUid);
      set((state) => ({
        followStatusCache: { ...state.followStatusCache, [targetUid]: status },
      }));
    } catch (error) {
      console.error('loadFollowStatus error:', error);
    }
  },

  loadNotifications: async () => {
    const uid = useAuthStore.getState().user?.uid;
    if (!uid) return;

    set({ isLoadingNotifs: true });
    try {
      const [notifications, unreadCount] = await Promise.all([
        SocialService.getNotifications(uid),
        SocialService.getUnreadCount(uid),
      ]);
      set({ notifications, unreadCount });
    } catch (error) {
      console.error('loadNotifications error:', error);
    } finally {
      set({ isLoadingNotifs: false });
    }
  },

  markRead: async (notifId: string) => {
    const uid = useAuthStore.getState().user?.uid;
    if (!uid) return;

    try {
      await SocialService.markNotificationRead(uid, notifId);
      set((state) => {
        const notif = state.notifications.find((n) => n.id === notifId);
        const wasUnread = notif && !notif.read;
        return {
          notifications: state.notifications.map((n) =>
            n.id === notifId ? { ...n, read: true } : n
          ),
          unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
        };
      });
    } catch (error) {
      console.error('markRead error:', error);
    }
  },

  markAllRead: async () => {
    const uid = useAuthStore.getState().user?.uid;
    if (!uid) return;

    try {
      await SocialService.markAllNotificationsRead(uid);
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      }));
    } catch (error) {
      console.error('markAllRead error:', error);
    }
  },

  subscribeAll: (uid: string) => {
    // Re-subscribing for the same uid is a no-op (idempotent).
    if (_subs.uid === uid && _subs.unsubs.length > 0) {
      return () => tearDownSubs();
    }
    // Different uid or first subscribe: tear down anything stale first.
    tearDownSubs();

    const unsubs: Array<Unsubscribe | null | undefined> = [];

    unsubs.push(
      SocialService.subscribeNotifications(uid, (notifications) => {
        const unreadCount = notifications.filter((n) => !n.read).length;
        set({ notifications, unreadCount });
      }),
    );
    unsubs.push(
      SocialService.subscribeFollowers(uid, (followers) => {
        set({ followers, followersCount: followers.length });
      }),
    );
    unsubs.push(
      SocialService.subscribeFollowing(uid, (following) => {
        set({ following, followingCount: following.length });
      }),
    );
    unsubs.push(
      SocialService.subscribeIncomingRequests(uid, (incomingRequests) => {
        set({ incomingRequests });
      }),
    );
    unsubs.push(
      SocialService.subscribeOutgoingRequests(uid, (outgoingRequests) => {
        set({ outgoingRequests });
      }),
    );

    _subs = { uid, unsubs };
    return () => tearDownSubs();
  },

  unsubscribeAll: () => {
    tearDownSubs();
  },

  syncPublicProfile: async () => {
    const uid = useAuthStore.getState().user?.uid;
    if (!uid) return;

    const { motherName, photoUrl, bio, expertise, profile, parentGender } =
      useProfileStore.getState();
    const { followersCount, followingCount } = get();

    const roleLabel = parentGender === 'mother' ? 'Maa' : parentGender === 'father' ? 'Dad' : 'Parent';
    const badge = profile?.state
      ? `${roleLabel} · ${profile.state}`
      : roleLabel !== 'Parent' ? roleLabel : 'Community Member';

    const postsCount = useCommunityStore.getState().posts.filter(
      (p) => p.authorUid === uid
    ).length;

    try {
      await SocialService.upsertPublicProfile(uid, {
        uid,
        name: motherName,
        photoUrl: photoUrl || '',
        bio,
        expertise,
        state: profile?.state,
        parentGender,
        badge,
        followersCount,
        followingCount,
        postsCount,
      });
    } catch (error) {
      console.error('syncPublicProfile error:', error);
    }
  },

  reset: () => {
    // Always tear down listeners on sign-out so the previous user's
    // Firestore streams don't hold open or leak into the next session.
    tearDownSubs();
    set(initialState);
  },
}));
