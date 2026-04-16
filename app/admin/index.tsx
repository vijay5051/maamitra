/**
 * Admin Dashboard — MaaMitra
 * Overview: stats, recent activity, quick actions to all management sections.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/useAuthStore';

interface Stats {
  totalUsers: number;
  totalPosts: number;
  postsToday: number;
  pendingApproval: number;
  totalContent: number;
}

interface RecentPost {
  id: string;
  authorName?: string;
  author?: string;
  text: string;
  topic: string;
  createdAt: any;
  approved: boolean;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ value, label, icon, color }: { value: number; label: string; icon: string; color: string }) {
  return (
    <View style={[s.statCard, { borderTopColor: color, borderTopWidth: 3 }]}>
      <Ionicons name={icon as any} size={18} color={color} style={{ marginBottom: 4 }} />
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Quick Action ─────────────────────────────────────────────────────────────

function QuickAction({ label, icon, color, onPress }: { label: string; icon: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.quickAction} onPress={onPress} activeOpacity={0.75}>
      <View style={[s.qaIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={s.qaLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
    </TouchableOpacity>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { user, signOut } = useAuthStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalPosts: 0, postsToday: 0, pendingApproval: 0, totalContent: 0 });
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    await fetchData();
    setLoading(false);
  }

  async function refresh() {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }

  async function fetchData() {
    try {
      const fb = await import('../../services/firebase');
      const [statsData, posts, books, articles, products] = await Promise.all([
        fb.getAdminStats(),
        fb.getAllCommunityPosts(),
        fb.getContent('books'),
        fb.getContent('articles'),
        fb.getContent('products'),
      ]);
      const pending = posts.filter((p: any) => !p.approved).length;
      setStats({
        totalUsers: statsData.totalUsers,
        totalPosts: statsData.totalPosts,
        postsToday: statsData.postsToday,
        pendingApproval: pending,
        totalContent: books.length + articles.length + products.length,
      });
      setRecentPosts(posts.slice(0, 8));
    } catch {
      // Firebase not configured
    }
  }

  async function approvePost(postId: string) {
    setApprovingId(postId);
    try {
      const { approveCommunityPost } = await import('../../services/firebase');
      await approveCommunityPost(postId);
      setRecentPosts((prev) => prev.map((p) => p.id === postId ? { ...p, approved: true } : p));
      setStats((s) => ({ ...s, pendingApproval: Math.max(0, s.pendingApproval - 1) }));
    } catch {}
    setApprovingId(null);
  }

  async function deletePost(postId: string) {
    Alert.alert('Delete Post', 'Permanently delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setDeletingId(postId);
          try {
            const { deleteCommunityPost } = await import('../../services/firebase');
            await deleteCommunityPost(postId);
            setRecentPosts((prev) => prev.filter((p) => p.id !== postId));
            setStats((s) => ({ ...s, totalPosts: Math.max(0, s.totalPosts - 1) }));
          } catch {}
          setDeletingId(null);
        },
      },
    ]);
  }

  function handleSignOut() {
    Alert.alert('Sign Out', 'Sign out of admin panel?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(tabs)/chat'); } },
    ]);
  }

  const formatDate = (val: any) => {
    if (!val) return '';
    const d = val?.toDate ? val.toDate() : new Date(val);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#ec4899" />}
    >
      {/* Header */}
      <LinearGradient colors={['#fdf2f8', '#ede9fe']} style={[s.header, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.headerTitle}>Admin Panel 🛡️</Text>
            <Text style={s.headerSub}>{user?.email}</Text>
          </View>
          <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Stats */}
      {loading ? (
        <ActivityIndicator color="#ec4899" style={{ marginVertical: 24 }} />
      ) : (
        <View style={s.statsGrid}>
          <StatCard value={stats.totalUsers}     label="Users"     icon="people-outline"         color="#8b5cf6" />
          <StatCard value={stats.totalPosts}     label="Posts"     icon="chatbubbles-outline"     color="#ec4899" />
          <StatCard value={stats.pendingApproval} label="Pending"  icon="time-outline"            color="#f59e0b" />
          <StatCard value={stats.postsToday}     label="Today"     icon="today-outline"           color="#10b981" />
          <StatCard value={stats.totalContent}   label="Content"   icon="library-outline"         color="#06b6d4" />
        </View>
      )}

      {/* Quick Actions */}
      <Text style={s.sectionTitle}>Manage</Text>
      <View style={s.card}>
        <QuickAction label="Users"          icon="people-outline"           color="#8b5cf6" onPress={() => router.push('/admin/users')} />
        <View style={s.divider} />
        <QuickAction label="Community Posts" icon="chatbubbles-outline"     color="#ec4899" onPress={() => router.push('/admin/community')} />
        <View style={s.divider} />
        <QuickAction label="Content Library" icon="library-outline"         color="#06b6d4" onPress={() => router.push('/admin/content')} />
        <View style={s.divider} />
        <QuickAction label="Vaccines"        icon="medkit-outline"           color="#10b981" onPress={() => router.push('/admin/vaccines')} />
        <View style={s.divider} />
        <QuickAction label="App Settings"    icon="settings-outline"         color="#6b7280" onPress={() => router.push('/admin/settings')} />
        <View style={s.divider} />
        <QuickAction label="Push Notifications" icon="notifications-outline" color="#f59e0b" onPress={() => router.push('/admin/notifications')} />
      </View>

      {/* Pending Posts */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Recent Activity</Text>
        {stats.pendingApproval > 0 && (
          <View style={s.pendingBadge}>
            <Text style={s.pendingBadgeText}>{stats.pendingApproval} pending</Text>
          </View>
        )}
      </View>

      {loading ? null : recentPosts.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="chatbubbles-outline" size={32} color="#d1d5db" />
          <Text style={s.emptyText}>No posts yet</Text>
        </View>
      ) : (
        recentPosts.map((post) => {
          const author = post.authorName ?? post.author ?? 'Unknown';
          const isDeletingThis = deletingId === post.id;
          const isApprovingThis = approvingId === post.id;

          return (
            <View key={post.id} style={s.postCard}>
              <View style={s.postHeader}>
                <View style={s.postAuthorRow}>
                  <View style={s.authorDot} />
                  <Text style={s.postAuthor}>{author}</Text>
                  <Text style={s.postDate}>{formatDate(post.createdAt)}</Text>
                </View>
                <View style={[s.statusBadge, post.approved ? s.badgeApproved : s.badgePending]}>
                  <Text style={[s.statusText, post.approved ? s.badgeTextApproved : s.badgeTextPending]}>
                    {post.approved ? 'Approved' : 'Pending'}
                  </Text>
                </View>
              </View>

              <Text style={s.postText} numberOfLines={2}>{post.text}</Text>
              <Text style={s.postTopic}>{post.topic}</Text>

              <View style={s.postActions}>
                {!post.approved && (
                  <TouchableOpacity
                    style={s.approveBtn}
                    onPress={() => approvePost(post.id)}
                    disabled={isApprovingThis}
                    activeOpacity={0.8}
                  >
                    {isApprovingThis
                      ? <ActivityIndicator size="small" color="#16a34a" />
                      : <><Ionicons name="checkmark-circle-outline" size={14} color="#16a34a" /><Text style={s.approveBtnText}>Approve</Text></>
                    }
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={s.deletePostBtn}
                  onPress={() => deletePost(post.id)}
                  disabled={isDeletingThis}
                  activeOpacity={0.8}
                >
                  {isDeletingThis
                    ? <ActivityIndicator size="small" color="#ef4444" />
                    : <><Ionicons name="trash-outline" size={14} color="#ef4444" /><Text style={s.deletePostBtnText}>Delete</Text></>
                  }
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      <TouchableOpacity style={s.viewAllBtn} onPress={() => router.push('/admin/community')} activeOpacity={0.75}>
        <Text style={s.viewAllText}>View all posts →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  content: { paddingBottom: 32 },

  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1a1a2e' },
  headerSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  signOutBtn: { padding: 10, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 10 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16 },
  statCard: {
    flex: 1, minWidth: '28%', backgroundColor: '#fff',
    borderRadius: 14, padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#f3f4f6',
  },
  statValue: { fontSize: 22, fontWeight: '800', color: '#1a1a2e' },
  statLabel: { fontSize: 10, color: '#9ca3af', fontWeight: '600', marginTop: 2 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10, gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a2e', paddingHorizontal: 16, marginBottom: 10, marginTop: 8 },
  pendingBadge: { backgroundColor: '#fef3c7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  pendingBadgeText: { fontSize: 11, fontWeight: '700', color: '#d97706' },

  card: { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6', marginBottom: 8 },
  divider: { height: 1, backgroundColor: '#f9fafb', marginLeft: 54 },

  quickAction: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  qaIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  qaLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1a1a2e' },

  postCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginHorizontal: 16, marginBottom: 8,
    borderWidth: 1, borderColor: '#f3f4f6',
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  postAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  authorDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#ec4899' },
  postAuthor: { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  postDate: { fontSize: 11, color: '#9ca3af' },
  postText: { fontSize: 13, color: '#4b5563', lineHeight: 19, marginBottom: 6 },
  postTopic: { fontSize: 11, color: '#8b5cf6', fontWeight: '700', marginBottom: 8 },

  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeApproved: { backgroundColor: '#dcfce7' },
  badgePending: { backgroundColor: '#fef3c7' },
  statusText: { fontSize: 11, fontWeight: '700' },
  badgeTextApproved: { color: '#16a34a' },
  badgeTextPending: { color: '#d97706' },

  postActions: { flexDirection: 'row', gap: 8 },
  approveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(22,163,74,0.08)', borderRadius: 8,
    paddingVertical: 7, paddingHorizontal: 12,
    borderWidth: 1, borderColor: 'rgba(22,163,74,0.2)',
  },
  approveBtnText: { fontSize: 13, color: '#16a34a', fontWeight: '700' },
  deletePostBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(239,68,68,0.06)', borderRadius: 8,
    paddingVertical: 7, paddingHorizontal: 12,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)',
  },
  deletePostBtnText: { fontSize: 13, color: '#ef4444', fontWeight: '700' },

  viewAllBtn: { marginHorizontal: 16, marginTop: 4, alignItems: 'center', paddingVertical: 12 },
  viewAllText: { fontSize: 14, color: '#8b5cf6', fontWeight: '700' },

  empty: { alignItems: 'center', padding: 32, gap: 8 },
  emptyText: { fontSize: 14, color: '#9ca3af' },
});
