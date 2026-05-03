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
  summariseCost,
} from '../../../services/marketing';
import { BrandKit } from '../../../lib/marketingTypes';

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
  const [brand, setBrand] = useState<BrandKit | null>(null);
  const [costRows, setCostRows] = useState<CostLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [k, rows] = await Promise.all([fetchBrandKit(), fetchRecentCostLog(120)]);
      setBrand(k);
      setCostRows(rows);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
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
      label: 'Daily draft generator',
      description: 'Cron at 6am IST: Claude Haiku writes captions, picks template + theme, renders PNG, queues a draft for review. Coming in Phase 3.',
      state: 'pending',
      hint: 'Phase 3',
    },
    {
      key: 'webhook',
      label: 'Webhook receiver',
      description: 'Public Firebase Function endpoint that ingests Meta events (comments, DMs, mentions). Also unblocks the Meta data-deletion URL. Coming in Phase 5.',
      state: 'pending',
      hint: 'Phase 5',
    },
    {
      key: 'inbox',
      label: 'Unified inbox',
      description: 'IG + FB comments and DMs in one queue with AI reply suggestions in your brand voice. Coming in Phase 6.',
      state: 'pending',
      hint: 'Phase 6',
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
        <View style={styles.statBar}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{doneCount}<Text style={styles.statTotal}> / {checklist.length}</Text></Text>
            <Text style={styles.statLabel}>Setup steps complete</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>2</Text>
            <Text style={styles.statLabel}>Use cases · 10 perms</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Drafts in queue</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Unread inbox</Text>
          </View>
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
});
