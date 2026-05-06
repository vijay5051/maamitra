/**
 * Publishing Calendar — shared month-grid calendar of approved + scheduled +
 * posted drafts, used on both /admin/marketing/calendar and the Calendar tab
 * inside /admin/marketing/posts.
 *
 * Layout: 6-week month grid (7 cols × 6 rows). Each cell shows the day
 * number, up to 2 thumbnails, and a "+N more" overflow chip. Mobile
 * (<760px) falls back to a vertical list grouped by day.
 *
 * Interactions:
 *   - Click a thumb → opens an in-place cancellable preview modal (no
 *     surprise route changes). The preview has an "Edit in editor" CTA
 *     that pushes /drafts?open=id when the admin actually wants to edit.
 *   - Click a day cell or its "+N more" chip → opens a day-detail modal
 *     listing every draft on that day, sorted by time. Each row opens
 *     the same preview modal.
 *   - Drag a future-day card to another future day (web only) → opens a
 *     time-picker modal so the admin can confirm the new scheduledAt.
 *     Past / posted drafts are not draggable.
 *
 * Drag wiring uses imperative DOM event listeners (refs + useEffect)
 * rather than JSX props on Pressable. RN Web's Pressable swallows
 * pointer events in ways that broke the JSX-prop pattern; the native
 * dragstart/dragover/drop listeners on the underlying div are
 * deterministic.
 */

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import { listDrafts, scheduleDraft, unscheduleDraft } from '../../services/marketingDrafts';
import { friendlyError } from '../../services/marketingErrors';
import { MarketingDraft } from '../../lib/marketingTypes';
import { useAuthStore } from '../../store/useAuthStore';

const DND = Platform.OS === 'web';

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const DND_MIME = 'application/x-maamitra-draft-id';

