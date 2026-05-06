/**
 * Publishing Calendar — shared month-grid calendar of approved + scheduled +
 * posted drafts, used on both /admin/marketing/calendar and the Calendar tab
 * inside /admin/marketing/posts. Replaces the v1 week-grid view.
 *
 * Layout: 6-week month grid (7 cols × 6 rows). Each cell shows the day
 * number, up to 2 thumbnails, and a "+N more" overflow chip. Click a
 * thumbnail → opens the rich slide-over on /drafts. Web supports drag-drop
 * to reschedule (mirrors the v1 week-grid behaviour).
 *
 * Mobile (≤700px): falls back to a vertical list grouped by day, since a
 * 7-col month grid doesn't fit at phone widths.
 */

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import { listDrafts, scheduleDraft, unscheduleDraft } from '../../services/marketingDrafts';
import { friendlyError } from '../../services/marketingErrors';
import { MarketingDraft } from '../../lib/marketingTypes';
import { useAuthStore } from '../../store/useAuthStore';

// Drag-and-drop is web-only (RN Web forwards HTML drag events to the DOM
// element backing each View). On native the cards stay tap-to-open.
const DND = Platform.OS === 'web';

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function PublishingCalendar() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { width } = useWindowDimensions();
  const compact = width < 760; // Phone / narrow tablet → list view.

  const [monthOffset, setMonthOffset] = useState(0);
  const [drafts, setDrafts] = useState<MarketingDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [hoverDay, setHoverDay] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 500 covers ~4 weeks × 5 slots/day × buffer for posted history.
      const rows = await listDrafts({ limitN: 500 });
      setDrafts(rows);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const showBanner = useCallback((tone: 'ok' | 'err', text: string) => {
    setBanner({ tone, text });
    setTimeout(() => setBanner(null), 2400);
  }, []);

  const handleDrop = useCallback(async (draftId: string, targetDay: string | 'unscheduled') => {
    if (!user) return;
    const idx = drafts.findIndex((d) => d.id === draftId);
    if (idx < 0) return;
    const draft = drafts[idx];

    const currentDay = draft.scheduledAt ? istDayKey(draft.scheduledAt) : null;
    if (targetDay === currentDay) return;
    if (targetDay === 'unscheduled' && draft.status === 'approved' && !draft.scheduledAt) return;

    if (draft.status === 'posted') {
      showBanner('err', "Already posted — can't reschedule.");
      return;
    }

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

  const month = useMemo(() => monthFromOffset(monthOffset), [monthOffset]);

  const byDay: Record<string, MarketingDraft[]> = useMemo(() => {
    const out: Record<string, MarketingDraft[]> = { unscheduled: [] };
    month.cells.forEach((c) => { out[c.iso] = []; });
    for (const draft of drafts) {
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
    // Sort each day by scheduled time so the earliest post lands at the top.
    for (const key of Object.keys(out)) {
      out[key].sort((a, b) => {
        const ta = a.scheduledAt ?? a.postedAt ?? '';
        const tb = b.scheduledAt ?? b.postedAt ?? '';
        return ta.localeCompare(tb);
      });
    }
    return out;
  }, [drafts, month]);

  const todayIso = istToday();

  return (
    <View style={{ gap: Spacing.md }}>
      <View style={styles.bar}>
        <Pressable style={styles.arrow} onPress={() => setMonthOffset((n) => n - 1)} accessibilityLabel="Previous month">
          <Ionicons name="chevron-back" size={18} color={Colors.textDark} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.barTitle}>{month.label}</Text>
          <Text style={styles.barSub}>
            {drafts.filter((d) => {
              const ts = d.scheduledAt ?? d.postedAt;
              if (!ts) return false;
              const k = istDayKey(ts);
              return month.cells.some((c) => c.iso === k && c.inMonth);
            }).length} posts this month
          </Text>
        </View>
        <Pressable style={styles.arrow} onPress={() => setMonthOffset((n) => n + 1)} accessibilityLabel="Next month">
          <Ionicons name="chevron-forward" size={18} color={Colors.textDark} />
        </Pressable>
        {monthOffset !== 0 ? (
          <Pressable style={[styles.arrow, { backgroundColor: Colors.primarySoft }]} onPress={() => setMonthOffset(0)}>
            <Text style={[styles.todayLabel, { color: Colors.primary }]}>Today</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.arrow} onPress={load} accessibilityLabel="Refresh">
          <Ionicons name="refresh" size={16} color={Colors.textDark} />
        </Pressable>
      </View>

      {error ? (
        <View style={[styles.banner, styles.bannerErr]}>
          <Ionicons name="alert-circle" size={14} color={Colors.error} />
          <Text style={[styles.bannerText, { color: Colors.error }]}>{error}</Text>
        </View>
      ) : null}

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

      {DND && !compact ? (
        <Text style={styles.dndHint}>Tip — drag any card to another day to reschedule.</Text>
      ) : null}

      {compact ? (
        <CompactDayList
          month={month}
          byDay={byDay}
          todayIso={todayIso}
          onOpen={(id) => goToDraft(router, id)}
        />
      ) : (
        <MonthGrid
          month={month}
          byDay={byDay}
          todayIso={todayIso}
          hoverDay={hoverDay}
          onHover={setHoverDay}
          onOpen={(id) => goToDraft(router, id)}
          onDrop={handleDrop}
        />
      )}

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

      {!loading && drafts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="calendar-outline" size={28} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No drafts yet</Text>
          <Text style={styles.emptyBody}>Generate drafts from the Drafts queue, then schedule them here.</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Month grid (desktop / wide) ─────────────────────────────────────────────

function MonthGrid({
  month,
  byDay,
  todayIso,
  hoverDay,
  onHover,
  onOpen,
  onDrop,
}: {
  month: ReturnType<typeof monthFromOffset>;
  byDay: Record<string, MarketingDraft[]>;
  todayIso: string;
  hoverDay: string | null;
  onHover: (iso: string | null) => void;
  onOpen: (id: string) => void;
  onDrop: (draftId: string, targetDay: string | 'unscheduled') => void;
}) {
  return (
    <View style={styles.monthBox}>
      <View style={styles.headerRow}>
        {WEEKDAY_HEADERS.map((label) => (
          <View key={label} style={styles.headerCell}>
            <Text style={styles.headerCellText}>{label}</Text>
          </View>
        ))}
      </View>
      {Array.from({ length: month.cells.length / 7 }).map((_, weekIdx) => (
        <View key={weekIdx} style={styles.weekRow}>
          {month.cells.slice(weekIdx * 7, (weekIdx + 1) * 7).map((cell) => {
            const items = byDay[cell.iso] ?? [];
            const isToday = cell.iso === todayIso;
            const isHover = hoverDay === cell.iso;
            const dropProps = DND ? buildDropTargetProps({
              onEnter: () => onHover(cell.iso),
              onLeave: () => onHover(hoverDay === cell.iso ? null : hoverDay),
              onDrop: (id) => { onHover(null); onDrop(id, cell.iso); },
            }) : {};
            return (
              <View
                key={cell.iso}
                style={[
                  styles.dayCell,
                  !cell.inMonth && styles.dayCellOutOfMonth,
                  isToday && styles.dayCellToday,
                  isHover && styles.dayCellHover,
                ]}
                {...dropProps}
              >
                <View style={styles.dayCellHead}>
                  <Text style={[
                    styles.dayCellNum,
                    !cell.inMonth && styles.dayCellNumOut,
                    isToday && styles.dayCellNumToday,
                  ]}>{cell.dayOfMonth}</Text>
                  {items.length > 0 ? (
                    <View style={styles.dayCellCount}>
                      <Text style={styles.dayCellCountText}>{items.length}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.dayCellBody}>
                  {items.slice(0, 2).map((draft) => (
                    <DraftThumbItem
                      key={draft.id}
                      draft={draft}
                      onOpen={() => onOpen(draft.id)}
                    />
                  ))}
                  {items.length > 2 ? (
                    <Pressable onPress={() => onOpen(items[2].id)} style={styles.moreChip}>
                      <Text style={styles.moreChipText}>+{items.length - 2} more</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ── Compact mobile list ─────────────────────────────────────────────────────

function CompactDayList({
  month,
  byDay,
  todayIso,
  onOpen,
}: {
  month: ReturnType<typeof monthFromOffset>;
  byDay: Record<string, MarketingDraft[]>;
  todayIso: string;
  onOpen: (id: string) => void;
}) {
  // Show only days IN the month with at least one item, plus "today" if empty.
  const days = month.cells.filter((c) => c.inMonth && ((byDay[c.iso] ?? []).length > 0 || c.iso === todayIso));
  return (
    <View style={{ gap: 10 }}>
      {days.map((cell) => {
        const items = byDay[cell.iso] ?? [];
        const isToday = cell.iso === todayIso;
        return (
          <View key={cell.iso} style={[styles.compactDay, isToday && styles.compactDayToday]}>
            <View style={styles.compactDayHead}>
              <Text style={[styles.compactDayDate, isToday && { color: Colors.primary }]}>
                {cell.dayOfMonth} · {WEEKDAY_HEADERS[(cell.weekday + 6) % 7]}
              </Text>
              {items.length > 0 ? <Text style={styles.compactDayCount}>{items.length}</Text> : null}
            </View>
            {items.length === 0 ? (
              <Text style={styles.dayEmptyText}>Nothing scheduled</Text>
            ) : (
              <View style={{ gap: 6 }}>
                {items.map((draft) => (
                  <DraftCardCompact key={draft.id} draft={draft} onOpen={() => onOpen(draft.id)} />
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ── Cell-level draft items ──────────────────────────────────────────────────

function DraftThumbItem({ draft, onOpen }: { draft: MarketingDraft; onOpen: () => void }) {
  const tone = draft.status === 'posted' ? Colors.success : draft.status === 'scheduled' ? Colors.primary : Colors.textMuted;
  const time = draft.scheduledAt ? istHHmm(draft.scheduledAt) : null;
  const draggable = DND && draft.status !== 'posted';
  const dragProps = draggable ? buildDraggableProps(draft.id) : {};
  const url = draft.assets[0]?.url;
  return (
    <Pressable
      onPress={onOpen}
      style={[styles.thumbItem, { borderLeftColor: tone }, draggable && styles.thumbItemDraggable]}
      {...dragProps}
    >
      {url ? (
        <Image source={{ uri: url }} style={styles.thumbItemImg} resizeMode="cover" />
      ) : (
        <View style={[styles.thumbItemImg, styles.thumbPlaceholder]}>
          <Ionicons name="image-outline" size={12} color={Colors.textMuted} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        {time ? <Text style={styles.thumbItemTime}>{time}</Text> : null}
        <Text style={styles.thumbItemTitle} numberOfLines={1}>
          {draft.headline ?? draft.caption.slice(0, 40) ?? '(untitled)'}
        </Text>
      </View>
    </Pressable>
  );
}

function DraftCardCompact({ draft, onOpen }: { draft: MarketingDraft; onOpen: () => void }) {
  const tone = draft.status === 'posted' ? Colors.success : draft.status === 'scheduled' ? Colors.primary : Colors.textMuted;
  const time = draft.scheduledAt ? istHHmm(draft.scheduledAt) : null;
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
          <View style={[styles.statusDot, { backgroundColor: tone }]} />
          <Text style={[styles.statusLabel, { color: tone }]}>{draft.status.replace('_', ' ')}</Text>
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

// ── Date helpers ────────────────────────────────────────────────────────────

function goToDraft(router: ReturnType<typeof useRouter>, id: string) {
  router.push({ pathname: '/admin/marketing/drafts', params: { open: id } } as any);
}

interface MonthCell { iso: string; dayOfMonth: number; inMonth: boolean; weekday: number }

/** Build the visible month grid for the given offset (0 = current IST month).
 *  Always returns 42 cells (6 weeks) so layout is stable when months span
 *  4-vs-5 visible weeks. Week starts Monday. */
function monthFromOffset(offset: number): { cells: MonthCell[]; label: string; year: number; month: number } {
  const now = istNow();
  const year = now.getUTCFullYear();
  const monthIdx = now.getUTCMonth() + offset;
  const target = new Date(Date.UTC(year, monthIdx, 1));
  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth();

  // Find Monday on or before the 1st.
  const firstWeekday = target.getUTCDay(); // 0=Sun
  const mondayOffset = (firstWeekday + 6) % 7; // 0 if Mon
  const gridStart = new Date(target);
  gridStart.setUTCDate(target.getUTCDate() - mondayOffset);

  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);
    cells.push({
      iso: d.toISOString().slice(0, 10),
      dayOfMonth: d.getUTCDate(),
      inMonth: d.getUTCMonth() === targetMonth,
      weekday: d.getUTCDay(),
    });
  }

  return {
    cells,
    label: `${MONTH_NAMES[targetMonth]} ${targetYear}`,
    year: targetYear,
    month: targetMonth,
  };
}

function istNow(): Date {
  return new Date(Date.now() + 5.5 * 3600 * 1000);
}

function istToday(): string {
  return istNow().toISOString().slice(0, 10);
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

function composeIstIso(targetDayIso: string, existingScheduledAt: string | null | undefined): string {
  let hh = 9;
  let mm = 0;
  if (existingScheduledAt) {
    const istShifted = new Date(new Date(existingScheduledAt).getTime() + 5.5 * 3600 * 1000);
    hh = istShifted.getUTCHours();
    mm = istShifted.getUTCMinutes();
  }
  const [y, mo, d] = targetDayIso.split('-').map(Number);
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

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    borderWidth: 1, borderColor: Colors.borderSoft,
    ...Shadow.sm,
  },
  arrow: {
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  barTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  barSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  todayLabel: { fontSize: FontSize.xs, fontWeight: '700' },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.success,
  },
  bannerErr: { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: Colors.error },
  bannerText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.success, flex: 1 },

  dndHint: {
    fontSize: 11, color: Colors.textMuted, fontStyle: 'italic',
  },

  monthBox: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: Colors.bgLight,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSoft,
  },
  headerCell: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  headerCellText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' },

  weekRow: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: Colors.borderSoft,
    minHeight: 110,
  },
  dayCell: {
    flex: 1,
    padding: 6,
    borderRightWidth: 1, borderRightColor: Colors.borderSoft,
    backgroundColor: Colors.cardBg,
    minHeight: 110,
  },
  dayCellOutOfMonth: { backgroundColor: Colors.bgLight },
  dayCellToday: { backgroundColor: Colors.primarySoft },
  dayCellHover: { backgroundColor: Colors.primarySoft, borderRightColor: Colors.primary },
  dayCellHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  dayCellNum: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  dayCellNumOut: { color: Colors.textMuted },
  dayCellNumToday: { color: Colors.primary },
  dayCellCount: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 5, paddingVertical: 1,
    minWidth: 16, alignItems: 'center',
  },
  dayCellCountText: { fontSize: 9, fontWeight: '800', color: Colors.white },
  dayCellBody: { gap: 4 },

  thumbItem: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.bgLight,
    borderRadius: 4,
    padding: 3,
    borderLeftWidth: 2,
  },
  thumbItemDraggable: { cursor: 'grab' as any },
  thumbItemImg: { width: 22, height: 22, borderRadius: 3, backgroundColor: Colors.bgLight },
  thumbItemTime: { fontSize: 9, fontWeight: '700', color: Colors.primary, lineHeight: 11 },
  thumbItemTitle: { fontSize: 10, fontWeight: '600', color: Colors.textDark, lineHeight: 12 },

  moreChip: {
    paddingHorizontal: 4, paddingVertical: 2,
    backgroundColor: Colors.bgLight,
    borderRadius: 4,
  },
  moreChipText: { fontSize: 9, fontWeight: '700', color: Colors.textMuted, textAlign: 'center' },

  // Compact (mobile) list view
  compactDay: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
    padding: Spacing.sm,
    gap: 6,
  },
  compactDayToday: { borderColor: Colors.primary },
  compactDayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  compactDayDate: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  compactDayCount: {
    fontSize: 10, fontWeight: '800',
    color: Colors.white, backgroundColor: Colors.primary,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
  },
  dayEmptyText: { color: Colors.textMuted, fontSize: FontSize.xs, fontStyle: 'italic' },

  compactCard: {
    flexDirection: 'row', gap: 8,
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.sm,
    padding: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  compactCardDraggable: { cursor: 'grab' as any },
  compactThumb: { width: 40, height: 40, borderRadius: Radius.sm, backgroundColor: Colors.bgLight },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  compactHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  compactTime: { fontSize: 10, fontWeight: '700', color: Colors.primary, marginLeft: 'auto' },
  compactTitle: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textDark, lineHeight: 16 },
  compactMeta: { fontSize: 10, color: Colors.textMuted },

  unscheduledBlock: {
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

  emptyCard: {
    alignItems: 'center', gap: 8,
    paddingVertical: Spacing.xl,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  emptyTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  emptyBody: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', maxWidth: 360 },
});
