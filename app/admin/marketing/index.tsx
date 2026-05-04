/**
 * Admin · Marketing overview.
 *
 * Phase 1 of the marketing automation module. Shows the real setup state —
 * what's configured, what's missing, what's coming next — and links into
 * the only sub-page that exists today (Brand kit). As subsequent phases
 * ship, more checklist rows light up green and more nav cards appear.
 *
 * The Meta App is already provisioned (App ID 1485870226522993) and the
 * brand foundation lives in marketing_brand/main; everything else is
 * tracked here so the admin always knows what's wired vs not.
 */
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../../constants/theme';
import { AdminPage, StatusBadge, ToolbarButton } from '../../../components/admin/ui';
import {
  CostLogRow,
  fetchBrandKit,
  fetchRecentCostLog,
  saveBrandKit,
  summariseCost,
} from '../../../services/marketing';
import { countDraftsByStatus } from '../../../services/marketingDrafts';
import { countByStatus as countInboxByStatus } from '../../../services/marketingInbox';
import { fetchLatestWeeklyDigest } from '../../../services/marketingAnalytics';
import { BrandKit, DraftStatus, InboxStatus, WeeklyDigest } from '../../../lib/marketingTypes';
import { useAuthStore } from '../../../store/useAuthStore';

const META_APP_ID = '1485870226522993';

interface ChecklistRow {
  key: string;
  label: string;
  description: string;
  state: 'done' | 'in_progress' | 'pending';
  href?: string;
  hint?: string;
}