export function PublishingCalendar() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { width } = useWindowDimensions();
  const compact = width < 760;

  const [monthOffset, setMonthOffset] = useState(0);
  const [drafts, setDrafts] = useState<MarketingDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [hoverDay, setHoverDay] = useState<string | null>(null);

  // Drag-drop produces a pending reschedule that opens the time picker.
  const [pendingReschedule, setPendingReschedule] = useState<
    | { draftId: string; targetDay: string; defaultTime: string }
    | null
  >(null);
  // Day-detail modal (shows every post on a chosen day).
  const [dayDetailIso, setDayDetailIso] = useState<string | null>(null);
  // True while admin is dragging an item from inside the day-detail modal —
  // we lower the modal's opacity + disable pointer-events so the underlying
  // calendar cells can receive the drop event. Without this the scrim swallows
  // the drag and the user thinks drop is broken inside the modal.
  const [draggingInModal, setDraggingInModal] = useState(false);
  // In-place draft preview modal (cancellable).
  const [previewDraft, setPreviewDraft] = useState<MarketingDraft | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
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

  const beginReschedule = useCallback((draftId: string, targetDay: string) => {
    const draft = drafts.find((d) => d.id === draftId);
    if (!draft) return;
    if (draft.status === 'posted') {
      showBanner('err', "Already posted — can't reschedule.");
      return;
    }
    const currentDay = draft.scheduledAt ? istDayKey(draft.scheduledAt) : null;
    if (targetDay === currentDay) return;
    const defaultTime = draft.scheduledAt ? istHHmm(draft.scheduledAt) : '09:00';
    setPendingReschedule({ draftId, targetDay, defaultTime });
  }, [drafts, showBanner]);

  const confirmReschedule = useCallback(async (newTime: string) => {
    if (!pendingReschedule || !user) return;
    const { draftId, targetDay } = pendingReschedule;
    const newScheduledAt = composeIstIso(targetDay, newTime);

    // Optimistic UI.
    const prev = drafts;
    setDrafts(drafts.map((d) =>
      d.id === draftId ? { ...d, status: 'scheduled' as const, scheduledAt: newScheduledAt } : d,
    ));
    setPendingReschedule(null);

    try {
      await scheduleDraft({ uid: user.uid, email: user.email }, draftId, newScheduledAt);
      showBanner('ok', `Rescheduled to ${formatDayLabel(targetDay)} at ${newTime}.`);
    } catch (e: any) {
      setDrafts(prev);
      showBanner('err', friendlyError('Reschedule', e));
    }
  }, [pendingReschedule, user, drafts, showBanner]);

  const moveToUnscheduled = useCallback(async (draftId: string) => {
    if (!user) return;
    const draft = drafts.find((d) => d.id === draftId);
    if (!draft) return;
    if (draft.status === 'posted') {
      showBanner('err', "Already posted — can't reschedule.");
      return;
    }
    if (draft.status === 'approved' && !draft.scheduledAt) return;

    const prev = drafts;
    setDrafts(drafts.map((d) =>
      d.id === draftId ? { ...d, status: 'approved' as const, scheduledAt: null } : d,
    ));
    try {
      await unscheduleDraft({ uid: user.uid, email: user.email }, draftId);
      showBanner('ok', 'Moved to Unscheduled.');
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
        <Text style={styles.dndHint}>Tip — drag any future-day card to another day to reschedule.</Text>
      ) : null}

      {compact ? (
        <CompactDayList
          month={month}
          byDay={byDay}
          todayIso={todayIso}
          onOpen={(d) => setPreviewDraft(d)}
          onOpenDay={(iso) => setDayDetailIso(iso)}
        />
      ) : (
        <MonthGrid
          month={month}
          byDay={byDay}
          todayIso={todayIso}
          hoverDay={hoverDay}
          onHover={setHoverDay}
          onOpenDraft={(d) => setPreviewDraft(d)}
          onOpenDay={(iso) => setDayDetailIso(iso)}
          onDrop={beginReschedule}
        />
      )}

      {byDay.unscheduled.length > 0 || (DND && hoverDay === 'unscheduled') ? (
        <UnscheduledDropZone
          items={byDay.unscheduled}
          isHover={hoverDay === 'unscheduled'}
          onHoverChange={(active) => setHoverDay(active ? 'unscheduled' : null)}
          onDrop={moveToUnscheduled}
          onOpen={(d) => setPreviewDraft(d)}
        />
      ) : null}

      {!loading && drafts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="calendar-outline" size={28} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No drafts yet</Text>
          <Text style={styles.emptyBody}>Generate drafts from the Drafts queue, then schedule them here.</Text>
        </View>
      ) : null}

      {pendingReschedule ? (
        <ReschedulePicker
          targetDay={pendingReschedule.targetDay}
          defaultTime={pendingReschedule.defaultTime}
          onConfirm={confirmReschedule}
          onCancel={() => setPendingReschedule(null)}
        />
      ) : null}

      {dayDetailIso ? (
        <DayPostsModal
          dayIso={dayDetailIso}
          items={byDay[dayDetailIso] ?? []}
          ghosted={draggingInModal}
          isPast={dayDetailIso < todayIso}
          onOpenDraft={(d) => { setPreviewDraft(d); setDayDetailIso(null); }}
          onClose={() => { setDraggingInModal(false); setDayDetailIso(null); }}
          onItemDragStart={() => setDraggingInModal(true)}
          onItemDragEnd={() => {
            // dragend fires on every drag — successful or cancelled. The
            // calendar cell's drop handler already triggers beginReschedule
            // independently; here we only need to un-ghost + close the day
            // modal once a drag completes so the time picker (or no-op
            // cancel) is the only foreground UI left.
            setDraggingInModal(false);
            setDayDetailIso(null);
          }}
        />
      ) : null}

      {previewDraft ? (
        <PostPreviewModal
          draft={previewDraft}
          onEdit={(id) => { setPreviewDraft(null); router.push(`/admin/marketing/drafts?open=${id}` as any); }}
          onClose={() => setPreviewDraft(null)}
        />
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
  onOpenDraft,
  onOpenDay,
  onDrop,
}: {
  month: ReturnType<typeof monthFromOffset>;
  byDay: Record<string, MarketingDraft[]>;
  todayIso: string;
  hoverDay: string | null;
  onHover: (iso: string | null) => void;
  onOpenDraft: (draft: MarketingDraft) => void;
  onOpenDay: (iso: string) => void;
  onDrop: (draftId: string, targetDay: string) => void;
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
            const isPast = cell.iso < todayIso;
            return (
              <DayCell
                key={cell.iso}
                cell={cell}
                items={items}
                isToday={isToday}
                isPast={isPast}
                isHover={isHover}
                onHover={onHover}
                onOpenDraft={onOpenDraft}
                onOpenDay={() => onOpenDay(cell.iso)}
                onDrop={onDrop}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

function DayCell({
  cell,
  items,
  isToday,
  isPast,
  isHover,
  onHover,
  onOpenDraft,
  onOpenDay,
  onDrop,
}: {
  cell: MonthCell;
  items: MarketingDraft[];
  isToday: boolean;
  isPast: boolean;
  isHover: boolean;
  onHover: (iso: string | null) => void;
  onOpenDraft: (draft: MarketingDraft) => void;
  onOpenDay: () => void;
  onDrop: (draftId: string, targetDay: string) => void;
}) {
  const ref = useRef<View>(null);

  // Wire up drop target via native DOM listeners — RN Web's prop forwarding
  // for drag events through Pressable is unreliable. We attach to the
  // underlying div directly so the browser sees genuine drop handlers.
  useEffect(() => {
    if (!DND) return;
    if (isPast) return; // No dropping into past days.
    const el = ref.current as unknown as HTMLDivElement | null;
    if (!el) return;
    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      onHover(cell.iso);
    };
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    };
    const onDragLeave = () => onHover(null);
    const onDropEvt = (e: DragEvent) => {
      e.preventDefault();
      onHover(null);
      const id = (e.dataTransfer?.getData(DND_MIME) || e.dataTransfer?.getData('text/plain') || '').toString();
      if (id) onDrop(id, cell.iso);
    };
    el.addEventListener('dragenter', onDragEnter);
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDropEvt);
    return () => {
      el.removeEventListener('dragenter', onDragEnter);
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', onDropEvt);
    };
  }, [cell.iso, isPast, onHover, onDrop]);

  const visible = items.slice(0, 2);
  const overflow = items.length > 2 ? items.length - 2 : 0;

  return (
    <View
      ref={ref as any}
      style={[
        styles.dayCell,
        !cell.inMonth && styles.dayCellOutOfMonth,
        isToday && styles.dayCellToday,
        isHover && styles.dayCellHover,
        isPast && styles.dayCellPast,
      ]}
    >
      {/* Day-number row — pressable count badge opens the day-detail modal so
       *  the admin can see every post even when only 2 are visible. */}
      <View style={styles.dayCellHead}>
        <Text style={[
          styles.dayCellNum,
          !cell.inMonth && styles.dayCellNumOut,
          isToday && styles.dayCellNumToday,
        ]}>{cell.dayOfMonth}</Text>
        {items.length > 0 ? (
          <Pressable onPress={onOpenDay} style={styles.dayCellCount} accessibilityLabel={`Open ${items.length} posts`}>
            <Text style={styles.dayCellCountText}>{items.length}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.dayCellBody}>
        {visible.map((draft) => (
          <DraggableThumb
            key={draft.id}
            draft={draft}
            isPast={isPast}
            onOpen={() => onOpenDraft(draft)}
          />
        ))}
        {overflow > 0 ? (
          <Pressable onPress={onOpenDay} style={styles.moreChip}>
            <Text style={styles.moreChipText}>+{overflow} more</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ── Compact mobile list ─────────────────────────────────────────────────────

function CompactDayList({
  month,
  byDay,
  todayIso,
  onOpen,
  onOpenDay,
}: {
  month: ReturnType<typeof monthFromOffset>;
  byDay: Record<string, MarketingDraft[]>;
  todayIso: string;
  onOpen: (d: MarketingDraft) => void;
  onOpenDay: (iso: string) => void;
}) {
  const days = month.cells.filter((c) => c.inMonth && ((byDay[c.iso] ?? []).length > 0 || c.iso === todayIso));
  return (
    <View style={{ gap: 10 }}>
      {days.map((cell) => {
        const items = byDay[cell.iso] ?? [];
        const isToday = cell.iso === todayIso;
        return (
          <View key={cell.iso} style={[styles.compactDay, isToday && styles.compactDayToday]}>
            <Pressable
              style={styles.compactDayHead}
              onPress={() => items.length > 0 && onOpenDay(cell.iso)}
              accessibilityLabel={items.length > 0 ? `Open ${items.length} posts on ${cell.iso}` : undefined}
            >
              <Text style={[styles.compactDayDate, isToday && { color: Colors.primary }]}>
                {cell.dayOfMonth} · {WEEKDAY_HEADERS[(cell.weekday + 6) % 7]}
              </Text>
              {items.length > 0 ? <Text style={styles.compactDayCount}>{items.length}</Text> : null}
            </Pressable>
            {items.length === 0 ? (
              <Text style={styles.dayEmptyText}>Nothing scheduled</Text>
            ) : (
              <View style={{ gap: 6 }}>
                {items.slice(0, 2).map((draft) => (
                  <DraftCardCompact key={draft.id} draft={draft} onOpen={() => onOpen(draft)} />
                ))}
                {items.length > 2 ? (
                  <Pressable onPress={() => onOpenDay(cell.iso)}>
                    <Text style={styles.compactMore}>+{items.length - 2} more</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ── Draggable thumb item ────────────────────────────────────────────────────

function DraggableThumb({
  draft,
  isPast,
  onOpen,
}: {
  draft: MarketingDraft;
  isPast: boolean;
  onOpen: () => void;
}) {
  const tone = draft.status === 'posted' ? Colors.success : draft.status === 'scheduled' ? Colors.primary : Colors.textMuted;
  const time = draft.scheduledAt ? istHHmm(draft.scheduledAt) : null;
  const draggable = DND && draft.status !== 'posted' && !isPast;

  const inner = (
    <>
      {draft.assets[0]?.url ? (
        <Image source={{ uri: draft.assets[0].url }} style={styles.thumbItemImg} resizeMode="cover" />
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
    </>
  );

  if (!DND) {
    return (
      <Pressable onPress={onOpen} style={[styles.thumbItem, { borderLeftColor: tone }]}>
        {inner}
      </Pressable>
    );
  }
  // Web: raw <div> with React's native HTML drag props. Bypassing RN-Web's
  // View entirely for this leaf — RN-Web wraps everything in CSS classes
  // and refs that interact unpredictably with HTML5 drag (the previous
  // imperative-listener attempts were swallowed). A plain div with
  // draggable + onDragStart is the path of least resistance.
  return (
    <div
      draggable={draggable}
      onClick={onOpen}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.setData(DND_MIME, draft.id);
        e.dataTransfer.setData('text/plain', draft.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: Colors.bgLight,
        borderRadius: 4,
        padding: 3,
        borderLeft: `2px solid ${tone}`,
        cursor: draggable ? 'grab' : 'pointer',
        userSelect: 'none',
      }}
    >
      {inner}
    </div>
  );
}

/**
 * Compact draft row used in the unscheduled drop zone, mobile day list, and
 * the day-detail modal. When `onDragStart` / `onDragEnd` are provided AND the
 * draft is in a draggable state (web + not posted + not past), the card wires
 * up imperative HTML5 drag listeners so admin can drag it onto a day cell.
 */
function DraftCardCompact({
  draft,
  onOpen,
  onDragStart,
  onDragEnd,
  isPast,
}: {
  draft: MarketingDraft;
  onOpen: () => void;
  /** Called when the admin starts dragging this card. Lets the calendar dim
   *  any covering modal so the underlying day cells receive drop events. */
  onDragStart?: () => void;
  /** Called on dragend — admin completed or cancelled the drag. */
  onDragEnd?: () => void;
  /** Past-day cards aren't draggable. Defaults to false. */
  isPast?: boolean;
}) {
  const tone = draft.status === 'posted' ? Colors.success : draft.status === 'scheduled' ? Colors.primary : Colors.textMuted;
  const time = draft.scheduledAt ? istHHmm(draft.scheduledAt) : null;
  const draggable = DND && draft.status !== 'posted' && !isPast && !!onDragStart;

  if (!DND) {
    return (
      <Pressable onPress={onOpen} style={styles.compactCard}>
        <CompactCardContent draft={draft} tone={tone} time={time} />
      </Pressable>
    );
  }
  // Web: raw <div> for the same reason as DraggableThumb above. RN-Web's
  // View wrapping was preventing dragstart from firing reliably; a plain
  // div + React's native HTML drag props is deterministic.
  return (
    <div
      draggable={draggable}
      onClick={onOpen}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.setData(DND_MIME, draft.id);
        e.dataTransfer.setData('text/plain', draft.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.();
      }}
      onDragEnd={() => onDragEnd?.()}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: Colors.bgLight,
        borderRadius: 6,
        padding: 6,
        border: `1px solid ${Colors.border}`,
        cursor: draggable ? 'grab' : 'pointer',
        userSelect: 'none',
      }}
    >
      <CompactCardContent draft={draft} tone={tone} time={time} />
    </div>
  );
}

function CompactCardContent({ draft, tone, time }: { draft: MarketingDraft; tone: string; time: string | null }) {
  return (
    <>
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
    </>
  );
}

// ── Unscheduled drop zone ──────────────────────────────────────────────────

function UnscheduledDropZone({
  items,
  isHover,
  onHoverChange,
  onDrop,
  onOpen,
}: {
  items: MarketingDraft[];
  isHover: boolean;
  onHoverChange: (active: boolean) => void;
  onDrop: (draftId: string) => void;
  onOpen: (d: MarketingDraft) => void;
}) {
  const ref = useRef<View>(null);

  useEffect(() => {
    if (!DND) return;
    const el = ref.current as unknown as HTMLDivElement | null;
    if (!el) return;
    const onDragEnter = (e: DragEvent) => { e.preventDefault(); onHoverChange(true); };
    const onDragOver = (e: DragEvent) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; };
    const onDragLeave = () => onHoverChange(false);
    const onDropEvt = (e: DragEvent) => {
      e.preventDefault();
      onHoverChange(false);
      const id = (e.dataTransfer?.getData(DND_MIME) || e.dataTransfer?.getData('text/plain') || '').toString();
      if (id) onDrop(id);
    };
    el.addEventListener('dragenter', onDragEnter);
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDropEvt);
    return () => {
      el.removeEventListener('dragenter', onDragEnter);
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', onDropEvt);
    };
  }, [onHoverChange, onDrop]);

  return (
    <View ref={ref as any} style={[styles.unscheduledBlock, isHover && styles.unscheduledHover]}>
      <Text style={styles.sectionLabel}>Unscheduled · {items.length}</Text>
      <View style={styles.unscheduledRow}>
        {items.map((d) => (
          <DraftCardCompact key={d.id} draft={d} onOpen={() => onOpen(d)} />
        ))}
      </View>
    </View>
  );
}

// ── Reschedule time picker ─────────────────────────────────────────────────

function ReschedulePicker({
  targetDay,
  defaultTime,
  onConfirm,
  onCancel,
}: {
  targetDay: string;
  defaultTime: string;
  onConfirm: (newTime: string) => void;
  onCancel: () => void;
}) {
  const [time, setTime] = useState(defaultTime);
  const valid = /^[0-2]\d:[0-5]\d$/.test(time);

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onCancel}>
      <Pressable style={styles.modalScrim} onPress={onCancel}>
        <Pressable style={styles.modalCardSm} onPress={() => { /* swallow */ }}>
          <Text style={styles.modalTitle}>Reschedule to {formatLongDayLabel(targetDay)}</Text>
          <Text style={styles.modalBody}>Pick the time of day. Default keeps the current slot time.</Text>
          <View style={styles.timeRow}>
            <TextInput
              value={time}
              onChangeText={(v) => setTime(normaliseTimeInput(v))}
              placeholder="HH:MM"
              placeholderTextColor={Colors.textMuted}
              style={[styles.timeInput, !valid && styles.timeInputBad]}
              maxLength={5}
              autoFocus
            />
            <Text style={styles.timeHint}>IST · 24-hour</Text>
          </View>
          <View style={styles.modalActions}>
            <Pressable style={styles.btnSecondary} onPress={onCancel}>
              <Text style={styles.btnSecondaryLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.btnPrimary, !valid && { opacity: 0.5 }]}
              onPress={() => valid && onConfirm(time)}
              disabled={!valid}
            >
              <Text style={styles.btnPrimaryLabel}>Reschedule</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Day-detail modal (lists all posts on a chosen day, sorted by time) ─────

function DayPostsModal({
  dayIso,
  items,
  ghosted,
  isPast,
  onOpenDraft,
  onClose,
  onItemDragStart,
  onItemDragEnd,
}: {
  dayIso: string;
  items: MarketingDraft[];
  /** When true the scrim becomes transparent + non-interactive so an
   *  in-progress drag from inside the modal can land on a day cell behind it. */
  ghosted: boolean;
  isPast: boolean;
  onOpenDraft: (d: MarketingDraft) => void;
  onClose: () => void;
  onItemDragStart: () => void;
  onItemDragEnd: () => void;
}) {
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable
        style={[styles.modalScrim, ghosted && styles.modalScrimGhosted]}
        onPress={ghosted ? undefined : onClose}
        // Both scrim AND modal card must be pointer-events:none during a
        // drag — otherwise the modal card (pointer-events:auto by default,
        // and absolute children of `box-none` get auto re-applied) sits on
        // top of every day cell and swallows the dragover. With both set
        // to 'none', HTML5 drag events fall through to the calendar grid
        // beneath. The drag source's dragend still fires because the
        // browser tracks the source independently after dragstart.
        pointerEvents={ghosted ? 'none' : 'auto'}
      >
        <Pressable
          style={[styles.modalCard, ghosted && styles.modalCardGhosted]}
          onPress={() => { /* swallow */ }}
          pointerEvents={ghosted ? 'none' : 'auto'}
        >
          <View style={styles.modalHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{formatLongDayLabel(dayIso)}</Text>
              <Text style={styles.modalSub}>
                {items.length} {items.length === 1 ? 'post' : 'posts'} scheduled
                {!isPast && DND ? ' · drag to another day to reschedule' : ''}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.iconBtn} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={Colors.textDark} />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ gap: 8, padding: 4 }}>
            {items.map((d) => (
              <DraftCardCompact
                key={d.id}
                draft={d}
                isPast={isPast}
                onOpen={() => onOpenDraft(d)}
                onDragStart={onItemDragStart}
                onDragEnd={onItemDragEnd}
              />
            ))}
            {items.length === 0 ? <Text style={styles.dayEmptyText}>Nothing scheduled.</Text> : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Cancellable post preview modal ──────────────────────────────────────────

function PostPreviewModal({
  draft,
  onEdit,
  onClose,
}: {
  draft: MarketingDraft;
  onEdit: (id: string) => void;
  onClose: () => void;
}) {
  const tone = draft.status === 'posted' ? Colors.success : draft.status === 'scheduled' ? Colors.primary : Colors.textMuted;
  const time = draft.scheduledAt ? formatLongDayLabel(istDayKey(draft.scheduledAt)) + ' · ' + istHHmm(draft.scheduledAt) : draft.postedAt ? 'Posted ' + formatLongDayLabel(istDayKey(draft.postedAt)) : 'Unscheduled';
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.modalScrim} onPress={onClose}>
        <Pressable style={styles.modalCardLg} onPress={() => { /* swallow */ }}>
          <View style={styles.modalHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{draft.headline ?? '(untitled draft)'}</Text>
              <View style={[styles.previewMetaRow]}>
                <View style={[styles.statusDot, { backgroundColor: tone }]} />
                <Text style={[styles.statusLabel, { color: tone }]}>{draft.status.replace('_', ' ')}</Text>
                <Text style={styles.previewMetaSep}>·</Text>
                <Text style={styles.previewMetaText}>{time}</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.iconBtn} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={Colors.textDark} />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 540 }} contentContainerStyle={{ gap: Spacing.md, padding: Spacing.sm }}>
            {draft.assets[0]?.url ? (
              <Image source={{ uri: draft.assets[0].url }} style={styles.previewImage} resizeMode="cover" />
            ) : null}
            <View style={styles.previewMetaBox}>
              {draft.pillarLabel ? <Text style={styles.previewMeta}>Pillar: {draft.pillarLabel}</Text> : null}
              {draft.personaLabel ? <Text style={styles.previewMeta}>Persona: {draft.personaLabel}</Text> : null}
              {draft.eventLabel ? <Text style={styles.previewMeta}>Event: {draft.eventLabel}</Text> : null}
              {draft.assets[0]?.template ? <Text style={styles.previewMeta}>Template: {draft.assets[0].template}</Text> : null}
            </View>
            <Text style={styles.previewCaption}>{draft.caption}</Text>
          </ScrollView>
          <View style={styles.modalActions}>
            <Pressable style={styles.btnSecondary} onPress={onClose}>
              <Text style={styles.btnSecondaryLabel}>Close</Text>
            </Pressable>
            <Pressable style={styles.btnPrimary} onPress={() => onEdit(draft.id)}>
              <Ionicons name="create-outline" size={14} color={Colors.white} />
              <Text style={styles.btnPrimaryLabel}>Edit in editor</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Date helpers ────────────────────────────────────────────────────────────

interface MonthCell { iso: string; dayOfMonth: number; inMonth: boolean; weekday: number }

function monthFromOffset(offset: number): { cells: MonthCell[]; label: string; year: number; month: number } {
  const now = istNow();
  const year = now.getUTCFullYear();
  const monthIdx = now.getUTCMonth() + offset;
  const target = new Date(Date.UTC(year, monthIdx, 1));
  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth();

  const firstWeekday = target.getUTCDay();
  const mondayOffset = (firstWeekday + 6) % 7;
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

function composeIstIso(targetDayIso: string, hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  const hh = Math.max(0, Math.min(23, parseInt(hStr, 10) || 0));
  const mm = Math.max(0, Math.min(59, parseInt(mStr, 10) || 0));
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

function formatLongDayLabel(targetDayIso: string): string {
  const [y, mo, d] = targetDayIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (mo ?? 1) - 1, d ?? 1));
  const weekday = dt.toLocaleString('en', { weekday: 'short' });
  const month = dt.toLocaleString('en', { month: 'short' });
  return `${weekday}, ${month} ${d}`;
}

/** Auto-insert ":" so admins can type "0930" → "09:30" in the time input. */
function normaliseTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
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

  dndHint: { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' },

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
  dayCellPast: { opacity: 0.85 },
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
  compactMore: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
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

  // Modals
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(28, 16, 51, 0.5)',
    alignItems: 'center', justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalScrimGhosted: {
    // Mid-drag: barely-tinted backdrop so the calendar grid is fully visible
    // and the scrim doesn't intercept the drop event.
    backgroundColor: 'rgba(28, 16, 51, 0.10)',
  },
  modalCardGhosted: { opacity: 0.4 },
  modalCardSm: {
    width: '100%', maxWidth: 380,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadow.lg,
  },
  modalCard: {
    width: '100%', maxWidth: 480,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadow.lg,
  },
  modalCardLg: {
    width: '100%', maxWidth: 640,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadow.lg,
  },
  modalHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  modalTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textDark },
  modalSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  modalBody: { fontSize: FontSize.xs, color: Colors.textLight },
  iconBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgLight,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
  },
  btnPrimaryLabel: { color: Colors.white, fontSize: FontSize.xs, fontWeight: '700' },
  btnSecondary: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  btnSecondaryLabel: { color: Colors.textDark, fontSize: FontSize.xs, fontWeight: '700' },

  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeInput: {
    width: 96,
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    fontSize: FontSize.md,
    color: Colors.textDark,
    fontWeight: '700',
  },
  timeInputBad: { borderColor: Colors.error },
  timeHint: { fontSize: FontSize.xs, color: Colors.textMuted },

  previewImage: {
    width: '100%', aspectRatio: 1,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgLight,
  },
  previewMetaBox: {
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    gap: 2,
  },
  previewMeta: { fontSize: FontSize.xs, color: Colors.textLight },
  previewMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  previewMetaSep: { color: Colors.textMuted },
  previewMetaText: { fontSize: FontSize.xs, color: Colors.textMuted },
  previewCaption: { fontSize: FontSize.xs, color: Colors.textDark, lineHeight: 18 },
});
