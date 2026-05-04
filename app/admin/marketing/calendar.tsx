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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../../constants/theme';
import { AdminPage, EmptyState, StatusBadge, ToolbarButton } from '../../../components/admin/ui';
import { listDrafts, scheduleDraft, unscheduleDraft } from '../../../services/marketingDrafts';
import { friendlyError } from '../../../services/marketingErrors';
import { MarketingDraft } from '../../../lib/marketingTypes';
import { useAuthStore } from '../../../store/useAuthStore';

// Drag-and-drop is web-only (RN Web forwards HTML drag events to the DOM
// element backing each View). On native the cards stay tap-to-open — drop
// targets and draggable={true} props are simply not rendered.
const DND = Platform.OS === 'web';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function MarketingCalendarScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [weekOffset, setWeekOffset] = useState(0);
  const [drafts, setDrafts] = useState<MarketingDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Banner tone after a drop succeeds/fails — auto-clears in 2.4s. */
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  /** Day-iso key currently under the cursor while dragging — drives hover styling. */
  const [hoverDay, setHoverDay] = useState<string | null>(null);

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

  const showBanner = useCallback((tone: 'ok' | 'err', text: string) => {
    setBanner({ tone, text });
    setTimeout(() => setBanner(null), 2400);
  }, []);

  /** Drop handler — moves a draft to a new day (preserving time-of-day) or
   *  to the unscheduled bucket. Optimistic update + Firestore write; rollback
   *  on failure. */
  const handleDrop = useCallback(async (draftId: string, targetDay: string | 'unscheduled') => {
    if (!user) return;
    const idx = drafts.findIndex((d) => d.id === draftId);
    if (idx < 0) return;
    const draft = drafts[idx];

    // Skip no-op: dropping a draft on its own current day.
    const currentDay = draft.scheduledAt ? istDayKey(draft.scheduledAt) : null;
    if (targetDay === currentDay) return;
    if (targetDay === 'unscheduled' && draft.status === 'approved' && !draft.scheduledAt) return;

    // Posted drafts can't be moved — their date is the truth.
    if (draft.status === 'posted') {
      showBanner('err', "Already posted — can't reschedule.");
      return;
    }

    // Optimistic local update so the card jumps immediately.
    const prev = drafts;
    const optimisticPatch: Partial<MarketingDraft> =
      targetDay === 'unscheduled'
        ? { status: 'approved', scheduledAt: null }
        : { status: 'scheduled', scheduledAt: composeIstIso(targetDay, draft.scheduledAt) };
    setDrafts(drafts.map((d, i) => i === idx ? { ...d, ...optimisticPatch } as MarketingDraft : d));

    try {
      const actor = { uid: user.uid, email: user.email };
      if (targetDay === 'unscheduled') {
        await unscheduleDraft(actor, draftId);
        showBanner('ok', 'Moved to Unscheduled.');
      } else {
        await scheduleDraft(actor, draftId, optimisticPatch.scheduledAt as string);
        showBanner('ok', `Rescheduled to ${formatDayLabel(targetDay)}.`);
      }
    } catch (e: any) {
      setDrafts(prev);
      showBanner('err', friendlyError('Reschedule', e));
    }
  }, [drafts, user, showBanner]);

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

        {banner ? (
          <View style={[styles.banner, banner.tone === 'err' && styles.bannerErr]}>
            <Ionicons
              name={banner.tone === 'ok' ? 'checkmark-circle' : 'alert-circle'}
              size={14}
              color={banner.tone === 'ok' ? Colors.success : Colors.error}
            />
            <Text style={[styles.bannerText, banner.tone === 'err' && { color: Colors.error }]}>{banner.text}</Text>
          </View>
        ) : null}

        {DND ? (
          <Text style={styles.dndHint}>Tip — drag any card to another day to reschedule.</Text>
        ) : null}

        <View style={styles.grid}>
          {week.days.map((d, idx) => {
            const dayDrafts = byDay[d.iso] ?? [];
            const isToday = d.iso === istToday();
            const isHover = hoverDay === d.iso;
            const dropProps = DND ? buildDropTargetProps({
              onEnter: () => setHoverDay(d.iso),
              onLeave: () => setHoverDay((h) => (h === d.iso ? null : h)),
              onDrop: (id) => { setHoverDay(null); void handleDrop(id, d.iso); },
            }) : {};
            return (
              <View
                key={d.iso}
                style={[styles.col, isHover && styles.colHover]}
                {...dropProps}
              >
                <View style={[styles.colHead, isToday && styles.colHeadToday]}>
                  <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{WEEKDAY_LABELS[idx]}</Text>
                  <Text style={[styles.dayDate, isToday && styles.dayDateToday]}>{d.dayOfMonth}</Text>
                </View>
                <View style={styles.colBody}>
                  {dayDrafts.length === 0 ? (
                    <View style={styles.dayEmpty}><Text style={styles.dayEmptyText}>{isHover ? 'Drop here' : '—'}</Text></View>
                  ) : (
                    dayDrafts.map((draft) => (
                      <DraftCardCompact
                        key={draft.id}
                        draft={draft}
                        onOpen={() => goToDraft(router, draft.id)}
                      />
                    ))
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {byDay.unscheduled.length > 0 || (DND && hoverDay === 'unscheduled') ? (
          <View
            style={[styles.unscheduledBlock, hoverDay === 'unscheduled' && styles.unscheduledHover]}
            {...(DND ? buildDropTargetProps({
              onEnter: () => setHoverDay('unscheduled'),
              onLeave: () => setHoverDay((h) => (h === 'unscheduled' ? null : h)),
              onDrop: (id) => { setHoverDay(null); void handleDrop(id, 'unscheduled'); },
            }) : {})}
          >
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
  // Posted drafts can't be moved — their date is the publication truth, not
  // a plan. Disable drag for them so the cursor doesn't suggest otherwise.
  const draggable = DND && draft.status !== 'posted';
  const dragProps = draggable ? buildDraggableProps(draft.id) : {};
  return (
    <Pressable
      onPress={onOpen}
      style={[styles.compactCard, draggable && styles.compactCardDraggable]}
      {...dragProps}
    >
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

// ── Web drag-and-drop helpers ──────────────────────────────────────────────
// HTML5 drag events. RN Web silently forwards these as DOM event handlers,
// but they're not in the React Native type defs — hence the unknown casts.

const DND_MIME = 'application/x-maamitra-draft-id';

function buildDraggableProps(draftId: string): Record<string, unknown> {
  return {
    draggable: true,
    onDragStart: (e: any) => {
      try {
        e.dataTransfer.setData(DND_MIME, draftId);
        e.dataTransfer.setData('text/plain', draftId);
        e.dataTransfer.effectAllowed = 'move';
      } catch {/* noop */}
    },
  };
}

function buildDropTargetProps(handlers: {
  onEnter: () => void;
  onLeave: () => void;
  onDrop: (draftId: string) => void;
}): Record<string, unknown> {
  return {
    onDragEnter: (e: any) => { try { e.preventDefault(); } catch {/* noop */} handlers.onEnter(); },
    onDragOver: (e: any) => {
      // Calling preventDefault here is what tells the browser this is a
      // valid drop target — without it onDrop never fires.
      try { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } catch {/* noop */}
    },
    onDragLeave: () => handlers.onLeave(),
    onDrop: (e: any) => {
      try { e.preventDefault(); } catch {/* noop */}
      const id = (e?.dataTransfer?.getData?.(DND_MIME) || e?.dataTransfer?.getData?.('text/plain') || '').toString();
      if (id) handlers.onDrop(id);
    },
  };
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

/** Build an ISO scheduledAt for a target IST day, preserving the existing
 *  time-of-day if one was set. Default to 09:00 IST when re-scheduling a
 *  draft that had no schedule. */
function composeIstIso(targetDayIso: string, existingScheduledAt: string | null | undefined): string {
  let hh = 9;
  let mm = 0;
  if (existingScheduledAt) {
    const istShifted = new Date(new Date(existingScheduledAt).getTime() + 5.5 * 3600 * 1000);
    hh = istShifted.getUTCHours();
    mm = istShifted.getUTCMinutes();
  }
  // Convert {targetDay IST hh:mm} → UTC ISO. IST is UTC+5:30 with no DST.
  const [y, mo, d] = targetDayIso.split('-').map(Number);
  // Build the IST instant by treating it as UTC, then subtracting 5h30m.
  const istAsUtc = Date.UTC(y, (mo ?? 1) - 1, d ?? 1, hh, mm, 0);
  const utcMs = istAsUtc - 5.5 * 3600 * 1000;
  return new Date(utcMs).toISOString();
}

function formatDayLabel(targetDayIso: string): string {
  const [y, mo, d] = targetDayIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (mo ?? 1) - 1, d ?? 1));
  const month = dt.toLocaleString('en', { month: 'short' });
  return `${month} ${d}`;
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

  unscheduledBlock: {
    marginTop: Spacing.lg,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: 'transparent',
  },
  unscheduledHover: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  unscheduledRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textLight,
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },

  // Drag-and-drop affordances
  colHover: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  compactCardDraggable: { cursor: 'grab' as any },
  dndHint: {
    fontSize: 11, color: Colors.textMuted, fontStyle: 'italic',
    marginBottom: Spacing.sm,
  },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.success,
    marginBottom: Spacing.sm,
  },
  bannerErr: { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: Colors.error },
  bannerText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.success },
});
