/**
 * Admin · Marketing analytics (M5).
 *
 * Reads from marketing_drafts (with denormalised latestInsights),
 * marketing_account_insights, and marketing_insights (weekly digest).
 *
 * No client-side fetches to IG Graph — that's all server-side via the
 * pollMarketingInsights cron. This screen just projects + summarises.
 */

import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../../constants/theme';
import { AdminPage, EmptyState, ToolbarButton } from '../../../components/admin/ui';
import {
  AggregateBucket,
  aggregateByPersona,
  aggregateByPillar,
  AnalyticsTopline,
  buildTopline,
  fetchAccountInsights,
  fetchLatestWeeklyDigest,
  fetchPostsWithMetrics,
  PostWithMetrics,
} from '../../../services/marketingAnalytics';
import { AccountInsightDay, WeeklyDigest } from '../../../lib/marketingTypes';

export default function MarketingAnalyticsScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<PostWithMetrics[]>([]);
  const [account, setAccount] = useState<AccountInsightDay[]>([]);
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [p, a, d] = await Promise.all([
        fetchPostsWithMetrics({ withinDays: 30 }),
        fetchAccountInsights(30),
        fetchLatestWeeklyDigest(),
      ]);
      setPosts(p);
      setAccount(a);
      setDigest(d);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  const topline = useMemo(() => buildTopline(posts, account), [posts, account]);
  const pillarBuckets = useMemo(() => aggregateByPillar(posts), [posts]);
  const personaBuckets = useMemo(() => aggregateByPersona(posts), [posts]);
  const top5 = useMemo(() => [...posts].sort((a, b) => b.engagementRate - a.engagementRate).slice(0, 5), [posts]);
  const bottom5 = useMemo(() => [...posts].sort((a, b) => a.engagementRate - b.engagementRate).slice(0, 5), [posts]);

  const hasInsights = posts.some((p) => p.metrics !== null);

  return (
    <>
      <Stack.Screen options={{ title: 'Analytics' }} />
      <AdminPage
        title="Analytics"
        description="Per-post + account-level Insights from Instagram. Auto-refreshes every 6 hours via the polling cron."
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Marketing', href: '/admin/marketing' },
          { label: 'Analytics' },
        ]}
        headerActions={<ToolbarButton label="Refresh" icon="refresh" onPress={load} />}
        loading={loading && posts.length === 0}
        error={error}
      >
        {posts.length === 0 ? (
          <EmptyState
            kind="empty"
            title="No posted drafts yet"
            body="Once you publish a draft to Instagram (via Publish now or the scheduled cron), Insights will start flowing here within ~6 hours."
          />
        ) : (
          <View style={{ gap: Spacing.lg }}>
            <ToplineRow topline={topline} hasInsights={hasInsights} />

            {!hasInsights ? (
              <View style={styles.warmupNote}>
                <Ionicons name="time-outline" size={16} color={Colors.textMuted} />
                <Text style={styles.warmupText}>
                  Posts published; Insights data hasn't filled in yet. The polling cron runs every 6h — check back after the first cycle.
                </Text>
              </View>
            ) : null}

            {digest ? <WeeklyDigestCard digest={digest} /> : null}

            <Section title="Performance by pillar" hint="Avg engagement rate over the last 30 days. Higher = more saves/shares/likes per reach.">
              {pillarBuckets.length > 0 ? (
                <BucketBars buckets={pillarBuckets} />
              ) : (
                <Text style={styles.empty}>No data yet.</Text>
              )}
            </Section>

            <Section title="Performance by persona" hint="Which personas resonate. Use this to bias Strategy → Personas weights.">
              {personaBuckets.length > 0 ? (
                <BucketBars buckets={personaBuckets} />
              ) : (
                <Text style={styles.empty}>No data yet.</Text>
              )}
            </Section>

            <View style={styles.row}>
              <View style={styles.col}>
                <Section title="Top 5 posts (last 30d)" hint="Use these as inspiration for next week's drafts.">
                  {top5.map((p) => (
                    <PostRow key={p.draftId} post={p} onOpen={() => goToDraft(router, p.draftId)} />
                  ))}
                </Section>
              </View>
              <View style={styles.col}>
                <Section title="Bottom 5 posts (last 30d)" hint="What didn't land. Skip these patterns next week.">
                  {bottom5.map((p) => (
                    <PostRow key={p.draftId} post={p} onOpen={() => goToDraft(router, p.draftId)} />
                  ))}
                </Section>
              </View>
            </View>
          </View>
        )}
      </AdminPage>
    </>
  );
}

