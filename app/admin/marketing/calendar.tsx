/**
 * Admin · Marketing calendar (M3).
 *
 * Week-grid view of approved + scheduled + posted drafts, plotted on
 * their scheduledAt day (for scheduled) or approvedAt day (for approved
 * with no schedule yet, shown in a separate "unscheduled" column).
 *
 * Scope is the current ISO week by default; arrows step ±1 week.
 *
 * Clicking a card jumps into the queue with that draft pre-opened in
 * the slide-over.
 */

import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../../constants/theme';
import { AdminPage, EmptyState, StatusBadge, ToolbarButton } from '../../../components/admin/ui';
import { listDrafts } from '../../../services/marketingDrafts';
import { MarketingDraft } from '../../../lib/marketingTypes';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function MarketingCalendarScreen() {
  const router = useRouter();
  const [weekOffset, setWeekOffset] = useState(0);
  const [drafts, setDrafts] = useState<MarketingDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const rows = await listDrafts({ limitN: 200 });
      setDrafts(rows);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  const week = useMemo(() => weekFromOffset(weekOffset), [weekOffset]);

  const byDay: Record<string, MarketingDraft[]> = useMemo(() => {
    const out: Record<string, MarketingDraft[]> = { unscheduled: [] };
    week.days.forEach((d) => { out[d.iso] = []; });
    for (const draft of drafts) {
      // Only show posts that have made it past pending_review.
      if (draft.status === 'pending_review' || draft.status === 'rejected') continue;
      const ts = draft.scheduledAt ?? draft.approvedAt ?? draft.postedAt;
      if (!ts) {
        out.unscheduled.push(draft);
        continue;
      }
      const dayKey = istDayKey(ts);
      if (out[dayKey]) out[dayKey].push(draft);
      else if (draft.status === 'approved') out.unscheduled.push(draft);
    }
    return out;
  }, [drafts, week]);

  return (
    <>
      <Stack.Screen options={{ title: 'Calendar' }} />
      <AdminPage
        title="Calendar"
        description="Approved + scheduled + posted drafts plotted by day. Click a card to open it."
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Marketing', href: '/admin/marketing' },
          { label: 'Calendar' },
        ]}
        headerActions={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <ToolbarButton label="Refresh" icon="refresh" onPress={load} />
          </View>
        }
        loading={loading && drafts.length === 0}
        error={error}
      >
        <View style={styles.weekBar}>
          <Pressable style={styles.weekArrow} onPress={() => setWeekOffset((n) => n - 1)}>
            <Ionicons name="chevron-back" size={18} color={Colors.textDark} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.weekTitle}>
              {weekOffset === 0 ? 'This week' : weekOffset === -1 ? 'Last week' : weekOffset === 1 ? 'Next week' : `Week of ${week.days[0].iso}`}
            </Text>
            <Text style={styles.weekRange}>{week.days[0].iso} → {week.days[6].iso}</Text>
          </View>
          <Pressable style={styles.weekArrow} onPress={() => setWeekOffset((n) => n + 1)}>
            <Ionicons name="chevron-forward" size={18} color={Colors.textDark} />
          </Pressable>
          <Pressable style={[styles.weekArrow, weekOffset !== 0 && { backgroundColor: Colors.primarySoft }]} onPress={() => setWeekOffset(0)}>
            <Text style={[styles.todayLabel, weekOffset !== 0 && { color: Colors.primary }]}>Today</Text>
          </Pressable>
        </View>

        <View style={styles.grid}>
          {week.days.map((d, idx) => {
            const dayDrafts = byDay[d.iso] ?? [];
            const isToday = d.iso === istToday();
            return (
              <View key={d.iso} style={styles.col}>
                <View style={[styles.colHead, isToday && styles.colHeadToday]}>
                  <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{WEEKDAY_LABELS[idx]}</Text>
                  <Text style={[styles.dayDate, isToday && styles.dayDateToday]}>{d.dayOfMonth}</Text>
                </View>
                <View style={styles.colBody}>
                  {dayDrafts.length === 0 ? (
                    <View style={styles.dayEmpty}><Text style={styles.dayEmptyText}>—</Text></View>
                  ) : (
                    dayDrafts.map((draft) => <DraftCardCompact key={draft.id} draft={draft} onOpen={() => goToDraft(router, draft.id)} />)
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {byDay.unscheduled.length > 0 ? (
          <View style={styles.unscheduledBlock}>
            <Text style={styles.sectionLabel}>Unscheduled · {byDay.unscheduled.length}</Text>
            <View style={styles.unscheduledRow}>
              {byDay.unscheduled.map((d) => (
                <DraftCardCompact key={d.id} draft={d} onOpen={() => goToDraft(router, d.id)} />
              ))}
            </View>
          </View>
        ) : null}

        {drafts.length === 0 ? (
          <View style={{ marginTop: Spacing.lg }}>
            <EmptyState
              kind="empty"
              title="No drafts yet"
              body="Generate drafts from the Drafts queue, then schedule them here."
            />
          </View>
        ) : null}
      </AdminPage>
    </>
  );
}

function DraftCardCompact({ draft, onOpen }: { draft: MarketingDraft; onOpen: () => void }) {
  const tone = draft.status === 'posted' ? Colors.success : draft.status === 'scheduled' ? Colors.primary : Colors.textMuted;
  const time = draft.scheduledAt ? istHHmm(draft.scheduledAt) : null;
  return (
    <Pressable onPress={onOpen} style={styles.compactCard}>
      {draft.assets[0]?.url ? (
        <Image source={{ uri: draft.assets[0].url }} style={styles.compactThumb} resizeMode="cover" />
      ) : (
        <View style={[styles.compactThumb, styles.thumbPlaceholder]}>
          <Ionicons name="image-outline" size={18} color={Colors.textMuted} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.compactHead}>
          <StatusBadge label={draft.status.replace('_', ' ')} color={tone} />
          {time ? <Text style={styles.compactTime}>{time}</Text> : null}
        </View>
        <Text style={styles.compactTitle} numberOfLines={2}>{draft.headline ?? '(untitled)'}</Text>
        <Text style={styles.compactMeta} numberOfLines={1}>
          {[draft.pillarLabel, draft.personaLabel].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function goToDraft(router: ReturnType<typeof useRouter>, id: string) {
  router.push({ pathname: '/admin/marketing/drafts', params: { open: id } } as any);
}

interface WeekDay { iso: string; dayOfMonth: number }
function weekFromOffset(offset: number): { days: WeekDay[] } {
  const today = istNowStartOfDay();
  // Go back to Monday of current week (IST).
  const day = today.getUTCDay(); // 0 = Sun
  const mondayDelta = (day + 6) % 7; // 0 if Mon, 6 if Sun
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - mondayDelta + offset * 7);
  const days: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    days.push({ iso: d.toISOString().slice(0, 10), dayOfMonth: d.getUTCDate() });
  }
  return { days };
}

function istNowStartOfDay(): Date {
  // Crude IST: shift UTC by 5h30m. India doesn't observe DST.
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  ist.setUTCHours(0, 0, 0, 0);
  return ist;
}

function istToday(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

function istDayKey(iso: string): string {
  const t = new Date(iso).getTime() + 5.5 * 3600 * 1000;
  return new Date(t).toISOString().slice(0, 10);
}

function istHHmm(iso: string): string {
  const t = new Date(iso).getTime() + 5.5 * 3600 * 1000;
  const d = new Date(t);
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

const styles = StyleSheet.create({
  weekBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    borderWidth: 1, borderColor: Colors.borderSoft,
    ...Shadow.sm,
  },
  weekArrow: {
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  weekTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  weekRange: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  todayLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted },

  grid: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  col: {
    flex: 1, minWidth: 130,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
    overflow: 'hidden',
  },
  colHead: {
    paddingVertical: 8, paddingHorizontal: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSoft,
    backgroundColor: Colors.bgLight,
  },
  colHeadToday: { backgroundColor: Colors.primarySoft, borderBottomColor: Colors.primary },
  dayLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' },
  dayLabelToday: { color: Colors.primary },
  dayDate: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textDark },
  dayDateToday: { color: Colors.primary },

  colBody: { padding: 6, gap: 6, minHeight: 120 },
  dayEmpty: { paddingVertical: 12, alignItems: 'center' },
  dayEmptyText: { color: Colors.textMuted, fontSize: FontSize.xs },

  compactCard: {
    flexDirection: 'row', gap: 8,
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.sm,
    padding: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  compactThumb: { width: 40, height: 40, borderRadius: Radius.sm, backgroundColor: Colors.bgLight },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  compactHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  compactTime: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  compactTitle: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textDark, lineHeight: 16 },
  compactMeta: { fontSize: 10, color: Colors.textMuted },

  unscheduledBlock: { marginTop: Spacing.lg },
  unscheduledRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textLight,
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
});
