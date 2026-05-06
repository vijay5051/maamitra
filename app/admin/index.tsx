/**
 * Admin Dashboard — MaaMitra
 *
 * Wave 3 rebuild on top of the new design system. The sidebar (AdminShell)
 * provides nav so the old "Manage" tile grid is gone — links live there
 * instead. This screen now focuses purely on signal:
 *   - KPI grid (users, active today, signups, vigilance counters)
 *   - Signup trend sparkline + recent signups
 *   - Where users live (top states)
 *   - Feature adoption
 *   - Activation funnel + weekly retention cohorts
 *   - Live activity feed (signups / posts / support / audit)
 *   - Pending-post quick-moderation strip
 */
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import {
  AdminPage,
  EmptyState,
  StatCard,
  StatusBadge,
  ToolbarButton,
} from '../../components/admin/ui';
import { useAuthStore } from '../../store/useAuthStore';
import { useAdminRole } from '../../lib/useAdminRole';
import { ADMIN_ROLE_LABELS } from '../../lib/admin';
import { getAnalyticsSnapshot, AnalyticsSnapshot, FeatureAdoption } from '../../services/analytics';
import {
  approveCommunityPost,
  deleteCommunityPost,
  getAllCommunityPosts,
} from '../../services/firebase';
import {
  ActivityItem,
  FunnelStep,
  RetentionCohort,
  getFunnelAndRetention,
  subscribeActivity,
} from '../../services/admin';

