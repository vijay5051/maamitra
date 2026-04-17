import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../../constants/theme';
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore } from '../../store/useProfileStore';
import { useCommunityStore, type Post } from '../../store/useCommunityStore';
import { useSocialStore } from '../../store/useSocialStore';
import {
  fetchUserPosts,
  type CommunityPost,
} from '../../services/social';
import PostCardComponent from './PostCard';

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  uid: string;
  name?: string;
  visible: boolean;
  onClose: () => void;
  onEditPost?: (post: Post) => void;
}

// ─── Convert Firestore CommunityPost → store Post shape ──────────────────────

function toStorePost(fs: CommunityPost): Post {
  return {
    id: fs.id,
    authorName: fs.authorName ?? '',
    authorInitial: (fs.authorName ?? '?').charAt(0).toUpperCase(),
    authorUid: fs.authorUid ?? '',
    authorPhotoUrl: (fs as any).authorPhotoUrl ?? undefined,
    badge: fs.badge ?? 'Community Member',
    topic: fs.topic ?? 'General',
    text: fs.text ?? '',
    imageUri: fs.imageUri,
    imageAspectRatio: fs.imageAspectRatio,
    imageEmoji: (fs as any).imageEmoji,
    imageCaption: (fs as any).imageCaption,
    reactions: fs.reactions ?? {},
    userReactions: [],
    reactionsByUser: fs.reactionsByUser ?? {},
    comments: [],
    commentList: [],
    commentCount: fs.commentCount ?? 0,
    createdAt: fs.createdAt instanceof Date ? fs.createdAt : new Date(fs.createdAt),
    showComments: false,
  };
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function UserPostsSheet({ uid, name, visible, onClose, onEditPost }: Props) {
  const { user } = useAuthStore();
  const myUid = user?.uid ?? '';
  const { motherName, photoUrl: myPhotoUrl } = useProfileStore();
  const { blockedUids } = useSocialStore();

  const {
    toggleReactionFirestore,
    addCommentFirestore,
    loadCommentsForPost,
    deletePostFirestore,
    deleteCommentFirestore,
    toggleComments,
  } = useCommunityStore();

  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!visible || !uid) return;
    let cancelled = false;
    setIsLoading(true);
    fetchUserPosts(uid)
      .then((fsPosts) => {
        if (cancelled) return;
        setPosts(fsPosts.map(toStorePost));
        setIsLoading(false);
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [uid, visible]);

  // Local state updates mirrored from the community store actions
  const handleReact = (postId: string, emoji: string) => {
    if (!myUid) return;
    // Optimistic local update
    setPosts((prev) => prev.map((p) => {
      if (p.id !== postId) return p;
      const reactions = { ...p.reactions };
      const myReactions = p.reactionsByUser?.[myUid] ?? [];
      const has = myReactions.includes(emoji);
      const nextMy = has ? myReactions.filter((e) => e !== emoji) : [...myReactions, emoji];
      reactions[emoji] = Math.max(0, (reactions[emoji] ?? 0) + (has ? -1 : 1));
      if (reactions[emoji] === 0) delete reactions[emoji];
      return {
        ...p,
        reactions,
        reactionsByUser: { ...(p.reactionsByUser ?? {}), [myUid]: nextMy },
        userReactions: nextMy,
      };
    }));
    toggleReactionFirestore(postId, myUid, motherName || 'Anonymous', emoji);
  };

  const handleToggleComments = (postId: string) => {
    setPosts((prev) => prev.map((p) =>
      p.id === postId ? { ...p, showComments: !p.showComments } : p
    ));
    const post = posts.find((p) => p.id === postId);
    if (post && !post.showComments && post.authorUid) {
      loadCommentsForPost(postId).then(() => {
        // Pull updated commentList from the community store
        const fresh = useCommunityStore.getState().posts.find((p) => p.id === postId);
        if (fresh?.commentList) {
          setPosts((prev) => prev.map((p) =>
            p.id === postId ? { ...p, commentList: fresh.commentList } : p
          ));
        }
      });
    }
    toggleComments(postId);
  };

  const handleAddComment = (postId: string, text: string) => {
    if (!myUid) return;
    addCommentFirestore(postId, myUid, motherName || 'Anonymous', text, myPhotoUrl || undefined)
      .then(() => {
        const fresh = useCommunityStore.getState().posts.find((p) => p.id === postId);
        if (fresh) {
          setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comments: fresh.comments, commentList: fresh.commentList, commentCount: fresh.commentCount } : p));
        }
      })
      .catch(() => {
        if (typeof window !== 'undefined') window.alert('Failed to post comment');
      });
  };

  const handleDeletePost = (postId: string) => {
    if (!myUid) return;
    deletePostFirestore(postId, myUid)
      .then(() => {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      })
      .catch(() => {
        Alert.alert('Error', 'Could not delete the post. Please try again.');
      });
  };

  const handleDeleteComment = (postId: string, commentId: string) => {
    deleteCommentFirestore(postId, commentId)
      .then(() => {
        setPosts((prev) => prev.map((p) => {
          if (p.id !== postId) return p;
          const newList = (p.commentList ?? []).filter((c) => c.id !== commentId);
          return { ...p, commentList: newList, commentCount: Math.max(0, (p.commentCount ?? 1) - 1) };
        }));
      })
      .catch(() => {
        Alert.alert('Error', 'Could not delete the comment.');
      });
  };

  const title = name ? `${name}'s posts` : 'Posts';
  const isOwnList = uid === myUid;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <LinearGradient colors={['#1C1033', '#3b1060', '#6d1a7a']} style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#E8487A" />
          </View>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <PostCardComponent
                post={item}
                currentUserUid={myUid}
                currentUserName={motherName}
                currentUserPhotoUrl={myPhotoUrl || undefined}
                blockedUids={blockedUids}
                onReact={handleReact}
                onToggleComments={handleToggleComments}
                onAddComment={handleAddComment}
                onViewProfile={() => {}}
                onDeletePost={isOwnList ? handleDeletePost : undefined}
                onEditPost={isOwnList && onEditPost ? (postId) => {
                  const p = posts.find((x) => x.id === postId);
                  if (p) onEditPost(p);
                } : undefined}
                onDeleteComment={myUid ? handleDeleteComment : undefined}
              />
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>📝</Text>
                <Text style={styles.emptyTitle}>No posts yet</Text>
                <Text style={styles.emptySubtext}>
                  {isOwnList ? 'Your posts will show up here.' : `${name ?? 'This user'} hasn't posted anything yet.`}
                </Text>
              </View>
            }
            contentContainerStyle={posts.length === 0 ? styles.emptyList : styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8FC' },
  header: {
    paddingTop: Platform.OS === 'ios' ? 16 : 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    color: '#ffffff',
    flex: 1,
    marginRight: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 12 },
  emptyList: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 17,
    color: '#1C1033',
    textAlign: 'center',
  },
  emptySubtext: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
});
