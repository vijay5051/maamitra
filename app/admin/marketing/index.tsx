/**
 * Today — the marketing home screen.
 *
 * Studio v2 redesign: replaces the v1 setup-checklist with a calm,
 * non-techie home view answering three questions:
 *   - What's going out next?
 *   - Am I responding (replies)?
 *   - Are people engaging (this week's reach)?
 *
 * Hero "Create post" CTA on top — single primary action per CLAUDE.md.
 * Setup state moves to /admin/marketing/settings; cron + crisis toggles
 * live there too. Health chip in the shell shows IG/FB/Auto state.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../../constants/theme';
import { fetchAccountInsights, fetchPostsWithMetrics } from '../../../services/marketingAnalytics';
import { countByStatus as countInboxByStatus } from '../../../services/marketingInbox';
import { countDraftsByStatus, listDrafts } from '../../../services/marketingDrafts';
import { MarketingDraft } from '../../../lib/marketingTypes';

interface State {
  scheduledNext: MarketingDraft | null;
  recentPosted: MarketingDraft[];
  postsThisWeek: number;
  reachThisWeek: number;
  unreadReplies: number;
  loading: boolean;
}

export default function MarketingTodayScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= 900;

  const [state, setState] = useState<State>({
    scheduledNext: null,
    recentPosted: [],
    postsThisWeek: 0,
    reachThisWeek: 0,
    unreadReplies: 0,
    loading: true,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const [scheduled, posted, posts, account, inboxCounts, draftCounts] = await Promise.all([
        listDrafts({ status: 'scheduled', limitN: 30 }),
        listDrafts({ status: 'posted', limitN: 7 }),
        fetchPostsWithMetrics({ withinDays: 7 }),
        fetchAccountInsights(7),
        countInboxByStatus(),
        countDraftsByStatus(),
      ]);

      const sortedScheduled = [...scheduled].sort((a, b) => {
        const ta = a.scheduledAt ?? '';
        const tb = b.scheduledAt ?? '';
        return ta.localeCompare(tb);
      });
      const next = sortedScheduled.find((d) => !!d.scheduledAt) ?? null;
      const reach = posts.reduce((a, p) => a + (p.metrics?.reach ?? 0), 0);

      // "Posts this week" = posted in last 7d. Count off the snapshot, not
      // server (countDraftsByStatus returns lifetime; we just want the week).
      const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
      const postsThisWeek = posted.filter((d) => {
        const t = d.postedAt ? new Date(d.postedAt).getTime() : 0;
        return t >= sevenDaysAgo;
      }).length;

      setState({
        scheduledNext: next,
        recentPosted: posted,
        postsThisWeek,
        reachThisWeek: reach,
        unreadReplies: inboxCounts.unread ?? 0,
        loading: false,
      });
      // draftCounts/account currently unused on the Today view; kept available
      // for the Posts hub which will subscribe separately.
      void account;
      void draftCounts;
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = () => { void load(); };

  return (
    <>
      <Stack.Screen options={{ title: 'Marketing' }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.body, isWide ? styles.bodyWide : styles.bodyNarrow]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero CTA */}
        <Pressable
          onPress={() => router.push('/admin/marketing/create' as any)}
          style={styles.heroCta}
          accessibilityRole="button"
          accessibilityLabel="Create a new post"
        >
          <View style={styles.heroIconBubble}>
            <Ionicons name="add" size={28} color={Colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Create post</Text>
            <Text style={styles.heroSub}>Make something for Instagram and Facebook</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={Colors.primary} />
        </Pressable>

        {/* KPI tiles */}
        <View style={styles.tilesRow}>
          <KpiTile
            label="This week"
            value={state.loading ? null : String(state.postsThisWeek)}
            sub={`${state.postsThisWeek === 1 ? 'post' : 'posts'} published`}
            icon="rocket-outline"
          />
          <KpiTile
            label="Reach (7d)"
            value={state.loading ? null : formatInt(state.reachThisWeek)}
            sub="people seen on IG + FB"
            icon="eye-outline"
          />
          <KpiTile
            label="Unread"
            value={state.loading ? null : String(state.unreadReplies)}
            sub={state.unreadReplies > 0 ? 'replies waiting' : 'no new replies'}
            icon="chatbubble-outline"
            tone={state.unreadReplies > 0 ? 'warn' : 'default'}
            href="/admin/marketing/inbox"
          />
        </View>

        {/* Going out next */}
        <Section title="Going out next" right={
          state.loading ? <ActivityIndicator size="small" color={Colors.primary} /> :
          <Pressable onPress={onRefresh} hitSlop={8}><Ionicons name="refresh" size={16} color={Colors.textLight} /></Pressable>
        }>
          {state.scheduledNext ? (
            <NextPostCard draft={state.scheduledNext} onOpen={(id) => router.push(`/admin/marketing/drafts?open=${id}` as any)} />
          ) : (
            <EmptyCard
              icon="calendar-outline"
              title="Nothing scheduled"
              body="Want to put something on the calendar?"
              ctaLabel="Plan a post"
              onPress={() => router.push('/admin/marketing/create' as any)}
            />
          )}
        </Section>

        {/* Recent posts strip */}
        <Section title="Recent posts" right={
          <Pressable onPress={() => router.push('/admin/marketing/posts?tab=posted' as any)}>
            <Text style={styles.seeAll}>See all →</Text>
          </Pressable>
        }>
          {state.recentPosted.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: Spacing.sm }}>
              {state.recentPosted.map((d) => (
                <RecentThumb key={d.id} draft={d} onOpen={(id) => router.push(`/admin/marketing/drafts?open=${id}` as any)} />
              ))}
            </ScrollView>
          ) : state.loading ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: Spacing.sm }}>
              {[0, 1, 2, 3].map((i) => <View key={i} style={[styles.thumb, styles.thumbSkeleton]} />)}
            </ScrollView>
          ) : (
            <EmptyCard
              icon="images-outline"
              title="No posts yet"
              body="Once you publish something, it'll show up here."
              ctaLabel="Create your first post"
              onPress={() => router.push('/admin/marketing/create' as any)}
            />
          )}
        </Section>
      </ScrollView>
    </>
  );
}