// ── Topline tiles ───────────────────────────────────────────────────────────

function ToplineRow({ topline, hasInsights }: { topline: AnalyticsTopline; hasInsights: boolean }) {
  return (
    <View style={styles.tilesRow}>
      <Tile
        label="Reach (7d)"
        value={hasInsights ? formatInt(topline.totalReach7d) : '—'}
        sub={`${topline.postsPublished7d} post${topline.postsPublished7d === 1 ? '' : 's'}`}
      />
      <Tile
        label="Engagement rate (7d)"
        value={hasInsights ? `${(topline.avgEngagementRate7d * 100).toFixed(1)}%` : '—'}
        sub="vs reach"
      />
      <Tile
        label="Followers"
        value={topline.followerCount !== null ? formatInt(topline.followerCount) : '—'}
        sub={topline.followerDelta7d !== null ? `${topline.followerDelta7d >= 0 ? '+' : ''}${topline.followerDelta7d} (7d)` : 'no daily snapshot yet'}
        deltaTone={topline.followerDelta7d === null ? 'muted' : topline.followerDelta7d >= 0 ? 'up' : 'down'}
      />
      <Tile
        label="Cost per engagement"
        value={topline.costPerEngagement > 0 ? `₹${topline.costPerEngagement.toFixed(2)}` : '—'}
        sub={`spent ₹${topline.totalCostInr30d.toFixed(0)} (30d)`}
      />
    </View>
  );
}

function Tile({ label, value, sub, deltaTone }: { label: string; value: string; sub?: string; deltaTone?: 'up' | 'down' | 'muted' }) {
  const subColor = deltaTone === 'up' ? Colors.success : deltaTone === 'down' ? Colors.error : Colors.textMuted;
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      {sub ? <Text style={[styles.tileSub, { color: subColor }]}>{sub}</Text> : null}
    </View>
  );
}

// ── Bar chart for pillar / persona buckets ─────────────────────────────────

