import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import GradientAvatar from '../ui/GradientAvatar';
import UserPostsSheet from './UserPostsSheet';
import { Fonts } from '../../constants/theme';
import { useAuthStore } from '../../store/useAuthStore';
import { useSocialStore } from '../../store/useSocialStore';
import {
  type CommunityPost,
  type UserPublicProfile,
  type FollowEntry,
  getPublicProfile,
  fetchUserPosts,
  isEitherBlocked,
} from '../../services/social';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  uid: string;
  visible: boolean;
  onClose: () => void;
  onEditProfile?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Map FollowEntry (social graph list) → UserPublicProfile shape for FollowListModal */
function followEntriesToProfiles(entries: FollowEntry[]): UserPublicProfile[] {
  return entries.map((e) => ({
    uid: e.uid,
    name: e.name,
    photoUrl: e.photoUrl ?? '',
    badge: '',
    bio: '',
    state: '',
    expertise: [],
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
    visibility: {},
  } as UserPublicProfile));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface FollowListModalProps {
  visible: boolean;
  title: string;
  items: UserPublicProfile[];
  onClose: () => void;
  onViewProfile: (uid: string) => void;
}

function FollowListModal({ visible, title, items, onClose, onViewProfile }: FollowListModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={innerStyles.followListOverlay}>
        <View style={innerStyles.followListContainer}>
          <View style={innerStyles.followListHeader}>
            <Text style={innerStyles.followListTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color="#1C1033" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={items}
            keyExtractor={(item) => item.uid}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={innerStyles.followListRow}
                onPress={() => {
                  onClose();
                  onViewProfile(item.uid);
                }}
              >
                {item.photoUrl ? (
                  <Image
                    source={{ uri: item.photoUrl }}
                    style={innerStyles.followListAvatar}
                  />
                ) : (
                  <GradientAvatar name={item.name} size={40} />
                )}
                <Text style={innerStyles.followListName}>{item.name}</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        </View>
      </View>
    </Modal>
  );
}

const innerStyles = StyleSheet.create({
  followListOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  followListContainer: {
    backgroundColor: '#FFF8FC',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
    paddingTop: 16,
  },
  followListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE9F6',
  },
  followListTitle: {
    fontSize: 17,
    fontFamily: Fonts.sansSemiBold,
    color: '#1C1033',
  },
  followListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  followListAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  followListName: {
    fontSize: 15,
    fontFamily: Fonts.sansMedium,
    color: '#1C1033',
  },
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UserProfileModal({ uid, visible, onClose, onEditProfile }: Props) {
  const { user } = useAuthStore();
  const myUid = user?.uid ?? '';
  const router = useRouter();

  const {
    followers,
    following,
    outgoingRequests,
    followersCount,
    followingCount,
    syncPublicProfile,
    sendFollowRequest,
    cancelRequest,
    unfollow,
    blockUser,
    unblockUser,
    isBlocked,
    getFollowStatus,
    loadFollowStatus,
  } = useSocialStore();

  const [profile, setProfile] = useState<UserPublicProfile | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [followStatus, setFollowStatus] = useState<'none' | 'pending_outgoing' | 'following'>('none');
  const [isLoading, setIsLoading] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showFollowersList, setShowFollowersList] = useState(false);
  const [showPostsSheet, setShowPostsSheet] = useState(false);
  const [showFollowingList, setShowFollowingList] = useState(false);
  const [followListTarget, setFollowListTarget] = useState<'followers' | 'following'>('followers');

  // Nested profile navigation — track a secondary UID to push another modal
  const [nestedUid, setNestedUid] = useState<string | null>(null);
  const [nestedVisible, setNestedVisible] = useState(false);

  const isOwnProfile = uid === myUid;
  const blocked = isBlocked(uid);
  const [blockedByThem, setBlockedByThem] = useState(false);

  useEffect(() => {
    if (!visible || !uid || !myUid || isOwnProfile) return;
    isEitherBlocked(myUid, uid).then(setBlockedByThem);
  }, [visible, uid, myUid]);

  useEffect(() => {
    if (!visible || !uid) return;

    let cancelled = false;
    setIsLoading(true);
    setProfile(null);
    setPosts([]);
    setFollowStatus('none');

    Promise.all([
      getPublicProfile(uid),
      fetchUserPosts(uid),
      loadFollowStatus(uid),
    ]).then(([prof, userPosts]) => {
      if (cancelled) return;
      setProfile(prof);
      // Filter followers-only posts if I don't follow this user (and it's not me)
      const status = getFollowStatus(uid);
      const filteredPosts = (userPosts ?? []).filter((p: any) => {
        if (uid === myUid) return true;
        if (!p.authorFollowersOnly) return true;
        return status === 'following';
      });
      setPosts(filteredPosts);
      setFollowStatus(status);
      setIsLoading(false);

      // Sync own public profile if viewing own page (uses store action)
      if (uid === myUid) {
        syncPublicProfile?.().catch?.(() => {});
      }
    }).catch(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [uid, visible]);

  // Keep followStatus in sync when store changes
  useEffect(() => {
    if (visible && uid) {
      setFollowStatus(getFollowStatus(uid));
    }
  }, [followers, following, outgoingRequests, uid, visible]);

  const handleFollowPress = useCallback(() => {
    if (!profile) return;
    if (followStatus === 'none') {
      sendFollowRequest(uid, profile.name);
      setFollowStatus('pending_outgoing');
    } else if (followStatus === 'pending_outgoing') {
      const req = outgoingRequests?.find((r: any) => r.toUid === uid);
      if (req) {
        // cancelRequest is on the store
        cancelRequest(req.id, uid).catch(() => {});
        setFollowStatus('none');
      }
    } else if (followStatus === 'following') {
      Alert.alert(
        'Unfollow',
        `Unfollow ${profile.name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unfollow',
            style: 'destructive',
            onPress: () => {
              unfollow(uid);
              setFollowStatus('none');
            },
          },
        ]
      );
    }
  }, [followStatus, profile, uid, outgoingRequests, sendFollowRequest, unfollow]);

  const handleMessagePress = useCallback(() => {
    if (!uid || uid === myUid) return;
    onClose();
    router.push({ pathname: '/conversation/[uid]', params: { uid } });
  }, [uid, myUid, router, onClose]);

  const handleBlockPress = useCallback(() => {
    if (blocked) {
      Alert.alert(
        'Unblock User',
        `Unblock ${profile?.name ?? 'this user'}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unblock',
            onPress: () => unblockUser(uid),
          },
        ]
      );
    } else {
      Alert.alert(
        'Block User',
        `Block ${profile?.name ?? 'this user'}? They won't be able to see your posts or follow you.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: () => {
              blockUser(uid);
              onClose();
            },
          },
        ]
      );
    }
  }, [blocked, profile, uid, blockUser, unblockUser, onClose]);

  const openNestedProfile = useCallback((targetUid: string) => {
    setNestedUid(targetUid);
    setNestedVisible(true);
  }, []);

  const displayedFollowersCount = isOwnProfile ? (followers?.length ?? followersCount ?? 0) : (profile?.followersCount ?? 0);
  const displayedFollowingCount = isOwnProfile ? (following?.length ?? followingCount ?? 0) : (profile?.followingCount ?? 0);

  const renderFollowButton = () => {
    if (followStatus === 'following') {
      return (
        <TouchableOpacity style={styles.followButtonOutline} onPress={handleFollowPress}>
          <Text style={styles.followButtonOutlineText}>Following ✓</Text>
        </TouchableOpacity>
      );
    }
    if (followStatus === 'pending_outgoing') {
      return (
        <TouchableOpacity style={styles.followButtonGrey} onPress={handleFollowPress}>
          <Text style={styles.followButtonGreyText}>Requested</Text>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity onPress={handleFollowPress} style={{ flex: 1 }}>
        <LinearGradient
          colors={['#E8487A', '#7C3AED']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.followButtonGradient}
        >
          <Text style={styles.followButtonGradientText}>Follow</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderMessageButton = () => {
    const enabled = followStatus === 'following';
    if (enabled) {
      return (
        <TouchableOpacity onPress={handleMessagePress} style={{ flex: 1 }}>
          <LinearGradient
            colors={['#E8487A', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.messageButtonGradient}
          >
            <Text style={styles.followButtonGradientText}>Message 💬</Text>
          </LinearGradient>
        </TouchableOpacity>
      );
    }
    return (
      <View style={[styles.messageButtonGrey, { flex: 1 }]}>
        <Text style={styles.followButtonGreyText}>Message 💬</Text>
      </View>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#E8487A" />
        </View>
      );
    }
    if (!profile || (blockedByThem && !isOwnProfile)) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="person-outline" size={48} color="#9ca3af" />
          <Text style={styles.unavailableText}>{blockedByThem ? 'This profile is unavailable' : 'Profile not available'}</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Bio */}
        {!!profile.bio && (
          <View style={styles.section}>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        )}

        {/* Expertise chips */}
        {profile.expertise && profile.expertise.length > 0 && (
          <View style={styles.section}>
            <View style={styles.chipsRow}>
              {profile.expertise.map((tag: string) => (
                <View key={tag} style={styles.chip}>
                  <Text style={styles.chipText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Action buttons */}
        {!isOwnProfile && (
          <View style={styles.actionsRow}>
            {renderFollowButton()}
            {renderMessageButton()}
          </View>
        )}

        {isOwnProfile && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => {
                onClose();
                onEditProfile?.();
              }}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#E8487A', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.followButtonGradient}
              >
                <Text style={styles.followButtonGradientText}>Edit Profile</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Posts */}
        {posts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.sectionLabel}>Posts ({posts.length})</Text>
              <View style={styles.dividerLine} />
            </View>
            {posts.slice(0, 3).map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.miniPostCard}
                activeOpacity={0.75}
                onPress={() => setShowPostsSheet(true)}
              >
                <View style={styles.miniPostMeta}>
                  {!!p.topic && (
                    <View style={styles.miniTopicChip}>
                      <Text style={styles.miniTopicText}>{p.topic}</Text>
                    </View>
                  )}
                  <Text style={styles.miniPostTime}>{timeAgo(p.createdAt)}</Text>
                </View>
                <Text style={styles.miniPostText} numberOfLines={3}>{p.text}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => setShowPostsSheet(true)}
              activeOpacity={0.75}
              style={styles.seeAllBtn}
            >
              <Text style={styles.seeAllText}>
                See all {posts.length} posts & react →
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Block/Unblock */}
        {!isOwnProfile && (
          <View style={styles.blockSection}>
            <TouchableOpacity onPress={handleBlockPress}>
              <Text style={styles.blockText}>{blocked ? 'Unblock User' : 'Block User'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <View style={styles.container}>
          {/* Dark gradient hero header */}
          <LinearGradient
            colors={['#1C1033', '#3b1060', '#6d1a7a']}
            style={styles.header}
          >
            {/* Close button */}
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>

            {/* Profile identity */}
            <View style={styles.identityRow}>
              {/* Avatar */}
              <View style={styles.avatarWrapper}>
                {profile?.photoUrl ? (
                  <Image source={{ uri: profile.photoUrl }} style={styles.avatarImage} />
                ) : (
                  <GradientAvatar
                    name={profile?.name ?? uid}
                    size={80}
                    style={styles.avatarGradient}
                  />
                )}
              </View>

              {/* Name + badge */}
              <View style={styles.nameBlock}>
                <Text style={styles.nameText} numberOfLines={1}>
                  {profile?.name ?? '…'}
                </Text>
                {!!profile?.badge && (
                  <Text style={styles.badgeText} numberOfLines={1}>{profile.badge}</Text>
                )}
                {!!profile?.state && (
                  <Text style={styles.stateText} numberOfLines={1}>📍 {profile.state}</Text>
                )}
              </View>
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <TouchableOpacity
                style={styles.statBlock}
                onPress={() => setShowPostsSheet(true)}
              >
                <Text style={styles.statNumber}>{profile?.postsCount != null && profile.postsCount > 0 ? profile.postsCount : posts.length}</Text>
                <Text style={styles.statLabel}>posts</Text>
              </TouchableOpacity>
              <View style={styles.statSeparator} />
              <TouchableOpacity
                style={styles.statBlock}
                onPress={() => {
                  if (isOwnProfile) {
                    setFollowListTarget('followers');
                    setShowFollowersList(true);
                  }
                }}
                disabled={!isOwnProfile}
              >
                <Text style={styles.statNumber}>{displayedFollowersCount}</Text>
                <Text style={styles.statLabel}>followers</Text>
              </TouchableOpacity>
              <View style={styles.statSeparator} />
              <TouchableOpacity
                style={styles.statBlock}
                onPress={() => {
                  if (isOwnProfile) {
                    setFollowListTarget('following');
                    setShowFollowingList(true);
                  }
                }}
                disabled={!isOwnProfile}
              >
                <Text style={styles.statNumber}>{displayedFollowingCount}</Text>
                <Text style={styles.statLabel}>following</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Scrollable white content */}
          {renderContent()}
        </View>
      </Modal>

      {/* Followers list sheet */}
      <UserPostsSheet
        uid={uid}
        name={profile?.name}
        visible={showPostsSheet}
        onClose={() => setShowPostsSheet(false)}
      />

      <FollowListModal
        visible={showFollowersList}
        title="Followers"
        items={followEntriesToProfiles(followers ?? [])}
        onClose={() => setShowFollowersList(false)}
        onViewProfile={openNestedProfile}
      />

      {/* Following list sheet */}
      <FollowListModal
        visible={showFollowingList}
        title="Following"
        items={followEntriesToProfiles(following ?? [])}
        onClose={() => setShowFollowingList(false)}
        onViewProfile={openNestedProfile}
      />

      {/* Nested profile navigation */}
      {nestedUid && (
        <UserProfileModal
          uid={nestedUid}
          visible={nestedVisible}
          onClose={() => {
            setNestedVisible(false);
            setNestedUid(null);
          }}
        />
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8FC',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 16 : 24,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  closeButton: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  avatarWrapper: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 42,
    padding: 2,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarGradient: {
    // override size handled by prop
  },
  nameBlock: {
    flex: 1,
    gap: 4,
  },
  nameText: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    color: '#ffffff',
    lineHeight: 28,
  },
  badgeText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  stateText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingVertical: 12,
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statNumber: {
    fontFamily: Fonts.sansBold,
    fontSize: 20,
    color: '#ffffff',
  },
  statLabel: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statSeparator: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  scrollView: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 60,
  },
  unavailableText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 15,
    color: '#9ca3af',
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  bioText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 15,
    color: '#1C1033',
    lineHeight: 22,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  chipText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#7C3AED',
  },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  followButtonGradient: {
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followButtonGradientText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 15,
    color: '#ffffff',
  },
  followButtonOutline: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E8487A',
  },
  followButtonOutlineText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 15,
    color: '#E8487A',
  },
  followButtonGrey: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDE9F6',
  },
  followButtonGreyText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 15,
    color: '#9ca3af',
  },
  messageButtonGradient: {
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageButtonGrey: {
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDE9F6',
  },
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#EDE9F6',
  },
  sectionLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#9ca3af',
  },
  miniPostCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#E8487A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  miniPostMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  miniTopicChip: {
    backgroundColor: 'rgba(124,58,237,0.08)',
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  miniTopicText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    color: '#7C3AED',
  },
  miniPostTime: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: '#9ca3af',
  },
  miniPostText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#1C1033',
    lineHeight: 20,
  },
  seeAllBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  seeAllText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: '#E8487A',
  },
  blockSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  blockText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    color: '#ef4444',
  },
});
