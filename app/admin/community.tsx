import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ─── Types ───────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'pending' | 'approved';

interface CommunityPost {
  id: string;
  author: string;
  authorEmail?: string;
  text: string;
  topic: string;
  createdAt: string;
  approved: boolean;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ approved }: { approved: boolean }) {
  return (
    <View style={[styles.badge, approved ? styles.badgeApproved : styles.badgePending]}>
      <View style={[styles.badgeDot, approved ? styles.badgeDotApproved : styles.badgeDotPending]} />
      <Text style={[styles.badgeText, approved ? styles.badgeTextApproved : styles.badgeTextPending]}>
        {approved ? 'Approved' : 'Pending'}
      </Text>
    </View>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({
  post,
  onApprove,
  onDelete,
}: {
  post: CommunityPost;
  onApprove: () => void;
  onDelete: () => void;
}) {
  const dateStr = post.createdAt
    ? new Date(post.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

  return (
    <View style={styles.postCard}>
      {/* Header */}
      <View style={styles.postHeader}>
        <View style={styles.postAuthorBlock}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{post.author?.charAt(0)?.toUpperCase() ?? 'U'}</Text>
          </View>
          <View>
            <Text style={styles.postAuthor}>{post.author}</Text>
            {post.authorEmail ? (
              <Text style={styles.postAuthorEmail}>{post.authorEmail}</Text>
            ) : null}
          </View>
        </View>
        <StatusBadge approved={post.approved} />
      </View>

      {/* Text */}
      <Text style={styles.postText} numberOfLines={3}>
        {post.text}
      </Text>

      {/* Meta */}
      <View style={styles.postMeta}>
        <View style={styles.topicChip}>
          <Text style={styles.topicText}>{post.topic}</Text>
        </View>
        <Text style={styles.postDate}>{dateStr}</Text>
      </View>

      {/* Actions */}
      <View style={styles.postActions}>
        {!post.approved && (
          <TouchableOpacity style={styles.approveBtn} onPress={onApprove} activeOpacity={0.8}>
            <Ionicons name="checkmark" size={14} color="#fff" />
            <Text style={styles.approveBtnText}>Approve</Text>
          </TouchableOpacity>
        )}
        {post.approved && (
          <View style={styles.approvedTag}>
            <Ionicons name="checkmark-circle" size={14} color="#10b981" />
            <Text style={styles.approvedTagText}>Live</Text>
          </View>
        )}
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} activeOpacity={0.8}>
          <Ionicons name="trash" size={14} color="#fff" />
          <Text style={styles.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Filter Tab ───────────────────────────────────────────────────────────────

function FilterTabBtn({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.filterTab, active && styles.filterTabActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>{label}</Text>
      <View style={[styles.filterCount, active && styles.filterCountActive]}>
        <Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>{count}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminCommunity() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPosts();
  }, []);

  async function loadPosts(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const { getContent } = await import('../../services/firebase');
      const data = await getContent('community');
      const sorted = (data as CommunityPost[]).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setPosts(sorted);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleApprove(post: CommunityPost) {
    try {
      const { updateContent } = await import('../../services/firebase');
      await updateContent('community', post.id, { ...post, approved: true });
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, approved: true } : p))
      );
    } catch {
      Alert.alert('Error', 'Failed to approve post.');
    }
  }

  function handleDelete(post: CommunityPost) {
    Alert.alert(
      'Delete Post',
      `Delete this post by "${post.author}"?\n\n"${post.text.slice(0, 80)}..."`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { deleteContent } = await import('../../services/firebase');
              await deleteContent('community', post.id);
              setPosts((prev) => prev.filter((p) => p.id !== post.id));
            } catch {
              Alert.alert('Error', 'Failed to delete post.');
            }
          },
        },
      ]
    );
  }

  const totalCount = posts.length;
  const pendingCount = posts.filter((p) => !p.approved).length;
  const approvedCount = posts.filter((p) => p.approved).length;

  const filteredPosts = posts.filter((p) => {
    if (filter === 'pending') return !p.approved;
    if (filter === 'approved') return p.approved;
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        <FilterTabBtn
          label="All"
          count={totalCount}
          active={filter === 'all'}
          onPress={() => setFilter('all')}
        />
        <FilterTabBtn
          label="Pending"
          count={pendingCount}
          active={filter === 'pending'}
          onPress={() => setFilter('pending')}
        />
        <FilterTabBtn
          label="Approved"
          count={approvedCount}
          active={filter === 'approved'}
          onPress={() => setFilter('approved')}
        />
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#ec4899" size="large" />
          <Text style={styles.loadingText}>Loading posts...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadPosts(true)}
              tintColor="#ec4899"
              colors={['#ec4899']}
            />
          }
        >
          {filteredPosts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color="#e5e7eb" />
              <Text style={styles.emptyTitle}>No posts here</Text>
              <Text style={styles.emptySubtitle}>
                {filter === 'pending'
                  ? 'All caught up! No posts awaiting approval.'
                  : filter === 'approved'
                  ? 'No approved posts yet.'
                  : 'No community posts found.'}
              </Text>
            </View>
          ) : (
            filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onApprove={() => handleApprove(post)}
                onDelete={() => handleDelete(post)}
              />
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },

  filterBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  filterTabActive: { backgroundColor: '#fce7f3' },
  filterTabText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  filterTabTextActive: { color: '#ec4899' },
  filterCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  filterCountActive: { backgroundColor: '#fbcfe8' },
  filterCountText: { fontSize: 11, fontWeight: '700', color: '#6b7280' },
  filterCountTextActive: { color: '#be185d' },

  list: { flex: 1 },
  listContent: { padding: 16, gap: 12 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#9ca3af', fontSize: 14 },

  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a2e' },
  emptySubtitle: { fontSize: 14, color: '#9ca3af', textAlign: 'center', paddingHorizontal: 30 },

  postCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.05)',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  postAuthorBlock: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fce7f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '800', color: '#ec4899' },
  postAuthor: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  postAuthorEmail: { fontSize: 11, color: '#9ca3af' },

  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeApproved: { backgroundColor: '#d1fae5' },
  badgePending: { backgroundColor: '#fef3c7' },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeDotApproved: { backgroundColor: '#10b981' },
  badgeDotPending: { backgroundColor: '#f59e0b' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeTextApproved: { color: '#065f46' },
  badgeTextPending: { color: '#92400e' },

  postText: { fontSize: 14, color: '#374151', lineHeight: 20, marginBottom: 10 },

  postMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  topicChip: { backgroundColor: '#fdf6ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: '#f0e6ff' },
  topicText: { fontSize: 11, fontWeight: '600', color: '#8b5cf6' },
  postDate: { fontSize: 11, color: '#9ca3af' },

  postActions: { flexDirection: 'row', gap: 10 },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10b981',
    paddingVertical: 10,
    borderRadius: 10,
  },
  approveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  approvedTag: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#d1fae5',
    paddingVertical: 10,
    borderRadius: 10,
  },
  approvedTagText: { color: '#065f46', fontSize: 13, fontWeight: '700' },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ef4444',
    paddingVertical: 10,
    borderRadius: 10,
  },
  deleteBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