function BucketBars({ buckets }: { buckets: AggregateBucket[] }) {
  const max = Math.max(0.001, ...buckets.map((b) => b.avgEngagementRate));
  return (
    <View style={{ gap: Spacing.sm }}>
      {buckets.map((b) => (
        <View key={b.key} style={styles.barRow}>
          <Text style={styles.barLabel} numberOfLines={1}>{b.label}</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${(b.avgEngagementRate / max) * 100}%` }]} />
          </View>
          <Text style={styles.barValue}>{(b.avgEngagementRate * 100).toFixed(1)}%</Text>
          <Text style={styles.barCount}>{b.posts}p</Text>
        </View>
      ))}
    </View>
  );
}

// ── Top/bottom post row ─────────────────────────────────────────────────────

function PostRow({ post, onOpen }: { post: PostWithMetrics; onOpen: () => void }) {
  return (
    <Pressable onPress={onOpen} style={styles.postRow}>
      {post.thumbnail ? (
        <Image source={{ uri: post.thumbnail }} style={styles.postThumb} resizeMode="cover" />
      ) : (
        <View style={[styles.postThumb, { backgroundColor: Colors.bgLight }]} />
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.postHeadline} numberOfLines={2}>{post.headline ?? '(untitled)'}</Text>
        <Text style={styles.postMeta} numberOfLines={1}>
          {[post.pillarLabel, post.personaLabel].filter(Boolean).join(' · ')}
        </Text>
        <View style={styles.postStats}>
          <Text style={styles.postStat}>👁 {formatInt(post.metrics?.reach ?? 0)}</Text>
          <Text style={styles.postStat}>♥ {formatInt(post.metrics?.likes ?? 0)}</Text>
          <Text style={styles.postStat}>💬 {formatInt(post.metrics?.comments ?? 0)}</Text>
          <Text style={[styles.postStat, { color: Colors.primary, fontWeight: '700' }]}>
            ER {(post.engagementRate * 100).toFixed(1)}%
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// ── Weekly digest ──────────────────────────────────────────────────────────

function WeeklyDigestCard({ digest }: { digest: WeeklyDigest }) {
  return (
    <View style={styles.digest}>
      <View style={styles.digestHead}>
        <Ionicons name="sparkles" size={18} color={Colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.digestTitle}>Weekly digest · {digest.weekId}</Text>
          <Text style={styles.digestSub}>
            {digest.weekStart} → {digest.weekEnd} · {digest.postsPublished} posts ·
            {' '}avg ER {(digest.avgEngagementRate * 100).toFixed(1)}%
          </Text>
        </View>
      </View>
      {digest.commentary ? <Text style={styles.digestBody}>{digest.commentary}</Text> : null}
      {digest.recommendations.length > 0 ? (
        <View style={styles.recList}>
          <Text style={styles.recHead}>This week's recommendations</Text>
          {digest.recommendations.map((r, i) => (
            <Text key={i} style={styles.recItem}>• {r}</Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ── Section + helpers ──────────────────────────────────────────────────────

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function goToDraft(router: ReturnType<typeof useRouter>, id: string) {
  router.push({ pathname: '/admin/marketing/drafts', params: { open: id } } as any);
}

function formatInt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const styles = StyleSheet.create({
  warmupNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    padding: Spacing.md,
    backgroundColor: Colors.bgLight, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  warmupText: { flex: 1, fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 18 },

  tilesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  tile: {
    flex: 1, minWidth: 180,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
    ...Shadow.sm,
  },
  tileLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  tileValue: { fontSize: 26, fontWeight: '800', color: Colors.textDark, marginTop: 4 },
  tileSub: { fontSize: FontSize.xs, fontWeight: '700', marginTop: 4 },

  digest: {
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.primary,
    gap: 8,
  },
  digestHead: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  digestTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.primary },
  digestSub: { fontSize: FontSize.xs, color: Colors.primary, opacity: 0.8 },
  digestBody: { fontSize: FontSize.sm, color: Colors.textDark, lineHeight: 22 },
  recList: { gap: 4, marginTop: 4 },
  recHead: { fontSize: 11, fontWeight: '700', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.6 },
  recItem: { fontSize: FontSize.xs, color: Colors.textDark, lineHeight: 18 },

  section: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.borderSoft,
    ...Shadow.sm,
  },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textDark },
  sectionHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4, lineHeight: 18 },
  sectionBody: { marginTop: Spacing.md },

  empty: { color: Colors.textMuted, fontSize: FontSize.xs, fontStyle: 'italic' },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 140, fontSize: FontSize.xs, fontWeight: '600', color: Colors.textDark },
  barTrack: { flex: 1, height: 12, backgroundColor: Colors.bgLight, borderRadius: 6, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 6 },
  barValue: { width: 60, textAlign: 'right', fontSize: FontSize.xs, fontWeight: '700', color: Colors.textDark },
  barCount: { width: 28, textAlign: 'right', fontSize: FontSize.xs, color: Colors.textMuted },

  row: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  col: { flex: 1, minWidth: 320 },

  postRow: {
    flexDirection: 'row', gap: 8,
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.md,
    padding: 8,
    borderWidth: 1, borderColor: Colors.borderSoft,
    marginBottom: 6,
  },
  postThumb: { width: 50, height: 50, borderRadius: Radius.sm },
  postHeadline: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark, lineHeight: 18 },
  postMeta: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  postStats: { flexDirection: 'row', gap: 8, marginTop: 2 },
  postStat: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
});