export default function MarketingOverviewScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [brand, setBrand] = useState<BrandKit | null>(null);
  const [costRows, setCostRows] = useState<CostLogRow[]>([]);
  const [draftCounts, setDraftCounts] = useState<Record<DraftStatus, number> | null>(null);
  const [inboxCounts, setInboxCounts] = useState<Record<InboxStatus | 'all', number> | null>(null);
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<'cron' | 'crisis' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [k, rows, dc, ic, dg] = await Promise.all([
        fetchBrandKit(),
        fetchRecentCostLog(120),
        countDraftsByStatus(),
        countInboxByStatus(),
        fetchLatestWeeklyDigest(),
      ]);
      setBrand(k);
      setCostRows(rows);
      setDraftCounts(dc);
      setInboxCounts(ic);
      setDigest(dg);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function toggleCron() {
    if (!brand || !user) return;
    setToggling('cron');
    setError(null);
    try {
      const next = !brand.cronEnabled;
      await saveBrandKit({ uid: user.uid, email: user.email }, { cronEnabled: next });
      setBrand({ ...brand, cronEnabled: next });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setToggling(null);
    }
  }

  async function toggleCrisis() {
    if (!brand || !user) return;
    setToggling('crisis');
    setError(null);
    try {
      const next = !brand.crisisPaused;
      let reason: string | null = brand.crisisPauseReason ?? null;
      if (next && typeof window !== 'undefined') {
        reason = window.prompt('Reason for the pause (optional, e.g. "national tragedy", "app outage"):', '') ?? null;
      }
      await saveBrandKit(
        { uid: user.uid, email: user.email },
        { crisisPaused: next, crisisPauseReason: next ? reason : null },
      );
      setBrand({ ...brand, crisisPaused: next, crisisPauseReason: next ? reason : null });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setToggling(null);
    }
  }

  const brandConfigured = !!brand && !!brand.logoUrl;
  const brandPartial = !!brand && !brand.logoUrl;
  const strategyConfigured = !!brand && (brand.personas?.length ?? 0) > 0 && (brand.pillars?.length ?? 0) > 0;

  const cost = summariseCost(costRows);
  const dailyCap = brand?.costCaps?.dailyInr ?? 0;
  const monthlyCap = brand?.costCaps?.monthlyInr ?? 0;
  const dailyPct = dailyCap > 0 ? Math.min(100, Math.round((cost.today / dailyCap) * 100)) : 0;
  const monthlyPct = monthlyCap > 0 ? Math.min(100, Math.round((cost.month / monthlyCap) * 100)) : 0;
  const alertAt = brand?.costCaps?.alertAtPct ?? 80;

  const checklist: ChecklistRow[] = [
    {
      key: 'meta-app',
      label: 'Meta Developer App',
      description: `Provisioned — App ID ${META_APP_ID}. Use cases configured for Instagram + Facebook Page management. App Secret saved.`,
      state: 'done',
    },
    {
      key: 'brand-kit',
      label: 'Brand kit',
      description: brandConfigured
        ? `${brand!.brandName} — palette, fonts, voice, and weekly themes set up.`
        : brandPartial
          ? 'Brand voice + theme calendar saved, but no logo uploaded yet. Add a 1080×1080 PNG so rendered posts can stamp it.'
          : 'No brand kit yet. Set up logo, palette, voice, and weekly theme calendar.',
      state: brandConfigured ? 'done' : brandPartial ? 'in_progress' : 'pending',
      href: '/admin/marketing/brand-kit',
    },
    {
      key: 'strategy',
      label: 'Strategy (personas, pillars, calendar, compliance)',
      description: strategyConfigured
        ? `${brand!.personas.length} personas · ${brand!.pillars.length} pillars · ${brand!.culturalCalendar.length} calendar events · ${brand!.compliance.medicalForbiddenWords.length} forbidden words.`
        : 'Define audience personas, content pillars, cultural calendar, compliance rules, and cost caps. Drives every draft below.',
      state: strategyConfigured ? 'done' : 'pending',
      href: '/admin/marketing/strategy',
    },
    {
      key: 'connections',
      label: 'Meta connections (OAuth)',
      description: 'Connect MaaMitra Facebook Page + Instagram Business so the publisher can post on your behalf. Coming in Phase 4.',
      state: 'pending',
      hint: 'Phase 4',
    },
    {
      key: 'templates',
      label: 'Template engine',
      description: 'Satori renderer + 3 branded templates (Tip Card, Quote Card, Milestone Card) + Pexels stock + FLUX AI image sources. Text-perfect because real fonts. Open Template preview to try it.',
      state: 'done',
      href: '/admin/marketing/preview',
    },
    {
      key: 'generator',
      label: 'Draft generator + queue',
      description: strategyConfigured
        ? 'OpenAI gpt-4o-mini writes the caption, picks template, renders via Imagen → marketing_drafts queue. Daily 6am IST cron is opt-in.'
        : 'Set up Strategy first — generator needs personas + pillars to produce on-brand drafts.',
      state: strategyConfigured ? 'done' : 'pending',
      href: '/admin/marketing/drafts',
    },
    {
      key: 'calendar',
      label: 'Calendar + scheduling',
      description: 'Approved drafts plotted on a week grid. Schedule a draft from its slide-over; the cron auto-publishes once Meta access lands. Until then, manual publish.',
      state: 'done',
      href: '/admin/marketing/calendar',
    },
    {
      key: 'webhook',
      label: 'Webhook receiver',
      description: 'metaWebhookReceiver deployed at https://us-central1-maa-mitra-7kird8.cloudfunctions.net/metaWebhookReceiver. GET handshake + HMAC-SHA256 signature verification. Set META_APP_SECRET + META_WEBHOOK_VERIFY_TOKEN in functions/.env, then register the URL in the Meta App Dashboard.',
      state: 'in_progress',
      hint: 'Awaiting Meta config',
    },
    {
      key: 'inbox',
      label: 'Unified inbox',
      description: 'IG + FB comments and DMs in one queue with AI reply suggestions, sentiment + urgency classification, and synthetic test threads to exercise the UX. Real Meta events flow once webhook + App Review approves.',
      state: 'done',
      href: '/admin/marketing/inbox',
    },
    {
      key: 'analytics',
      label: 'Analytics + feedback loop',
      description: 'Per-post Insights polled every 6h, daily account snapshots, weekly LLM digest with recommendations. The generator self-improves: pillar/template selection biases toward winners over time.',
      state: 'done',
      href: '/admin/marketing/analytics',
    },
    {
      key: 'ugc',
      label: 'UGC pipeline (real-mom stories)',
      description: 'Moms share their story + photo via the in-app Share Your Story flow; admin reviews here; one click renders a Real Story IG post with attribution + DPDP-compliant consent.',
      state: 'done',
      href: '/admin/marketing/ugc',
    },
    {
      key: 'app-review',
      label: 'Meta App Review',
      description: 'Submit screencast + permission justifications for instagram_content_publish, pages_manage_posts, etc. 3–7 day turnaround. Submit after Phase 6 ships so the screencast shows the real flow.',
      state: 'pending',
      hint: 'After Phase 6',
    },
  ];

  const doneCount = checklist.filter((r) => r.state === 'done').length;

  return (
    <>
      <Stack.Screen options={{ title: 'Marketing' }} />
      <AdminPage
        title="Marketing automation"
        description="A full Instagram + Facebook marketing platform inside the admin panel. Generate content, approve drafts, manage comments + DMs — without ever logging into Meta."
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Marketing' }]}
        headerActions={<ToolbarButton label="Refresh" icon="refresh" onPress={load} />}
        loading={loading && !brand}
        error={error}
      >
        {brand?.crisisPaused ? (
          <View style={styles.crisisBanner}>
            <Ionicons name="pause-circle" size={20} color="#fff" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.crisisTitle}>Crisis pause active</Text>
              <Text style={styles.crisisSub}>
                Daily cron is paused. New posts won't auto-publish.{brand.crisisPauseReason ? ` Reason: ${brand.crisisPauseReason}` : ''}
              </Text>
            </View>
            <Pressable
              onPress={toggleCrisis}
              disabled={toggling === 'crisis'}
              style={styles.crisisAction}
            >
              <Text style={styles.crisisActionLabel}>{toggling === 'crisis' ? '…' : 'Resume'}</Text>
            </Pressable>
          </View>
        ) : null}

        {brand ? (
          <View style={styles.toggleRow}>
            <View style={[styles.toggleCard, brand.cronEnabled && styles.toggleCardOn]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitle}>Daily 6am IST cron</Text>
                <Text style={styles.toggleSub}>
                  {brand.cronEnabled
                    ? 'On — a fresh draft lands in the queue every morning.'
                    : 'Off — drafts only happen when you click Generate now.'}
                </Text>
              </View>
              <Pressable
                onPress={toggleCron}
                disabled={toggling === 'cron'}
                style={[styles.toggleBtn, brand.cronEnabled && styles.toggleBtnOn]}
              >
                <Text style={[styles.toggleBtnLabel, brand.cronEnabled && styles.toggleBtnLabelOn]}>
                  {toggling === 'cron' ? '…' : brand.cronEnabled ? 'Disable' : 'Enable'}
                </Text>
              </Pressable>
            </View>
            <View style={[styles.toggleCard, brand.crisisPaused && { borderColor: Colors.error }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitle}>Crisis pause</Text>
                <Text style={styles.toggleSub}>
                  {brand.crisisPaused
                    ? 'Active. Use Resume above when safe.'
                    : 'Halts cron + scheduled publishes during outages or sensitive news.'}
                </Text>
              </View>
              <Pressable
                onPress={toggleCrisis}
                disabled={toggling === 'crisis'}
                style={[styles.toggleBtn, brand.crisisPaused && { backgroundColor: Colors.error }]}
              >
                <Text style={[styles.toggleBtnLabel, brand.crisisPaused && { color: '#fff' }]}>
                  {toggling === 'crisis' ? '…' : brand.crisisPaused ? 'Resume' : 'Pause'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {digest ? (
          <Pressable
            onPress={() => router.push('/admin/marketing/analytics' as any)}
            style={styles.digestCard}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Ionicons name="sparkles" size={16} color={Colors.primary} />
              <Text style={styles.digestCardTitle}>This week's takeaways</Text>
              <Text style={styles.digestCardWeek}>· {digest.weekId}</Text>
            </View>
            {digest.commentary ? (
              <Text style={styles.digestCardBody} numberOfLines={3}>{digest.commentary}</Text>
            ) : null}
            <Text style={styles.digestCardCta}>Open full analytics →</Text>
          </Pressable>
        ) : null}

        <View style={styles.statBar}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{doneCount}<Text style={styles.statTotal}> / {checklist.length}</Text></Text>
            <Text style={styles.statLabel}>Setup steps complete</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>2</Text>
            <Text style={styles.statLabel}>Use cases · 10 perms</Text>
          </View>
          <Pressable style={styles.stat} onPress={() => router.push('/admin/marketing/drafts' as any)}>
            <Text style={styles.statValue}>{draftCounts?.pending_review ?? 0}</Text>
            <Text style={styles.statLabel}>Pending review</Text>
          </Pressable>
          <Pressable style={styles.stat} onPress={() => router.push('/admin/marketing/inbox' as any)}>
            <Text style={styles.statValue}>{inboxCounts?.unread ?? 0}</Text>
            <Text style={styles.statLabel}>Unread inbox</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Spend (last 30 days)</Text>
        <View style={styles.costGrid}>
          <CostTile
            label="Today"
            valueInr={cost.today}
            capInr={dailyCap}
            pct={dailyPct}
            alertAtPct={alertAt}
          />
          <CostTile
            label="This month"
            valueInr={cost.month}
            capInr={monthlyCap}
            pct={monthlyPct}
            alertAtPct={alertAt}
          />
          <View style={styles.costMetaTile}>
            <Text style={styles.costMetaValue}>{costRows.length}</Text>
            <Text style={styles.costMetaLabel}>Renders captured</Text>
            {cost.lastTs ? (
              <Text style={styles.costMetaSub}>
                Last: {new Date(cost.lastTs).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
              </Text>
            ) : (
              <Text style={styles.costMetaSub}>No renders yet</Text>
            )}
          </View>
        </View>

        <Text style={styles.sectionLabel}>Setup checklist</Text>
        <View style={{ gap: Spacing.sm }}>
          {checklist.map((row) => (
            <ChecklistCard key={row.key} row={row} onOpen={row.href ? () => router.push(row.href as any) : undefined} />
          ))}
        </View>
      </AdminPage>
    </>
  );
}

function CostTile({
  label,
  valueInr,
  capInr,
  pct,
  alertAtPct,
}: {
  label: string;
  valueInr: number;
  capInr: number;
  pct: number;
  alertAtPct: number;
}) {
  const isAlert = pct >= alertAtPct;
  const isOver = capInr > 0 && valueInr >= capInr;
  const tone = isOver ? Colors.error : isAlert ? Colors.warning : Colors.primary;
  return (
    <View style={styles.costTile}>
      <Text style={styles.costLabel}>{label}</Text>
      <Text style={styles.costValue}>
        ₹{valueInr.toFixed(2)}
        {capInr > 0 ? <Text style={styles.costCap}> / ₹{capInr}</Text> : null}
      </Text>
      <View style={styles.costBarTrack}>
        <View style={[styles.costBarFill, { width: `${pct}%`, backgroundColor: tone }]} />
      </View>
      <Text style={[styles.costPctLabel, { color: tone }]}>
        {capInr > 0 ? `${pct}% used` : 'No cap set'}
        {isOver ? ' · cap reached' : isAlert ? ' · approaching cap' : ''}
      </Text>
    </View>
  );
}

function ChecklistCard({ row, onOpen }: { row: ChecklistRow; onOpen?: () => void }) {
  const tone = row.state === 'done' ? Colors.success : row.state === 'in_progress' ? Colors.warning : Colors.textMuted;
  const icon: keyof typeof Ionicons.glyphMap =
    row.state === 'done' ? 'checkmark-circle' : row.state === 'in_progress' ? 'ellipse' : 'ellipse-outline';
  const Wrapper: any = onOpen ? Pressable : View;
  return (
    <Wrapper
      onPress={onOpen}
      style={[styles.card, onOpen && styles.cardClickable]}
    >
      <Ionicons name={icon} size={22} color={tone} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.cardHead}>
          <Text style={styles.cardLabel}>{row.label}</Text>
          {row.hint ? <StatusBadge label={row.hint} color={Colors.textMuted} /> : null}
          {row.state === 'done' ? <StatusBadge label="Ready" color={Colors.success} /> : null}
          {row.state === 'in_progress' ? <StatusBadge label="In progress" color={Colors.warning} /> : null}
        </View>
        <Text style={styles.cardBody}>{row.description}</Text>
      </View>
      {onOpen ? <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} /> : null}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  statBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  stat: {
    flexGrow: 1,
    minWidth: 160,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    ...Shadow.sm,
  },
  statValue: { fontSize: 28, fontWeight: '800', color: Colors.textDark },
  statTotal: { fontSize: 18, fontWeight: '700', color: Colors.textMuted },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textLight,
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },

  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    ...Shadow.sm,
  },
  cardClickable: {
    borderColor: Colors.primary,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  cardLabel: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  cardBody: { fontSize: FontSize.sm, color: Colors.textMuted, lineHeight: 20 },

  costGrid: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap', marginBottom: Spacing.lg },
  costTile: {
    flex: 1,
    minWidth: 220,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    ...Shadow.sm,
  },
  costLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  costValue: { fontSize: 22, fontWeight: '800', color: Colors.textDark, marginTop: 4 },
  costCap: { fontSize: FontSize.sm, fontWeight: '500', color: Colors.textMuted },
  costBarTrack: { height: 6, backgroundColor: Colors.bgLight, borderRadius: 3, marginTop: Spacing.sm, overflow: 'hidden' },
  costBarFill: { height: '100%', borderRadius: 3 },
  costPctLabel: { fontSize: FontSize.xs, fontWeight: '600', marginTop: 6 },

  costMetaTile: {
    minWidth: 140,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    ...Shadow.sm,
  },
  costMetaValue: { fontSize: 22, fontWeight: '800', color: Colors.textDark },
  costMetaLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2 },
  costMetaSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 6 },

  crisisBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.error,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
  },
  crisisTitle: { color: '#fff', fontWeight: '800', fontSize: FontSize.md },
  crisisSub: { color: '#fff', fontSize: FontSize.xs, opacity: 0.9 },
  crisisAction: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: '#fff', borderRadius: Radius.sm },
  crisisActionLabel: { color: Colors.error, fontWeight: '800', fontSize: FontSize.xs },

  toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.lg },
  toggleCard: {
    flex: 1, minWidth: 280,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
    ...Shadow.sm,
  },
  toggleCardOn: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  toggleTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  toggleSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, lineHeight: 18 },
  toggleBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgLight,
    borderWidth: 1, borderColor: Colors.border,
  },
  toggleBtnOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleBtnLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted },
  toggleBtnLabelOn: { color: '#fff' },

  digestCard: {
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.primary,
    marginBottom: Spacing.md,
  },
  digestCardTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.primary },
  digestCardWeek: { fontSize: FontSize.xs, color: Colors.primary, opacity: 0.7, fontWeight: '700' },
  digestCardBody: { fontSize: FontSize.xs, color: Colors.textDark, lineHeight: 18, marginVertical: 4 },
  digestCardCta: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.primary, marginTop: 4 },
});
