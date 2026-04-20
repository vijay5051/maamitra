/**
 * Admin Dashboard — MaaMitra
 *
 * Bird's-eye view of the whole app: user growth, feature adoption (per Health
 * sub-tab + wellness + community), signup trend, and community-vigilance
 * counters (pending posts, reported users, open support tickets). Tabs below
 * route to the dedicated management screens (users, community, content, etc.)
 * which stay as they are — this page is the "what's happening right now"
 * surface.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors } from '../../constants/theme';
import { getAnalyticsSnapshot, AnalyticsSnapshot, FeatureAdoption } from '../../services/analytics';
import { approveCommunityPost, deleteCommunityPost, getAllCommunityPosts } from '../../services/firebase';

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  value,
  label,
  sub,
  icon,
  tint,
}: {
  value: number | string;
  label: string;
  sub?: string;
  icon: string;
  tint: string;
}) {
  return (
    <View style={[s.statCard, { borderTopColor: tint }]}>
      <View style={[s.statIconWrap, { backgroundColor: `${tint}1A` }]}>
        <Ionicons name={icon as any} size={16} color={tint} />
      </View>
      <Text style={s.statValue}>{typeof value === 'number' ? value.toLocaleString('en-IN') : value}</Text>
      <Text style={s.statLabel}>{label}</Text>
      {sub ? <Text style={s.statSub}>{sub}</Text> : null}
    </View>
  );
}

// ─── Signup trend sparkline ──────────────────────────────────────────────────
// Pure-CSS bar chart (7 days). No external chart dep — keeps the admin bundle
// light and the visual simple enough to scan in a glance.

function SignupSparkline({ points }: { points: { day: string; count: number }[] }) {
  if (points.length === 0) return null;
  const max = Math.max(1, ...points.map((p) => p.count));
  return (
    <View style={s.sparkWrap}>
      {points.map((p) => {
        const h = Math.max(4, Math.round((p.count / max) * 54));
        const label = new Date(p.day + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' });
        return (
          <View key={p.day} style={s.sparkCol}>
            <Text style={s.sparkValue}>{p.count}</Text>
            <View style={[s.sparkBar, { height: h }]} />
            <Text style={s.sparkLabel}>{label[0]}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Feature adoption row ────────────────────────────────────────────────────

function AdoptionRow({ item, total }: { item: FeatureAdoption; total: number }) {
  const width = `${Math.min(100, item.pct)}%` as const;
  const color = item.group === 'health' ? '#8B5CF6'
               : item.group === 'wellness' ? '#14B8A6'
               : item.group === 'community' ? '#EC4899'
               : item.group === 'chat' ? '#F97316'
               : '#6366F1';
  return (
    <View style={s.adoptionRow}>
      <View style={[s.adoptionIcon, { backgroundColor: `${color}1A` }]}>
        <Ionicons name={item.icon as any} size={14} color={color} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={s.adoptionLabelRow}>
          <Text style={s.adoptionLabel}>{item.label}</Text>
          <Text style={s.adoptionStat}>
            {item.users} · {item.pct}%
          </Text>
        </View>
        <View style={s.adoptionBarTrack}>
          <View style={[s.adoptionBarFill, { width, backgroundColor: color }]} />
        </View>
      </View>
    </View>
  );
}

// ─── Admin nav tile ──────────────────────────────────────────────────────────

function NavTile({
  icon,
  label,
  sub,
  tint,
  onPress,
  badge,
}: {
  icon: string;
  label: string;
  sub: string;
  tint: string;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <TouchableOpacity style={s.navTile} onPress={onPress} activeOpacity={0.8}>
      <View style={[s.navIcon, { backgroundColor: `${tint}1A` }]}>
        <Ionicons name={icon as any} size={18} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.navLabel}>{label}</Text>
        <Text style={s.navSub} numberOfLines={1}>{sub}</Text>
      </View>
      {badge && badge > 0 ? (
        <View style={s.navBadge}>
          <Text style={s.navBadgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
      )}
    </TouchableOpacity>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { user, signOut } = useAuthStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Two-column grid on web ≥ 900px. The feature-adoption + vigilance blocks
  // sit side by side there; on mobile they stack.
  const wide = Platform.OS === 'web' && width >= 900;

  const [snap, setSnap] = useState<AnalyticsSnapshot | null>(null);
  const [pendingPosts, setPendingPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    await fetchAll();
    setLoading(false);
  }

  async function refresh() {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }

  async function fetchAll() {
    try {
      const [s, posts] = await Promise.all([
        getAnalyticsSnapshot(),
        getAllCommunityPosts().catch(() => []),
      ]);
      setSnap(s);
      setPendingPosts(posts.filter((p: any) => !p.approved).slice(0, 5));
    } catch {
      /* swallow — dashboard still renders with skeleton values */
    }
  }

  const onboardingPct = useMemo(() => {
    if (!snap || snap.totalUsers === 0) return 0;
    return Math.round((snap.onboardingComplete / snap.totalUsers) * 100);
  }, [snap]);

  function handleSignOut() {
    const doSignOut = async () => {
      await signOut();
      router.replace('/(auth)/welcome');
    };
    if (Platform.OS === 'web') {
      // Alert.alert() renders as a browser-blocking window.confirm on web,
      // which some setups swallow. Go straight to sign-out there.
      void doSignOut();
    } else {
      Alert.alert('Sign out', 'Sign out of the admin panel?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: doSignOut },
      ]);
    }
  }

  async function doApprove(id: string) {
    setActing(id);
    try {
      await approveCommunityPost(id);
      setPendingPosts((prev) => prev.filter((p) => p.id !== id));
      setSnap((s) => s ? { ...s, vigilance: { ...s.vigilance, pendingPosts: Math.max(0, s.vigilance.pendingPosts - 1) } } : s);
    } finally {
      setActing(null);
    }
  }

  async function doDelete(id: string) {
    const run = async () => {
      setActing(id);
      try {
        await deleteCommunityPost(id);
        setPendingPosts((prev) => prev.filter((p) => p.id !== id));
      } finally {
        setActing(null);
      }
    };
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && !window.confirm('Permanently delete this post?')) return;
      void run();
    } else {
      Alert.alert('Delete post', 'Permanently delete this post?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: run },
      ]);
    }
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} />}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <LinearGradient colors={['#F5F0FF', '#EDE4FF']} style={[s.header, { paddingTop: insets.top + 14 }]}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerEyebrow}>MaaMitra · Admin</Text>
            <Text style={s.headerTitle}>Dashboard</Text>
            <Text style={s.headerSub}>Signed in as {user?.email ?? 'admin'}</Text>
          </View>
          <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.85}>
            <Ionicons name="log-out-outline" size={16} color="#ef4444" />
            <Text style={s.signOutTxt}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <View style={[s.body, wide && s.bodyWide]}>
          {/* ── Stats grid ─────────────────────────────────────── */}
          <View style={[s.section, wide && { width: '100%' }]}>
            <Text style={s.sectionLabel}>At a glance</Text>
            <View style={s.statsGrid}>
              <StatCard value={snap?.totalUsers ?? 0}         label="Total users"     sub={`${onboardingPct}% onboarded`}                  icon="people-outline"           tint="#8B5CF6" />
              <StatCard value={snap?.activeToday ?? 0}        label="Active today"    sub={`${snap?.activeThisWeek ?? 0} this week`}       icon="radio-outline"            tint="#10B981" />
              <StatCard value={snap?.newSignups7d ?? 0}       label="New · 7d"        sub={`${snap?.newSignups30d ?? 0} in 30d`}           icon="person-add-outline"       tint={Colors.primary} />
              <StatCard value={snap?.vigilance.pendingPosts ?? 0} label="Pending posts" sub="Community approval queue"                     icon="time-outline"             tint="#F59E0B" />
              <StatCard value={snap?.vigilance.reportedUsers ?? 0} label="Reported users" sub={`${snap?.vigilance.reportedPosts ?? 0} posts flagged`} icon="shield-outline" tint="#EF4444" />
              <StatCard value={snap?.vigilance.openTickets ?? 0} label="Support"      sub="Open tickets"                                    icon="help-buoy-outline"        tint="#0EA5E9" />
            </View>
          </View>

          {/* ── Signup trend ───────────────────────────────────── */}
          <View style={[s.section, wide && s.colHalf]}>
            <Text style={s.sectionLabel}>Signups · last 7 days</Text>
            <View style={s.card}>
              <SignupSparkline points={snap?.signupTrend ?? []} />
              <View style={s.sparkFooter}>
                <Text style={s.sparkFooterText}>
                  {snap?.newSignups7d ?? 0} new accounts this week
                </Text>
                <Text style={s.sparkFooterText}>
                  {snap?.newSignups30d ?? 0} in last 30 days
                </Text>
              </View>
            </View>
          </View>

          {/* ── Top states ─────────────────────────────────────── */}
          <View style={[s.section, wide && s.colHalf]}>
            <Text style={s.sectionLabel}>Where users live</Text>
            <View style={s.card}>
              {snap?.topStates.length ? (
                snap.topStates.map((row) => (
                  <View key={row.state} style={s.stateRow}>
                    <Ionicons name="location-outline" size={14} color={Colors.primary} />
                    <Text style={s.stateName}>{row.state}</Text>
                    <Text style={s.stateCount}>{row.count}</Text>
                  </View>
                ))
              ) : (
                <Text style={s.mutedLine}>No state data yet.</Text>
              )}
            </View>
          </View>

          {/* ── Feature adoption ───────────────────────────────── */}
          <View style={[s.section, wide && s.colHalf]}>
            <Text style={s.sectionLabel}>Feature adoption</Text>
            <View style={s.card}>
              <Text style={s.cardHint}>
                % of users who've used each feature at least once.
              </Text>
              {snap?.featureAdoption.map((item) => (
                <AdoptionRow key={item.label} item={item} total={snap.totalUsers} />
              ))}
            </View>
          </View>

          {/* ── Community vigilance ────────────────────────────── */}
          <View style={[s.section, wide && s.colHalf]}>
            <Text style={s.sectionLabel}>Community vigilance</Text>
            <View style={s.card}>
              <View style={s.vigilanceRow}>
                <View style={s.vigilanceChip}>
                  <Ionicons name="time-outline" size={14} color="#F59E0B" />
                  <Text style={s.vigilanceChipText}>{snap?.vigilance.pendingPosts ?? 0} pending</Text>
                </View>
                <View style={s.vigilanceChip}>
                  <Ionicons name="flag-outline" size={14} color="#EF4444" />
                  <Text style={s.vigilanceChipText}>{snap?.vigilance.reportedPosts ?? 0} flagged</Text>
                </View>
                <View style={s.vigilanceChip}>
                  <Ionicons name="person-remove-outline" size={14} color="#EF4444" />
                  <Text style={s.vigilanceChipText}>{snap?.vigilance.reportedUsers ?? 0} blocked</Text>
                </View>
                <View style={s.vigilanceChip}>
                  <Ionicons name="help-buoy-outline" size={14} color="#0EA5E9" />
                  <Text style={s.vigilanceChipText}>{snap?.vigilance.openTickets ?? 0} tickets</Text>
                </View>
              </View>

              {pendingPosts.length > 0 ? (
                <>
                  <Text style={[s.cardHint, { marginTop: 10 }]}>
                    Approve or remove the next few posts in queue:
                  </Text>
                  {pendingPosts.map((post: any) => {
                    const isActing = acting === post.id;
                    const created = post.createdAt?.toDate ? post.createdAt.toDate() : new Date(post.createdAt ?? Date.now());
                    const when = created.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                    return (
                      <View key={post.id} style={s.postRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.postAuthor}>
                            {post.authorName ?? post.author ?? 'Unknown'}
                            <Text style={s.postDate}> · {when}</Text>
                          </Text>
                          <Text style={s.postText} numberOfLines={2}>{post.text}</Text>
                        </View>
                        <View style={s.postActions}>
                          <Pressable
                            onPress={() => doApprove(post.id)}
                            disabled={isActing}
                            style={[s.postBtn, s.postBtnApprove]}
                          >
                            <Ionicons name="checkmark" size={14} color="#16a34a" />
                          </Pressable>
                          <Pressable
                            onPress={() => doDelete(post.id)}
                            disabled={isActing}
                            style={[s.postBtn, s.postBtnDelete]}
                          >
                            <Ionicons name="trash-outline" size={14} color="#ef4444" />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </>
              ) : (
                <Text style={[s.mutedLine, { marginTop: 8 }]}>Queue is clear. Nothing to review.</Text>
              )}

              <TouchableOpacity
                style={s.cardLinkBtn}
                onPress={() => router.push('/admin/community')}
                activeOpacity={0.75}
              >
                <Text style={s.cardLinkBtnText}>Open community moderation →</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Recent signups ─────────────────────────────────── */}
          <View style={[s.section, wide && s.colHalf]}>
            <Text style={s.sectionLabel}>Recent signups</Text>
            <View style={s.card}>
              {snap?.recentSignups.length ? (
                snap.recentSignups.map((u) => (
                  <View key={u.uid} style={s.signupRow}>
                    <View style={s.signupAvatar}>
                      <Text style={s.signupInitial}>{(u.name || '?').charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.signupName}>{u.name}</Text>
                      <Text style={s.signupEmail} numberOfLines={1}>{u.email}</Text>
                    </View>
                    {u.createdAt ? (
                      <Text style={s.signupDate}>
                        {new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </Text>
                    ) : null}
                  </View>
                ))
              ) : (
                <Text style={s.mutedLine}>No recent signups in the window.</Text>
              )}
              <TouchableOpacity
                style={s.cardLinkBtn}
                onPress={() => router.push('/admin/users')}
                activeOpacity={0.75}
              >
                <Text style={s.cardLinkBtnText}>Open user management →</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Manage (nav) ───────────────────────────────────── */}
          <View style={[s.section, wide && { width: '100%' }]}>
            <Text style={s.sectionLabel}>Manage</Text>
            <View style={s.navGrid}>
              <NavTile icon="people-outline"           label="Users"             sub={`${snap?.totalUsers ?? 0} accounts`}                tint="#8B5CF6"         onPress={() => router.push('/admin/users')} />
              <NavTile icon="chatbubbles-outline"      label="Community"         sub="Moderate posts, comments, blocks"                    tint={Colors.primary} badge={snap?.vigilance.pendingPosts} onPress={() => router.push('/admin/community')} />
              <NavTile icon="library-outline"          label="Content library"   sub="Articles, books, products, schemes"                  tint="#06B6D4"         onPress={() => router.push('/admin/content')} />
              <NavTile icon="medkit-outline"           label="Vaccines"          sub="Edit the IAP schedule"                                tint="#10B981"         onPress={() => router.push('/admin/vaccines')} />
              <NavTile icon="notifications-outline"    label="Notifications"     sub="Send push + in-app announcements"                     tint="#F59E0B"         onPress={() => router.push('/admin/notifications')} />
              <NavTile icon="chatbubble-ellipses-outline" label="Tester feedback" sub="Ratings, pricing signal, loved / frustrated tags"   tint="#EC4899"         onPress={() => router.push('/admin/feedback')} />
              <NavTile icon="settings-outline"         label="App settings"      sub="Feature flags, tabs, theme, copy"                     tint="#6B7280"         onPress={() => router.push('/admin/settings')} />
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFB' },
  content: { paddingBottom: 40 },

  // Header
  header: { paddingHorizontal: 20, paddingBottom: 22 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headerEyebrow: { fontSize: 11, fontWeight: '800', color: Colors.primary, letterSpacing: 1.2, textTransform: 'uppercase' },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#1C1033', marginTop: 4 },
  headerSub: { fontSize: 12, color: '#6B7280', marginTop: 3 },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
  },
  signOutTxt: { color: '#EF4444', fontWeight: '700', fontSize: 12 },

  // Body (wide mode = two-column wrap)
  body: { paddingHorizontal: 16, paddingTop: 16, gap: 18 },
  bodyWide: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, maxWidth: 1280, alignSelf: 'center', width: '100%' },
  section: { gap: 8 },
  colHalf: {
    // @ts-ignore — calc() is a web-only StyleSheet value
    width: Platform.OS === 'web' ? ('calc(50% - 8px)' as any) : '100%',
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: '#6B7280',
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6, marginLeft: 2,
  },

  // Stats grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flex: 1, minWidth: 140, backgroundColor: '#fff',
    borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#F0EDF5',
    borderTopWidth: 3,
    gap: 6,
  },
  statIconWrap: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#1C1033' },
  statLabel: { fontSize: 11, color: '#6B7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  statSub: { fontSize: 11, color: '#9CA3AF' },

  // Generic card
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#F0EDF5',
  },
  cardHint: { fontSize: 11, color: '#9CA3AF', marginBottom: 10 },
  cardLinkBtn: { marginTop: 10, alignSelf: 'flex-start' },
  cardLinkBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  // Signup sparkline
  sparkWrap: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', paddingVertical: 8 },
  sparkCol: { flex: 1, alignItems: 'center', gap: 4 },
  sparkValue: { fontSize: 10, fontWeight: '700', color: '#6B7280' },
  sparkBar: {
    width: '100%', borderRadius: 5, backgroundColor: Colors.primary, minHeight: 4,
  },
  sparkLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF' },
  sparkFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  sparkFooterText: { fontSize: 11, color: '#6B7280' },

  // States
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F5F0FF' },
  stateName: { flex: 1, fontSize: 13, color: '#1C1033', fontWeight: '600' },
  stateCount: { fontSize: 13, fontWeight: '800', color: Colors.primary },

  // Feature adoption
  adoptionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  adoptionIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  adoptionLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  adoptionLabel: { fontSize: 13, fontWeight: '600', color: '#1C1033' },
  adoptionStat: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  adoptionBarTrack: { height: 6, borderRadius: 3, backgroundColor: '#F0EDF5', overflow: 'hidden' },
  adoptionBarFill: { height: '100%', borderRadius: 3 },

  // Vigilance
  vigilanceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vigilanceChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#FAFAFB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#F0EDF5',
  },
  vigilanceChipText: { fontSize: 11, fontWeight: '700', color: '#1C1033' },
  postRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F0FF',
  },
  postAuthor: { fontSize: 12, fontWeight: '800', color: '#1C1033' },
  postDate: { fontSize: 11, fontWeight: '500', color: '#9CA3AF' },
  postText: { fontSize: 12, color: '#4B5563', marginTop: 2, lineHeight: 17 },
  postActions: { flexDirection: 'row', gap: 6 },
  postBtn: {
    width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  postBtnApprove: { backgroundColor: 'rgba(22,163,74,0.08)', borderColor: 'rgba(22,163,74,0.25)' },
  postBtnDelete:  { backgroundColor: 'rgba(239,68,68,0.08)',  borderColor: 'rgba(239,68,68,0.25)' },

  // Recent signups
  signupRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F5F0FF' },
  signupAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F0FF', alignItems: 'center', justifyContent: 'center' },
  signupInitial: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  signupName: { fontSize: 13, fontWeight: '700', color: '#1C1033' },
  signupEmail: { fontSize: 11, color: '#9CA3AF' },
  signupDate: { fontSize: 11, fontWeight: '700', color: '#6B7280' },

  // Manage nav
  navGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  navTile: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    flexBasis: '48%', flexGrow: 1, minWidth: 220,
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#F0EDF5',
  },
  navIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 14, fontWeight: '800', color: '#1C1033' },
  navSub: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  navBadge: {
    backgroundColor: '#F59E0B', borderRadius: 999, minWidth: 22, height: 22,
    paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center',
  },
  navBadgeText: { color: '#fff', fontWeight: '800', fontSize: 10 },

  mutedLine: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },
});
