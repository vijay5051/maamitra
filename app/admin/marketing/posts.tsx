/**
 * Posts hub — single home for all content state.
 *
 * Replaces the v1 split between /drafts, /calendar, /ugc with one screen
 * + 4 inner tabs. Click any row → opens the rich slide-over on the legacy
 * route (drafts.tsx / ugc.tsx still exist and own the editing UI).
 *
 * The inner tab is reflected in the URL (`?tab=calendar`) so deep links
 * work and the browser back button feels right.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../../constants/theme';
import { listDrafts } from '../../../services/marketingDrafts';
import { subscribeUgcQueue } from '../../../services/marketingUgc';
import { MarketingDraft, UgcSubmission } from '../../../lib/marketingTypes';

type PostsTab = 'calendar' | 'inbox' | 'ugc' | 'posted';

const TABS: { key: PostsTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'calendar', label: 'Calendar', icon: 'calendar-outline' },
  { key: 'inbox',    label: 'To review', icon: 'mail-unread-outline' },
  { key: 'ugc',      label: 'From users', icon: 'heart-outline' },
  { key: 'posted',   label: 'Posted', icon: 'checkmark-done-outline' },
];

export default function PostsHubScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const tabParam = (params.tab ?? 'calendar') as PostsTab;
  const tab: PostsTab = TABS.some((t) => t.key === tabParam) ? tabParam : 'calendar';

  const setTab = (next: PostsTab) => {
    router.replace(`/admin/marketing/posts?tab=${next}` as any);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Posts' }} />
      <View style={styles.root}>
        {/* Inner sub-tab strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={styles.subTabStrip}
        >
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.subTab, tab === t.key && styles.subTabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t.key }}
            >
              <Ionicons
                name={t.icon}
                size={14}
                color={tab === t.key ? Colors.primary : Colors.textLight}
              />
              <Text style={[styles.subTabLabel, tab === t.key && styles.subTabLabelActive]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          {tab === 'calendar' ? <CalendarPane /> : null}
          {tab === 'inbox'    ? <InboxPane /> : null}
          {tab === 'ugc'      ? <UgcPane /> : null}
          {tab === 'posted'   ? <PostedPane /> : null}
        </ScrollView>
      </View>
    </>
  );
}

// ── Calendar pane ───────────────────────────────────────────────────────────

function CalendarPane() {
  const router = useRouter();
  const [weekOffset, setWeekOffset] = useState(0);
  const [drafts, setDrafts] = useState<MarketingDraft[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listDrafts({ limitN: 200 });
      setDrafts(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const week = useMemo(() => weekFromOffset(weekOffset), [weekOffset]);
  const byDay: Record<string, MarketingDraft[]> = useMemo(() => {
    const out: Record<string, MarketingDraft[]> = { unscheduled: [] };
    week.days.forEach((d) => { out[d.iso] = []; });
    for (const d of drafts) {
      if (d.status === 'pending_review' || d.status === 'rejected') continue;
      const ts = d.scheduledAt ?? d.postedAt;
      if (!ts) {
        if (d.status === 'approved') out.unscheduled.push(d);
        continue;
      }
      const key = istDayKey(ts);
      if (out[key]) out[key].push(d);
    }
    return out;
  }, [drafts, week]);

  const todayKey = istToday();

  return (
    <View style={{ gap: Spacing.md }}>
      <View style={styles.weekBar}>
        <Pressable style={styles.weekArrow} onPress={() => setWeekOffset((n) => n - 1)} accessibilityLabel="Previous week">
          <Ionicons name="chevron-back" size={18} color={Colors.textDark} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.weekTitle}>
            {weekOffset === 0 ? 'This week' : weekOffset === -1 ? 'Last week' : weekOffset === 1 ? 'Next week' : formatRange(week)}
          </Text>
          <Text style={styles.weekRange}>{formatRange(week)}</Text>
        </View>
        <Pressable style={styles.weekArrow} onPress={() => setWeekOffset((n) => n + 1)} accessibilityLabel="Next week">
          <Ionicons name="chevron-forward" size={18} color={Colors.textDark} />
        </Pressable>
        {weekOffset !== 0 ? (
          <Pressable
            style={[styles.weekArrow, { backgroundColor: Colors.primarySoft }]}
            onPress={() => setWeekOffset(0)}
          >
            <Text style={{ fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary }}>Today</Text>
          </Pressable>
        ) : null}
      </View>

      {loading && drafts.length === 0 ? (
        <ActivityIndicator size="small" color={Colors.primary} />
      ) : null}

      {byDay.unscheduled.length > 0 ? (
        <View style={styles.unscheduledBlock}>
          <Text style={styles.unscheduledTitle}>
            <Ionicons name="alert-circle-outline" size={14} color={Colors.warning} /> {byDay.unscheduled.length} approved but not scheduled
          </Text>
          <Text style={styles.unscheduledBody}>
            Open one and tap "Schedule…" to put it on the calendar.
          </Text>
        </View>
      ) : null}

      {/* Calendar grid — horizontal scroll on mobile so all 7 days are always reachable */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
      <View style={styles.dayGrid}>
        {week.days.map((d, i) => {
          const items = byDay[d.iso] ?? [];
          const isToday = d.iso === todayKey;
          return (
            <View key={d.iso} style={[styles.dayCell, isToday && styles.dayCellToday]}>
              <View style={styles.dayHead}>
                <Text style={[styles.dayName, isToday && { color: Colors.primary }]}>
                  {WEEKDAY_SHORT[i]}
                </Text>
                <Text style={[styles.dayNumber, isToday && { color: Colors.primary }]}>{d.dayOfMonth}</Text>
              </View>
              {items.length === 0 ? (
                <Pressable
                  style={styles.dayEmpty}
                  onPress={() => router.push('/admin/marketing/create' as any)}
                  accessibilityLabel={`Create a post for ${d.iso}`}
                >
                  <Ionicons name="add" size={14} color={Colors.textMuted} />
                </Pressable>
              ) : (
                items.slice(0, 3).map((item) => (
                  <Pressable
                    key={item.id}
                    style={[styles.dayItem, statusTint(item.status)]}
                    onPress={() => router.push(`/admin/marketing/drafts?open=${item.id}` as any)}
                  >
                    <Text style={styles.dayItemTime} numberOfLines={1}>
                      {item.scheduledAt ? istHHmm(item.scheduledAt) : item.status === 'posted' ? 'posted' : 'unsched'}
                    </Text>
                    <Text style={styles.dayItemTitle} numberOfLines={2}>
                      {item.headline ?? item.caption.slice(0, 50)}
                    </Text>
                  </Pressable>
                ))
              )}
              {items.length > 3 ? (
                <Text style={styles.moreItems}>+{items.length - 3} more</Text>
              ) : null}
            </View>
          );
        })}
      </View>
      </ScrollView>
    </View>
  );
}

