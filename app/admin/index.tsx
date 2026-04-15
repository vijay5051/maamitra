import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuthStore } from '../../store/useAuthStore';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AdminStats {
  totalUsers: number;
  totalPosts: number;
  postsToday: number;
  pendingApproval?: number;
}

interface RecentPost {
  id: string;
  author: string;
  text: string;
  topic: string;
  createdAt: string;
  approved: boolean;
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <View style={styles.statCard}>
      <View style={[styles.skeletonLine, { width: 40, height: 28, marginBottom: 6 }]} />
      <View style={[styles.skeletonLine, { width: 70, height: 12 }]} />
    </View>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ value, label, icon }: { value: number; label: string; icon: string }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon as any} size={20} color="#ec4899" style={{ marginBottom: 4 }} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Quick Action Button ──────────────────────────────────────────────────────

function QuickAction({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.quickActionIcon}>
        <Ionicons name={icon as any} size={22} color="#ec4899" />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ approved }: { approved: boolean }) {
  return (
    <View style={[styles.badge, approved ? styles.badgeApproved : styles.badgePending]}>
      <Text style={[styles.badgeText, approved ? styles.badgeTextApproved : styles.badgeTextPending]}>
        {approved ? 'Approved' : 'Pending'}
      </Text>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { user, signOut } = useAuthStore();
  const router = useRouter();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [loading, setLoading] = useState(true);

  const firebaseProjectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  const firebaseConsoleUrl = firebaseProjectId
    ? `https://console.firebase.google.com/project/${firebaseProjectId}`
    : 'https://console.firebase.google.com';

  useEffect(() => {
    fetchAdminData();
  }, []);

  async function fetchAdminData() {
    setLoading(true);
    try {
      // Dynamically import to avoid crashing if Firebase is not configured
      const { getAdminStats, getContent } = await import('../../services/firebase');
      const [statsData, posts] = await Promise.all([
        getAdminStats(),
        getContent('community'),
      ]);
      setStats(statsData as AdminStats);
      const sorted = (posts as RecentPost[])
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);
      setRecentPosts(sorted);
    } catch {
      // Firebase not configured — show placeholder data
      setStats({ totalUsers: 0, totalPosts: 0, postsToday: 0 } as AdminStats);
      setRecentPosts([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(tabs)/chat');
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Admin Panel 🛡️</Text>
        <Text style={styles.subtitle}>{user?.email ?? 'admin'}</Text>
      </View>

      {/* Stats */}
      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.statsRow}>
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard value={stats?.totalUsers ?? 0} label="Total Users" icon="people-outline" />
            <StatCard value={stats?.totalPosts ?? 0} label="Total Posts" icon="chatbubbles-outline" />
            <StatCard
              value={stats?.pendingApproval ?? 0}
              label="Pending"
              icon="time-outline"
            />
          </>
        )}
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActionsGrid}>
        <QuickAction
          label="Edit Content 📝"
          icon="document-text-outline"
          onPress={() => router.push('/admin/content')}
        />
        <QuickAction
          label="App Settings ⚙️"
          icon="settings-outline"
          onPress={() => router.push('/admin/settings')}
        />
        <QuickAction
          label="Moderate Community 👥"
          icon="shield-checkmark-outline"
          onPress={() => router.push('/admin/community')}
        />
        <QuickAction
          label="Firebase Console 🔗"
          icon="open-outline"
          onPress={() => Linking.openURL(firebaseConsoleUrl)}
        />
      </View>

      {/* Recent Activity */}
      <Text style={styles.sectionTitle}>Recent Posts</Text>
      {loading ? (
        <ActivityIndicator color="#ec4899" style={{ marginVertical: 16 }} />
      ) : recentPosts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={32} color="#d1d5db" />
          <Text style={styles.emptyText}>No posts yet</Text>
        </View>
      ) : (
        recentPosts.map((post) => (
          <View key={post.id} style={styles.postCard}>
            <View style={styles.postHeader}>
              <Text style={styles.postAuthor}>{post.author}</Text>
              <StatusBadge approved={post.approved} />
            </View>
            <Text style={styles.postText} numberOfLines={2}>
              {post.text}
            </Text>
            <View style={styles.postMeta}>
              <Text style={styles.postTopic}>{post.topic}</Text>
              <Text style={styles.postTime}>
                {post.createdAt ? new Date(post.createdAt).toLocaleDateString('en-IN') : ''}
              </Text>
            </View>
          </View>
        ))
      )}

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
        <Ionicons name="log-out-outline" size={18} color="#ef4444" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 40 },

  header: {
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  title: { fontSize: 26, fontWeight: '800', color: '#1a1a2e' },
  subtitle: { fontSize: 13, color: '#9ca3af', marginTop: 2 },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 12,
    marginTop: 8,
  },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: '#fdf6ff',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0e6ff',
  },
  statValue: { fontSize: 22, fontWeight: '800', color: '#1a1a2e' },
  statLabel: { fontSize: 10, color: '#9ca3af', marginTop: 2, textAlign: 'center' },

  skeletonLine: { backgroundColor: '#f3f4f6', borderRadius: 6 },

  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  quickAction: {
    width: '47%',
    backgroundColor: '#fdf6ff',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0e6ff',
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fce7f3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a2e',
    textAlign: 'center',
  },

  postCard: {
    backgroundColor: '#fdf6ff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f0e6ff',
  },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  postAuthor: { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  postText: { fontSize: 13, color: '#4b5563', lineHeight: 18 },
  postMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  postTopic: { fontSize: 11, color: '#ec4899', fontWeight: '600' },
  postTime: { fontSize: 11, color: '#9ca3af' },

  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeApproved: { backgroundColor: '#d1fae5' },
  badgePending: { backgroundColor: '#fef3c7' },
  badgeText: { fontSize: 10, fontWeight: '700' },
  badgeTextApproved: { color: '#065f46' },
  badgeTextPending: { color: '#92400e' },

  emptyState: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { color: '#9ca3af', marginTop: 8, fontSize: 14 },

  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fee2e2',
    backgroundColor: '#fff5f5',
  },
  signOutText: { fontSize: 14, fontWeight: '700', color: '#ef4444' },
});