export default function AdminDashboard() {
  const { user, signOut } = useAuthStore();
  const router = useRouter();
  const role = useAdminRole();
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width >= 1100;
  // twoCol — show card pairs side-by-side on tablets / large-phone landscape
  // (680px = iPad mini portrait, wide phones in landscape). Both web and native.
  const twoCol = width >= 680;
  // narrow — anything smaller than a tablet: hide description + icon-only actions
  const narrow = width < 768;

  const [snap, setSnap] = useState<AnalyticsSnapshot | null>(null);
  const [pendingPosts, setPendingPosts] = useState<any[]>([]);
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [retention, setRetention] = useState<RetentionCohort[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    const unsub = subscribeActivity(setActivity, 30);
    return () => unsub();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [s, posts, fr] = await Promise.all([
        getAnalyticsSnapshot(),
        getAllCommunityPosts().catch(() => []),
        getFunnelAndRetention().catch(() => ({ funnel: [], retention: [] })),
      ]);
      setSnap(s);
      setPendingPosts(posts.filter((p: any) => !p.approved).slice(0, 5));
      setFunnel(fr.funnel);
      setRetention(fr.retention);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
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
    <>
      <Stack.Screen options={{ title: 'Dashboard' }} />
      <AdminPage
        title={`Good ${greetingByHour()}, ${user?.email?.split('@')[0] ?? 'admin'}`}
        description={narrow ? undefined : role
          ? `${ADMIN_ROLE_LABELS[role]} · Live signal`
          : 'Live signal'}
        hideBack
        headerActions={
          <>
            {narrow ? (
              <Pressable onPress={load} style={styles.iconOnlyBtn} hitSlop={8} accessibilityLabel="Refresh">
                <Ionicons name="refresh" size={18} color={Colors.textDark} />
              </Pressable>
            ) : (
              <ToolbarButton label="Refresh" icon="refresh" onPress={load} />
            )}
            {narrow ? (
              <Pressable onPress={handleSignOut} style={styles.iconOnlyBtn} hitSlop={8} accessibilityLabel="Sign out">
                <Ionicons name="log-out-outline" size={18} color={Colors.textDark} />
              </Pressable>
            ) : (
              <ToolbarButton label="Sign out" icon="log-out-outline" variant="ghost" onPress={handleSignOut} />
            )}
          </>
        }
        loading={loading && !snap}
        error={error}
      >
        {/* ─── KPI grid ────────────────────────────────────────── */}
        <View style={[styles.kpiGrid, !wide && styles.kpiGridNarrow]}>
          <StatCard
            label="Total users"
            value={snap?.totalUsers ?? 0}
            icon="people-outline"
            hint={`${onboardingPct}% onboarded`}
            onPress={() => router.push('/admin/users')}
          />
          <StatCard
            label="Active today"
            value={snap?.activeToday ?? 0}
            icon="radio-outline"
            hint={`${snap?.activeThisWeek ?? 0} this week`}
          />
          <StatCard
            label="New · 7d"
            value={snap?.newSignups7d ?? 0}
            icon="person-add-outline"
            hint={`${snap?.newSignups30d ?? 0} in 30d`}
          />
          <StatCard
            label="Pending posts"
            value={snap?.vigilance.pendingPosts ?? 0}
            icon="time-outline"
            deltaPositive="down"
            hint="Approval queue"
            onPress={() => router.push('/admin/community')}
          />
          <StatCard
            label="Reported"
            value={snap?.vigilance.reportedUsers ?? 0}
            icon="shield-outline"
            deltaPositive="down"
            hint={`${snap?.vigilance.reportedPosts ?? 0} posts flagged`}
          />
          <StatCard
            label="Open tickets"
            value={snap?.vigilance.openTickets ?? 0}
            icon="help-buoy-outline"
            hint="Support inbox"
            onPress={() => router.push('/admin/support')}
          />
        </View>

        {/* ─── Quick nav strip (phones only — hamburger is too hidden) ─── */}
        {!twoCol ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickNavContent}
          >
            {QUICK_NAV_ITEMS.map((item) => (
              <Pressable
                key={item.href}
                onPress={() => router.push(item.href as any)}
                style={styles.quickNavChip}
              >
                <Ionicons name={item.icon} size={14} color={Colors.primary} />
                <Text style={styles.quickNavLabel}>{item.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {/* ─── Two-column body on wide ─────────────────────────── */}
        <View style={[styles.cols, twoCol && styles.colsWide]}>
          <View style={[styles.col, twoCol && styles.colHalf]}>
            <Card label="Signups · last 7 days" compact={narrow}>
              <Sparkline points={snap?.signupTrend ?? []} />
              <View style={styles.sparkFooter}>
                <Text style={styles.muted}>
                  {snap?.newSignups7d ?? 0} new this week · {snap?.newSignups30d ?? 0} in 30d
                </Text>
              </View>
            </Card>
          </View>

          <View style={[styles.col, twoCol && styles.colHalf]}>
            <Card label="Where users live" compact={narrow}>
              {snap?.topStates.length ? snap.topStates.map((row) => (
                <View key={row.state} style={styles.stateRow}>
                  <Ionicons name="location-outline" size={14} color={Colors.primary} />
                  <Text style={styles.stateName}>{row.state}</Text>
                  <Text style={styles.stateCount}>{row.count.toLocaleString('en-IN')}</Text>
                </View>
              )) : (
                <Text style={styles.muted}>No state data yet.</Text>
              )}
            </Card>
          </View>

          <View style={[styles.col, twoCol && styles.colHalf]}>
            <Card label="Feature adoption" hint="% of users who've used each feature at least once." compact={narrow}>
              {snap?.featureAdoption.length ? snap.featureAdoption.map((item) => (
                <AdoptionRow key={item.label} item={item} />
              )) : (
                <Text style={styles.muted}>No adoption data yet.</Text>
              )}
            </Card>
          </View>

          <View style={[styles.col, twoCol && styles.colHalf]}>
            <Card label="Pending posts" compact={narrow}>
              <View style={styles.vigilanceRow}>
                <StatusBadge label={`${snap?.vigilance.pendingPosts ?? 0} pending`} color={Colors.warning} />
                <StatusBadge label={`${snap?.vigilance.reportedPosts ?? 0} flagged`} color={Colors.error} />
                <StatusBadge label={`${snap?.vigilance.reportedUsers ?? 0} blocked`} color={Colors.error} variant="outline" />
              </View>
              {pendingPosts.length === 0 ? (
                <Text style={[styles.muted, { marginTop: Spacing.md }]}>Queue is clear. Nothing to review.</Text>
              ) : (
                <>
                  <Text style={[styles.cardHint, { marginTop: Spacing.md }]}>Approve or remove the next few:</Text>
                  {pendingPosts.map((post: any) => {
                    const isActing = acting === post.id;
                    const created = post.createdAt?.toDate ? post.createdAt.toDate() : new Date(post.createdAt ?? Date.now());
                    return (
                      <View key={post.id} style={styles.postRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.postAuthor}>
                            {post.authorName ?? post.author ?? 'Unknown'}
                            <Text style={styles.muted}>  · {created.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
                          </Text>
                          <Text style={styles.postText} numberOfLines={2}>{post.text}</Text>
                        </View>
                        <Pressable disabled={isActing} onPress={() => doApprove(post.id)} style={[styles.postBtn, styles.postBtnApprove]}>
                          <Ionicons name="checkmark" size={14} color={Colors.success} />
                        </Pressable>
                        <Pressable disabled={isActing} onPress={() => doDelete(post.id)} style={[styles.postBtn, styles.postBtnDelete]}>
                          <Ionicons name="trash-outline" size={14} color={Colors.error} />
                        </Pressable>
                      </View>
                    );
                  })}
                </>
              )}
              <Pressable style={styles.cardLink} onPress={() => router.push('/admin/community')}>
                <Text style={styles.cardLinkText}>Open community moderation →</Text>
              </Pressable>
            </Card>
          </View>

          <View style={[styles.col, twoCol && styles.colHalf]}>
            <Card label="Recent signups" compact={narrow}>
              {snap?.recentSignups.length ? snap.recentSignups.slice(0, narrow ? 3 : 6).map((u) => (
                <Pressable key={u.uid} style={styles.signupRow} onPress={() => router.push(`/admin/users/${u.uid}` as any)}>
                  <View style={styles.signupAvatar}>
                    <Text style={styles.signupInitial}>{(u.name || '?').charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.signupName} numberOfLines={1}>{u.name}</Text>
                    <Text style={styles.signupEmail} numberOfLines={1}>{u.email}</Text>
                  </View>
                  {u.createdAt ? (
                    <Text style={styles.signupDate}>
                      {new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </Text>
                  ) : null}
                </Pressable>
              )) : (
                <Text style={styles.muted}>No recent signups in the window.</Text>
              )}
              <Pressable style={styles.cardLink} onPress={() => router.push('/admin/users')}>
                <Text style={styles.cardLinkText}>Open user management →</Text>
              </Pressable>
            </Card>
          </View>

          <View style={[styles.col, twoCol && styles.colHalf]}>
            <Card label="Activation funnel" compact={narrow}>
              {funnel.length === 0 ? (
                <Text style={styles.muted}>Nothing to show yet.</Text>
              ) : funnel.map((step, i) => {
                const w = `${Math.min(100, step.pct)}%` as const;
                return (
                  <View key={step.key} style={{ marginBottom: i === funnel.length - 1 ? 0 : 8 }}>
                    <View style={styles.adoptionLabelRow}>
                      <Text style={styles.adoptionLabel}>{step.label}</Text>
                      <Text style={styles.adoptionStat}>{step.users} · {step.pct}%</Text>
                    </View>
                    <View style={styles.adoptionBarTrack}>
                      <View style={[styles.adoptionBarFill, { width: w, backgroundColor: Colors.primary }]} />
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>

          <View style={[styles.col, twoCol && styles.colHalf]}>
            <Card label="Weekly cohort retention" compact={narrow}>
              {retention.length === 0 ? (
                <Text style={styles.muted}>No cohort data yet.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.cohortTable}>
                    <View style={[styles.cohortRow, { borderBottomWidth: 1, borderBottomColor: Colors.borderSoft }]}>
                      <Text style={[styles.cohortName, styles.cohortNameCol]}>Cohort</Text>
                      <Text style={styles.cohortCell}>Size</Text>
                      <Text style={styles.cohortCell}>D1</Text>
                      <Text style={styles.cohortCell}>D7</Text>
                      <Text style={styles.cohortCell}>D30</Text>
                    </View>
                    {retention.map((c) => (
                      <View key={c.cohort} style={styles.cohortRow}>
                        <Text style={[styles.cohortName, styles.cohortNameCol]}>{c.cohort}</Text>
                        <Text style={styles.cohortCell}>{c.size}</Text>
                        <Text style={styles.cohortCell}>{c.d1}</Text>
                        <Text style={styles.cohortCell}>{c.d7}</Text>
                        <Text style={styles.cohortCell}>{c.d30}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}
            </Card>
          </View>
        </View>

        {/* ─── Live activity (full width) ───────────────────────── */}
        <Card label="Live activity" compact={narrow}>
          {activity.length === 0 ? (
            <EmptyState
              kind="empty"
              title="No activity yet"
              body="Signups, posts, support tickets, and admin actions will stream in here."
              compact
            />
          ) : activity.slice(0, narrow ? 8 : 12).map((a) => (
            <Pressable
              key={`${a.kind}_${a.id}`}
              disabled={!a.href}
              onPress={() => a.href && router.push(a.href as any)}
              style={styles.activityRow}
            >
              <View style={[styles.activityIcon, { backgroundColor: activityTint(a.kind) }]}>
                <Ionicons
                  name={
                    a.kind === 'signup' ? 'person-add-outline'
                    : a.kind === 'post' ? 'chatbubble-outline'
                    : a.kind === 'support' ? 'help-buoy-outline'
                    : 'shield-outline'
                  }
                  size={13}
                  color={Colors.textDark}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.signupName} numberOfLines={1}>{a.title}</Text>
                {a.sub ? <Text style={styles.signupEmail} numberOfLines={1}>{a.sub}</Text> : null}
              </View>
              <Text style={styles.signupDate}>
                {new Date(a.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </Pressable>
          ))}
        </Card>
      </AdminPage>
    </>
  );
}

// ─── Constants ─────────────────────────────────────────────────────────────
const QUICK_NAV_ITEMS = [
  { href: '/admin/users',         label: 'Users',      icon: 'people-outline' as const },
  { href: '/admin/community',     label: 'Community',  icon: 'chatbubbles-outline' as const },
  { href: '/admin/support',       label: 'Support',    icon: 'help-buoy-outline' as const },
  { href: '/admin/content',       label: 'Content',    icon: 'library-outline' as const },
  { href: '/admin/marketing',     label: 'Studio',     icon: 'sparkles-outline' as const },
  { href: '/admin/notifications', label: 'Notify',     icon: 'notifications-outline' as const },
];

// ─── Helpers ───────────────────────────────────────────────────────────────
function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function activityTint(kind: ActivityItem['kind']): string {
  switch (kind) {
    case 'signup': return '#DDD6FE';
    case 'post': return '#FBCFE8';
    case 'support': return '#BAE6FD';
    default: return '#FEF3C7';
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────
function Card({ label, hint, compact, children }: { label: string; hint?: string; compact?: boolean; children: React.ReactNode }) {
  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <Text style={styles.cardLabel}>{label}</Text>
      {hint ? <Text style={styles.cardHint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

function Sparkline({ points }: { points: { day: string; count: number }[] }) {
  if (points.length === 0) return <Text style={styles.muted}>No signups yet.</Text>;
  const max = Math.max(1, ...points.map((p) => p.count));
  return (
    <View style={styles.sparkWrap}>
      {points.map((p) => {
        const h = Math.max(4, Math.round((p.count / max) * 60));
        const label = new Date(p.day + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' });
        return (
          <View key={p.day} style={styles.sparkCol}>
            <Text style={styles.sparkValue}>{p.count}</Text>
            <View style={[styles.sparkBar, { height: h }]} />
            <Text style={styles.sparkLabel}>{label[0]}</Text>
          </View>
        );
      })}
    </View>
  );
}

function AdoptionRow({ item }: { item: FeatureAdoption }) {
  const width = `${Math.min(100, item.pct)}%` as const;
  const color = item.group === 'health' ? '#8B5CF6'
              : item.group === 'wellness' ? '#14B8A6'
              : item.group === 'community' ? '#EC4899'
              : item.group === 'chat' ? '#F97316'
              : Colors.primary;
  return (
    <View style={styles.adoptionRow}>
      <View style={[styles.adoptionIcon, { backgroundColor: `${color}1A` }]}>
        <Ionicons name={item.icon as any} size={14} color={color} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.adoptionLabelRow}>
          <Text style={styles.adoptionLabel}>{item.label}</Text>
          <Text style={styles.adoptionStat}>{item.users} · {item.pct}%</Text>
        </View>
        <View style={styles.adoptionBarTrack}>
          <View style={[styles.adoptionBarFill, { width, backgroundColor: color }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  kpiGridNarrow: { gap: Spacing.sm },

  cols: { flexDirection: 'column', gap: Spacing.lg },
  colsWide: { flexDirection: 'row', flexWrap: 'wrap' },
  col: { flexBasis: '100%', minWidth: 0 },
  colHalf: {
    // @ts-ignore — calc() is web-only; native uses percentage flexBasis
    flexBasis: Platform.OS === 'web' ? ('calc(50% - 8px)' as any) : '48%',
    flexGrow: 1, minWidth: 280,
  },

  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.borderSoft,
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  cardCompact: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },

  iconOnlyBtn: {
    width: 34, height: 34, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.cardBg,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },

  quickNavContent: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 2 },
  quickNavChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: Colors.cardBg,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.borderSoft,
  },
  quickNavLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textDark },
  cardLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textLight,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  cardHint: { fontSize: FontSize.xs, color: Colors.textMuted },
  cardLink: { marginTop: 8, alignSelf: 'flex-start' },
  cardLinkText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  muted: { fontSize: FontSize.xs, color: Colors.textMuted },

  sparkWrap: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', paddingVertical: 8, height: 84 },
  sparkCol: { flex: 1, alignItems: 'center', gap: 4 },
  sparkValue: { fontSize: 10, fontWeight: '700', color: Colors.textLight },
  sparkBar: { width: '100%', borderRadius: 5, backgroundColor: Colors.primary, minHeight: 4 },
  sparkLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted },
  sparkFooter: { marginTop: 8 },

  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: Colors.borderSoft },
  stateName: { flex: 1, fontSize: FontSize.sm, color: Colors.textDark, fontWeight: '600' },
  stateCount: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.primary, fontVariant: ['tabular-nums'] },

  adoptionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  adoptionIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  adoptionLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  adoptionLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textDark },
  adoptionStat: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textLight },
  adoptionBarTrack: { height: 6, borderRadius: 3, backgroundColor: Colors.borderSoft, overflow: 'hidden' },
  adoptionBarFill: { height: '100%', borderRadius: 3 },

  vigilanceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  postRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderSoft,
  },
  postAuthor: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.textDark },
  postText: { fontSize: FontSize.xs, color: '#4B5563', marginTop: 2, lineHeight: 17 },
  postBtn: {
    width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  postBtnApprove: { backgroundColor: 'rgba(22,163,74,0.08)', borderColor: 'rgba(22,163,74,0.25)' },
  postBtnDelete:  { backgroundColor: 'rgba(239,68,68,0.08)',  borderColor: 'rgba(239,68,68,0.25)' },

  signupRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderSoft },
  signupAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  signupInitial: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.primary },
  signupName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  signupEmail: { fontSize: FontSize.xs, color: Colors.textMuted },
  signupDate: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textLight },

  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderSoft },
  activityIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },

  cohortTable: { minWidth: 300 },
  cohortRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  cohortName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  cohortNameCol: { width: 110 },
  cohortCell: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textLight, width: 44, textAlign: 'right' },
});