// ── Inbox pane (drafts pending review) ──────────────────────────────────────

function InboxPane() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<MarketingDraft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void listDrafts({ status: 'pending_review', limitN: 50 }).then((rows) => {
      if (!alive) return;
      setDrafts(rows);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  if (loading && drafts.length === 0) {
    return <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 24 }} />;
  }

  if (drafts.length === 0) {
    return (
      <EmptyPane
        icon="checkmark-done-outline"
        title="Inbox zero"
        body="Nothing waiting for review. The 6am cron will drop tomorrow's draft here."
        ctaLabel="Generate one now"
        onPress={() => router.push('/admin/marketing/drafts' as any)}
      />
    );
  }

  return (
    <View style={{ gap: Spacing.sm }}>
      {drafts.map((d) => (
        <DraftRow key={d.id} draft={d} onOpen={() => router.push(`/admin/marketing/drafts?open=${d.id}` as any)} />
      ))}
    </View>
  );
}

// ── Posted pane ─────────────────────────────────────────────────────────────

function PostedPane() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<MarketingDraft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void listDrafts({ status: 'posted', limitN: 50 }).then((rows) => {
      if (!alive) return;
      setDrafts(rows);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  if (loading && drafts.length === 0) {
    return <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 24 }} />;
  }

  if (drafts.length === 0) {
    return (
      <EmptyPane
        icon="rocket-outline"
        title="Nothing posted yet"
        body="Once you publish, your history shows up here."
        ctaLabel="Create your first post"
        onPress={() => router.push('/admin/marketing/create' as any)}
      />
    );
  }

  return (
    <View style={{ gap: Spacing.sm }}>
      {drafts.map((d) => (
        <DraftRow key={d.id} draft={d} onOpen={() => router.push(`/admin/marketing/drafts?open=${d.id}` as any)} />
      ))}
    </View>
  );
}