// ── Hero tiles ──────────────────────────────────────────────────────────────

function KpiTile({
  label, value, sub, icon, tone, href,
}: {
  label: string;
  value: string | null;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: 'default' | 'warn';
  href?: string;
}) {
  const router = useRouter();
  const inner = (
    <View style={[styles.tile, tone === 'warn' && styles.tileWarn]}>
      <View style={styles.tileHead}>
        <Ionicons name={icon} size={14} color={tone === 'warn' ? Colors.warning : Colors.textLight} />
        <Text style={styles.tileLabel}>{label}</Text>
      </View>
      {value === null ? (
        <View style={styles.tileValueSkeleton} />
      ) : (
        <Text style={[styles.tileValue, tone === 'warn' && { color: Colors.warning }]}>{value}</Text>
      )}
      <Text style={styles.tileSub}>{sub}</Text>
    </View>
  );
  if (href) {
    return (
      <Pressable onPress={() => router.push(href as any)} style={{ flex: 1 }}>
        {inner}
      </Pressable>
    );
  }
  return <View style={{ flex: 1 }}>{inner}</View>;
}

// ── Next post card ──────────────────────────────────────────────────────────

function NextPostCard({ draft, onOpen }: { draft: MarketingDraft; onOpen: (id: string) => void }) {
  const when = formatScheduledTime(draft.scheduledAt);
  const platforms = draft.platforms.length ? draft.platforms.join(' + ').toUpperCase() : 'IG + FB';
  return (
    <Pressable onPress={() => onOpen(draft.id)} style={styles.nextCard}>
      {draft.assets[0]?.url ? (
        <Image source={{ uri: draft.assets[0].url }} style={styles.nextImage} resizeMode="cover" />
      ) : (
        <View style={[styles.nextImage, styles.nextImageEmpty]}>
          <Ionicons name="image-outline" size={28} color={Colors.textMuted} />
        </View>
      )}
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.nextMeta}>
          <Ionicons name="time-outline" size={14} color={Colors.primary} />
          <Text style={styles.nextWhen}>{when}</Text>
          <View style={styles.nextDivider} />
          <Text style={styles.nextPlatforms}>{platforms}</Text>
        </View>
        <Text style={styles.nextTitle} numberOfLines={2}>
          {draft.headline ?? draft.caption.slice(0, 80)}
        </Text>
        <Text style={styles.nextOpen}>Tap to edit or reschedule →</Text>
      </View>
    </Pressable>
  );
}

// ── Recent thumb ────────────────────────────────────────────────────────────

function RecentThumb({ draft, onOpen }: { draft: MarketingDraft; onOpen: (id: string) => void }) {
  return (
    <Pressable onPress={() => onOpen(draft.id)} style={styles.thumbWrap}>
      {draft.assets[0]?.url ? (
        <Image source={{ uri: draft.assets[0].url }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbSkeleton]}>
          <Ionicons name="image-outline" size={20} color={Colors.textMuted} />
        </View>
      )}
      <Text style={styles.thumbWhen} numberOfLines={1}>
        {formatRelativeShort(draft.postedAt)}
      </Text>
    </Pressable>
  );
}

// ── Section + empty card ────────────────────────────────────────────────────

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {right}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function EmptyCard({
  icon, title, body, ctaLabel, onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  ctaLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.emptyCard}>
      <Ionicons name={icon} size={28} color={Colors.primary} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyBody}>{body}</Text>
      </View>
      <View style={styles.emptyCta}>
        <Text style={styles.emptyCtaLabel}>{ctaLabel}</Text>
        <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
      </View>
    </Pressable>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatInt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatScheduledTime(iso: string | null): string {
  if (!iso) return 'Not scheduled';
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();

    const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
    if (sameDay) return `Today, ${time}`;
    if (isTomorrow) return `Tomorrow, ${time}`;
    return `${d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}, ${time}`;
  } catch {
    return 'Scheduled';
  }
}

function formatRelativeShort(iso: string | null): string {
  if (!iso) return '';
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(ms / (60 * 60 * 1000));
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  body: { padding: Spacing.md, gap: Spacing.lg, paddingBottom: 80 },
  bodyWide: { paddingHorizontal: Spacing.xxxl, paddingTop: Spacing.md },
  bodyNarrow: {},

  // Hero CTA
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    ...Shadow.sm,
  },
  heroIconBubble: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textDark, letterSpacing: -0.3 },
  heroSub: { fontSize: FontSize.sm, color: Colors.textLight, marginTop: 2 },

  // KPI tiles
  tilesRow: { flexDirection: 'row', gap: Spacing.sm },
  tile: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
    minHeight: 96,
    gap: 4,
  },
  tileWarn: { borderColor: Colors.warning, backgroundColor: 'rgba(245, 158, 11, 0.05)' },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tileLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  tileValue: { fontSize: 24, fontWeight: '800', color: Colors.textDark, marginTop: 2 },
  tileValueSkeleton: { height: 28, marginTop: 2, backgroundColor: Colors.borderSoft, borderRadius: 4, width: '60%' },
  tileSub: { fontSize: FontSize.xs, color: Colors.textLight },

  // Section
  section: { gap: Spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textDark, letterSpacing: -0.2 },
  sectionBody: {},
  seeAll: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },

  // Next post card
  nextCard: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
    ...Shadow.sm,
  },
  nextImage: { width: 76, height: 76, borderRadius: Radius.md, backgroundColor: Colors.bgTint },
  nextImageEmpty: { alignItems: 'center', justifyContent: 'center' },
  nextMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nextWhen: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  nextDivider: { width: 1, height: 10, backgroundColor: Colors.border },
  nextPlatforms: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.4 },
  nextTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark, lineHeight: 20 },
  nextOpen: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600' },

  // Empty card
  emptyCard: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
    borderStyle: 'dashed',
  },
  emptyTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  emptyBody: { fontSize: FontSize.xs, color: Colors.textLight, lineHeight: 16 },
  emptyCta: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: Colors.primarySoft, borderRadius: 999,
  },
  emptyCtaLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },

  // Recent thumbs
  thumbWrap: { gap: 4, alignItems: 'center' },
  thumb: { width: 88, height: 88, borderRadius: Radius.md, backgroundColor: Colors.bgTint },
  thumbSkeleton: { alignItems: 'center', justifyContent: 'center' },
  thumbWhen: { fontSize: 10, fontWeight: '600', color: Colors.textMuted },
});