// ── UGC pane ────────────────────────────────────────────────────────────────

function UgcPane() {
  const router = useRouter();
  const [items, setItems] = useState<UgcSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeUgcQueue({ status: 'pending_review', limitN: 30 }, (rows) => {
      setItems(rows);
      setLoading(false);
    });
    return () => { unsub(); };
  }, []);

  if (loading && items.length === 0) {
    return <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 24 }} />;
  }

  if (items.length === 0) {
    return (
      <EmptyPane
        icon="heart-outline"
        title="No new submissions"
        body="When a mom shares a story via Share Your Story, it'll show up here."
      />
    );
  }

  return (
    <View style={{ gap: Spacing.sm }}>
      {items.map((u) => (
        <Pressable
          key={u.id}
          style={styles.row}
          onPress={() => router.push(`/admin/marketing/ugc?open=${u.id}` as any)}
        >
          {u.photoUrl ? (
            <Image source={{ uri: u.photoUrl }} style={styles.rowImage} resizeMode="cover" />
          ) : (
            <View style={[styles.rowImage, styles.rowImageEmpty]}>
              <Ionicons name="heart" size={20} color={Colors.textMuted} />
            </View>
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.rowTitle} numberOfLines={1}>{u.displayName ?? 'Anonymous mom'}</Text>
            <Text style={styles.rowBody} numberOfLines={2}>{u.story}</Text>
            <Text style={styles.rowMeta}>Submitted • Tap to review</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}

// ── Common bits ─────────────────────────────────────────────────────────────

function DraftRow({ draft, onOpen }: { draft: MarketingDraft; onOpen: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onOpen}>
      {draft.assets[0]?.url ? (
        <Image source={{ uri: draft.assets[0].url }} style={styles.rowImage} resizeMode="cover" />
      ) : (
        <View style={[styles.rowImage, styles.rowImageEmpty]}>
          <Ionicons name="image-outline" size={20} color={Colors.textMuted} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {draft.headline ?? draft.caption.slice(0, 60)}
        </Text>
        <Text style={styles.rowBody} numberOfLines={2}>{draft.caption}</Text>
        <View style={styles.rowMetaRow}>
          <StatusPill status={draft.status} />
          {draft.scheduledAt ? (
            <Text style={styles.rowMeta}>• {formatScheduledShort(draft.scheduledAt)}</Text>
          ) : draft.postedAt ? (
            <Text style={styles.rowMeta}>• {formatScheduledShort(draft.postedAt)}</Text>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </Pressable>
  );
}

function StatusPill({ status }: { status: MarketingDraft['status'] }) {
  const { label, color, bg } = statusInfo(status);
  return (
    <View style={[styles.statusPill, { backgroundColor: bg }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.statusLabel, { color }]}>{label}</Text>
    </View>
  );
}

function EmptyPane({
  icon, title, body, ctaLabel, onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  ctaLabel?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.emptyPane}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={28} color={Colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {ctaLabel && onPress ? (
        <Pressable onPress={onPress} style={styles.emptyCta}>
          <Text style={styles.emptyCtaLabel}>{ctaLabel}</Text>
          <Ionicons name="arrow-forward" size={14} color={Colors.white} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function statusInfo(status: MarketingDraft['status']) {
  switch (status) {
    case 'pending_review': return { label: 'Needs review', color: Colors.warning, bg: 'rgba(245,158,11,0.1)' };
    case 'approved':       return { label: 'Approved',     color: Colors.primary, bg: Colors.primarySoft };
    case 'scheduled':      return { label: 'Scheduled',    color: '#3B82F6',     bg: 'rgba(59,130,246,0.1)' };
    case 'posted':         return { label: 'Posted',       color: Colors.success, bg: 'rgba(34,197,94,0.1)' };
    case 'rejected':       return { label: 'Rejected',     color: Colors.textLight, bg: Colors.bgTint };
    case 'failed':         return { label: 'Failed',       color: Colors.error,   bg: 'rgba(239,68,68,0.1)' };
  }
}

function statusTint(status: MarketingDraft['status']) {
  const info = statusInfo(status);
  return { backgroundColor: info.bg, borderLeftColor: info.color };
}

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface WeekDay { iso: string; dayOfMonth: number }
function weekFromOffset(offset: number): { days: WeekDay[] } {
  const today = istNowStartOfDay();
  const day = today.getUTCDay();
  const mondayDelta = (day + 6) % 7;
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
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
function formatRange(week: { days: WeekDay[] }) {
  const a = week.days[0].iso;
  const b = week.days[6].iso;
  return `${a.slice(5)} → ${b.slice(5)}`;
}
function formatScheduledShort(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgLight },

  subTabStrip: {
    flexDirection: 'row', gap: 6, alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm,
  },
  subTab: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  subTabActive: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  subTabLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textLight },
  subTabLabelActive: { color: Colors.primary, fontWeight: '700' },

  body: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 80 },

  // Calendar
  weekBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.md,
    padding: 6,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  weekArrow: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: Colors.bgTint,
    alignItems: 'center', justifyContent: 'center',
  },
  weekTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  weekRange: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600' },

  unscheduledBlock: {
    padding: Spacing.sm,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.warning,
    gap: 2,
  },
  unscheduledTitle: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.warning },
  unscheduledBody: { fontSize: FontSize.xs, color: Colors.textDark },

  // dayGrid: no-wrap row inside a horizontal ScrollView — cells never collapse on mobile.
  dayGrid: { flexDirection: 'row', gap: 6 },
  dayCell: {
    width: 100,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.sm,
    padding: 6,
    minHeight: 130,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  dayCellToday: { borderColor: Colors.primary, borderWidth: 1.5 },
  dayHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    marginBottom: 6,
  },
  dayName: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
  dayNumber: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textDark },
  dayItem: {
    padding: 6, borderRadius: 6, marginBottom: 4,
    borderLeftWidth: 3,
  },
  dayItemTime: { fontSize: 9, fontWeight: '700', color: Colors.textMuted, marginBottom: 2 },
  dayItemTitle: { fontSize: 11, fontWeight: '600', color: Colors.textDark, lineHeight: 14 },
  dayEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12, opacity: 0.3 },
  moreItems: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', textAlign: 'center' },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  rowImage: { width: 56, height: 56, borderRadius: Radius.md, backgroundColor: Colors.bgTint },
  rowImageEmpty: { alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  rowBody: { fontSize: FontSize.xs, color: Colors.textLight, lineHeight: 16 },
  rowMeta: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600' },
  rowMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },

  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 999,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 10, fontWeight: '700' },

  // Empty
  emptyPane: {
    alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    borderWidth: 1, borderColor: Colors.borderSoft, borderStyle: 'dashed',
  },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  emptyBody: { fontSize: FontSize.xs, color: Colors.textLight, textAlign: 'center', maxWidth: 320, lineHeight: 16 },
  emptyCta: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.primary, borderRadius: 999,
    marginTop: 4,
  },
  emptyCtaLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.white },
});
