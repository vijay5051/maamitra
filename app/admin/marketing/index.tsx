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
import {
  generateAheadDrafts,
  previewScheduledSlots,
  saveCronOverride,
  subscribeBrandKit,
  ScheduledSlotPreview,
} from '../../../services/marketing';
import { friendlyError } from '../../../services/marketingErrors';
import { BrandKit, MarketingDraft } from '../../../lib/marketingTypes';
import { useAuthStore } from '../../../store/useAuthStore';

interface State {
  scheduledDrafts: MarketingDraft[];
  recentPosted: MarketingDraft[];
  postsThisWeek: number;
  reachThisWeek: number;
  unreadReplies: number;
  loading: boolean;
}

export default function MarketingTodayScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= 900;

  const [state, setState] = useState<State>({
    scheduledDrafts: [],
    recentPosted: [],
    postsThisWeek: 0,
    reachThisWeek: 0,
    unreadReplies: 0,
    loading: true,
  });

  // Brand kit — needed for automation preview + cron-enabled gate.
  const [brand, setBrand] = useState<BrandKit | null>(null);
  const [upcomingSlots, setUpcomingSlots] = useState<ScheduledSlotPreview[]>([]);
  const [skipBusy, setSkipBusy] = useState<string | null>(null);
  const [aheadBusy, setAheadBusy] = useState(false);
  const [aheadBanner, setAheadBanner] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const unsub = subscribeBrandKit((k) => {
      setBrand(k);
      if (k) {
        const slots: ScheduledSlotPreview[] = [];
        for (let i = 0; i < 7; i++) {
          slots.push(...previewScheduledSlots(k, new Date(Date.now() + i * 24 * 3600 * 1000)));
        }
        setUpcomingSlots(slots);
      } else {
        setUpcomingSlots([]);
      }
    });
    return unsub;
  }, []);

  // Dismiss ahead-banner after 3s.
  useEffect(() => {
    if (!aheadBanner) return;
    const t = setTimeout(() => setAheadBanner(null), 3000);
    return () => clearTimeout(t);
  }, [aheadBanner]);

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
      const next7Cutoff = Date.now() + 7 * 24 * 3600 * 1000;
      const upcomingScheduled = sortedScheduled.filter((d) => {
        const t = d.scheduledAt ? new Date(d.scheduledAt).getTime() : 0;
        return t >= Date.now() && t <= next7Cutoff;
      });
      const reach = posts.reduce((a, p) => a + (p.metrics?.reach ?? 0), 0);

      // "Posts this week" = posted in last 7d. Count off the snapshot, not
      // server (countDraftsByStatus returns lifetime; we just want the week).
      const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
      const postsThisWeek = posted.filter((d) => {
        const t = d.postedAt ? new Date(d.postedAt).getTime() : 0;
        return t >= sevenDaysAgo;
      }).length;

      setState({
        scheduledDrafts: upcomingScheduled,
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

        <Section title="Next 7 days" right={
          state.loading ? <ActivityIndicator size="small" color={Colors.primary} /> :
          <Pressable onPress={onRefresh} hitSlop={8}><Ionicons name="refresh" size={16} color={Colors.textLight} /></Pressable>
        }>
          {state.scheduledDrafts.length > 0 || (brand?.cronEnabled && upcomingSlots.length > 0) ? (
            <UpcomingWeekCard
              scheduledDrafts={state.scheduledDrafts}
              previewSlots={brand?.cronEnabled ? upcomingSlots : []}
              skipBusy={skipBusy}
              aheadBusy={aheadBusy}
              banner={aheadBanner}
              onOpenDraft={(id) => router.push(`/admin/marketing/drafts?open=${id}` as any)}
              onSkip={async (slot) => {
                if (!user) return;
                const busyKey = `${slot.dateIso}:${slot.slotId}`;
                setSkipBusy(busyKey);
                try {
                  const newSkip = !slot.skipped;
                  await saveCronOverride(
                    { uid: user.uid, email: user.email },
                    slot.dateIso,
                    newSkip ? { skip: true } : null,
                    slot.slotId,
                  );
                } catch (e: any) {
                  setAheadBanner({ ok: false, text: friendlyError('Skip', e) });
                } finally {
                  setSkipBusy(null);
                }
              }}
              onPreGenerate={async () => {
                if (aheadBusy) return;
                setAheadBusy(true);
                try {
                  const r = await generateAheadDrafts(7);
                  if (r.ok) {
                    setAheadBanner({
                      ok: true,
                      text: r.generated > 0
                        ? `${r.generated} draft${r.generated === 1 ? '' : 's'} queued for review`
                        : 'All upcoming dates already have drafts',
                    });
                  } else {
                    setAheadBanner({ ok: false, text: r.message });
                  }
                } catch (e: any) {
                  setAheadBanner({ ok: false, text: friendlyError('Pre-generate', e) });
                } finally {
                  setAheadBusy(false);
                }
              }}
            />
          ) : (
            <EmptyCard
              icon="calendar-outline"
              title="Nothing lined up"
              body="No scheduled posts or automation previews in the next 7 days."
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

// ── Upcoming week planner ──────────────────────────────────────────────────

function UpcomingWeekCard({
  scheduledDrafts,
  previewSlots,
  skipBusy,
  aheadBusy,
  banner,
  onOpenDraft,
  onSkip,
  onPreGenerate,
}: {
  scheduledDrafts: MarketingDraft[];
  previewSlots: ScheduledSlotPreview[];
  skipBusy: string | null;
  aheadBusy: boolean;
  banner: { ok: boolean; text: string } | null;
  onOpenDraft: (id: string) => void;
  onSkip: (slot: ScheduledSlotPreview) => void;
  onPreGenerate: () => void;
}) {
  const days = buildUpcomingDays(scheduledDrafts, previewSlots);
  return (
    <View style={styles.weekCard}>
      <View style={styles.weekHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.weekTitle}>Scheduled posts and automation previews</Text>
          <Text style={styles.weekHint}>One view for what is already scheduled and what automation is expected to generate next.</Text>
        </View>
        <Pressable onPress={onPreGenerate} disabled={aheadBusy} style={styles.weekPrimaryBtn}>
          {aheadBusy ? <ActivityIndicator size="small" color={Colors.white} /> : <Ionicons name="flash-outline" size={13} color={Colors.white} />}
          <Text style={styles.weekPrimaryBtnLabel}>Queue 7 days</Text>
        </Pressable>
      </View>

      {banner ? (
        <View style={[styles.tomorrowBanner, !banner.ok && styles.tomorrowBannerErr]}>
          <Ionicons name={banner.ok ? 'checkmark-circle-outline' : 'alert-circle-outline'} size={13} color={banner.ok ? Colors.success : Colors.error} />
          <Text style={[styles.tomorrowBannerText, !banner.ok && { color: Colors.error }]}>{banner.text}</Text>
        </View>
      ) : null}

      <View style={styles.weekList}>
        {days.map((day) => (
          <View key={day.dateIso} style={styles.weekDayCard}>
            <View style={styles.weekDayHead}>
              <Text style={styles.weekDayTitle}>{day.label}</Text>
              <Text style={styles.weekDaySub}>{day.items.length} item{day.items.length === 1 ? '' : 's'}</Text>
            </View>
            <View style={styles.weekDayItems}>
              {day.items.map((item, idx) => item.kind === 'scheduled' ? (
                <Pressable key={`scheduled-${idx}-${item.draft.id}`} onPress={() => onOpenDraft(item.draft.id)} style={styles.weekScheduledRow}>
                  {item.draft.assets[0]?.url ? (
                    <Image source={{ uri: item.draft.assets[0].url }} style={styles.weekScheduledThumb} resizeMode="cover" />
                  ) : (
                    <View style={[styles.weekScheduledThumb, styles.nextImageEmpty]}>
                      <Ionicons name="image-outline" size={18} color={Colors.textMuted} />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={styles.weekMeta}>
                      <Text style={styles.weekTime}>{formatTimeOnly(item.draft.scheduledAt)}</Text>
                      <Text style={styles.weekPill}>Scheduled</Text>
                      <Text style={styles.weekPill}>{(item.draft.platforms.length ? item.draft.platforms : ['instagram', 'facebook']).join(' + ').toUpperCase()}</Text>
                    </View>
                    <Text style={styles.weekScheduledTitle} numberOfLines={2}>{item.draft.headline ?? item.draft.caption.slice(0, 80)}</Text>
                  </View>
                </Pressable>
              ) : (
                <View key={`preview-${idx}-${item.slot.dateIso}-${item.slot.slotId}`} style={styles.weekPreviewRow}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.weekMeta}>
                      <Text style={styles.weekTime}>{item.slot.slotTime}</Text>
                      <Text style={styles.weekPill}>{item.slot.slotTemplate === 'auto' ? 'AI pick' : item.slot.slotTemplate}</Text>
                      <Text style={styles.weekPill}>{item.slot.slotPlatforms.join(' + ').toUpperCase()}</Text>
                    </View>
                    <Text style={styles.weekPreviewTitle}>{item.slot.slotLabel} · {item.slot.themeLabel}</Text>
                    <Text style={styles.weekPreviewSub}>
                      {item.slot.skipped ? 'Skipped for this slot.' : item.slot.autoSchedule ? 'Will auto-schedule if generated.' : 'Will land for review.'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => onSkip(item.slot)}
                    disabled={skipBusy === `${item.slot.dateIso}:${item.slot.slotId}`}
                    style={[styles.weekSkipBtn, item.slot.skipped && styles.weekSkipBtnActive]}
                  >
                    {skipBusy === `${item.slot.dateIso}:${item.slot.slotId}` ? (
                      <ActivityIndicator size="small" color={item.slot.skipped ? Colors.white : Colors.warning} />
                    ) : (
                      <Text style={[styles.weekSkipBtnLabel, item.slot.skipped && { color: Colors.white }]}>
                        {item.slot.skipped ? 'Un-skip' : 'Skip'}
                      </Text>
                    )}
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
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

// ── Tomorrow card ────────────────────────────────────────────────────────────

function TomorrowCard({
  slot,
  skipBusy,
  aheadBusy,
  banner,
  onSkip,
  onPreGenerate,
}: {
  slot: ScheduledSlotPreview;
  skipBusy: boolean;
  aheadBusy: boolean;
  banner: { ok: boolean; text: string } | null;
  onSkip: () => void;
  onPreGenerate: () => void;
}) {
  const { width: cardWidth } = useWindowDimensions();
  const isNarrow = cardWidth < 900;
  return (
    <View style={styles.tomorrowCard}>
      {slot.skipped ? (
        <View style={styles.tomorrowSkippedBanner}>
          <Ionicons name="ban-outline" size={14} color={Colors.warning} />
          <Text style={styles.tomorrowSkippedText}>Skipped — cron will not generate tomorrow</Text>
        </View>
      ) : null}

      <View style={styles.tomorrowRow}>
        <View style={styles.tomorrowDateBox}>
          <Text style={styles.tomorrowDay}>{slot.weekdayName.slice(0, 3).toUpperCase()}</Text>
          <Text style={styles.tomorrowDate}>{slot.dateIso.slice(8)}</Text>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.tomorrowTheme}>{slot.themeLabel}</Text>
          <View style={styles.tomorrowChips}>
            {slot.pillarLabel ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{slot.pillarEmoji ? `${slot.pillarEmoji} ` : ''}{slot.pillarLabel}</Text>
              </View>
            ) : null}
            {slot.personaLabel ? (
              <View style={[styles.chip, styles.chipSecondary]}>
                <Text style={[styles.chipText, styles.chipTextSecondary]}>{slot.personaLabel}</Text>
              </View>
            ) : null}
            {slot.eventLabel ? (
              <View style={[styles.chip, styles.chipEvent]}>
                <Ionicons name="calendar-outline" size={10} color={Colors.primary} />
                <Text style={[styles.chipText, { color: Colors.primary }]}>{slot.eventLabel}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {banner ? (
        <View style={[styles.tomorrowBanner, !banner.ok && styles.tomorrowBannerErr]}>
          <Ionicons name={banner.ok ? 'checkmark-circle-outline' : 'alert-circle-outline'} size={13} color={banner.ok ? Colors.success : Colors.error} />
          <Text style={[styles.tomorrowBannerText, !banner.ok && { color: Colors.error }]}>{banner.text}</Text>
        </View>
      ) : null}

      <View style={[styles.tomorrowActions, isNarrow && styles.tomorrowActionsNarrow]}>
        <Pressable
          onPress={onSkip}
          disabled={skipBusy}
          style={[styles.tomorrowBtn, slot.skipped && styles.tomorrowBtnActive]}
        >
          {skipBusy ? (
            <ActivityIndicator size="small" color={slot.skipped ? Colors.white : Colors.warning} />
          ) : (
            <>
              <Ionicons name={slot.skipped ? 'refresh-outline' : 'ban-outline'} size={13} color={slot.skipped ? Colors.white : Colors.warning} />
              <Text style={[styles.tomorrowBtnLabel, slot.skipped && { color: Colors.white }, !slot.skipped && { color: Colors.warning }]}>
                {slot.skipped ? 'Un-skip' : 'Skip tomorrow'}
              </Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={onPreGenerate}
          disabled={aheadBusy}
          style={styles.tomorrowBtnPrimary}
        >
          {aheadBusy ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <>
              <Ionicons name="flash-outline" size={13} color={Colors.white} />
              <Text style={styles.tomorrowBtnPrimaryLabel}>Queue 7 days</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
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

function formatTimeOnly(iso: string | null): string {
  if (!iso) return 'Time TBD';
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return 'Time TBD';
  }
}

function buildUpcomingDays(scheduledDrafts: MarketingDraft[], previewSlots: ScheduledSlotPreview[]) {
  const now = new Date();
  const out: Array<{
    dateIso: string;
    label: string;
    items: Array<
      | { kind: 'scheduled'; draft: MarketingDraft }
      | { kind: 'preview'; slot: ScheduledSlotPreview }
    >;
  }> = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(now.getTime() + i * 24 * 3600 * 1000);
    const isoDate = new Date(date.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
    const scheduled = scheduledDrafts
      .filter((d) => d.scheduledAt && new Date(d.scheduledAt).toISOString().slice(0, 10) === isoDate)
      .map((draft) => ({ kind: 'scheduled' as const, draft }));
    const previews = previewSlots
      .filter((slot) => slot.dateIso === isoDate)
      .map((slot) => ({ kind: 'preview' as const, slot }));
    const label = i === 0
      ? 'Today'
      : i === 1
        ? 'Tomorrow'
        : date.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
    out.push({ dateIso: isoDate, label, items: [...scheduled, ...previews] });
  }
  return out.filter((day) => day.items.length > 0);
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

  // Upcoming week card
  weekCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.borderSoft,
    ...Shadow.sm,
  },
  weekHeader: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  weekTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  weekHint: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 2, lineHeight: 16 },
  weekPrimaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  weekPrimaryBtnLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.white },
  weekList: { padding: Spacing.md, gap: Spacing.sm },
  weekDayCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    backgroundColor: Colors.bgLight,
    overflow: 'hidden',
  },
  weekDayHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    backgroundColor: Colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  weekDayTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  weekDaySub: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  weekDayItems: { gap: 8, padding: Spacing.sm },
  weekScheduledRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  weekScheduledThumb: { width: 54, height: 54, borderRadius: Radius.sm, backgroundColor: Colors.bgTint },
  nextImage: { width: 76, height: 76, borderRadius: Radius.md, backgroundColor: Colors.bgTint },
  nextImageEmpty: { alignItems: 'center', justifyContent: 'center' },
  weekMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  weekTime: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  weekPill: {
    fontSize: 10, fontWeight: '700', color: Colors.textMuted,
    backgroundColor: Colors.cardBg,
    borderRadius: 999,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  weekScheduledTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark, lineHeight: 18 },
  weekPreviewRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
    paddingTop: 2,
  },
  weekPreviewTitle: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textDark },
  weekPreviewSub: { fontSize: 11, color: Colors.textLight, lineHeight: 15 },
  weekSkipBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1, borderColor: Colors.warning,
    minWidth: 66, alignItems: 'center',
  },
  weekSkipBtnActive: { backgroundColor: Colors.warning, borderColor: Colors.warning },
  weekSkipBtnLabel: { fontSize: 10, fontWeight: '700', color: Colors.warning },

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

  // Tomorrow card
  tomorrowCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.borderSoft,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  tomorrowSkippedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(245,158,11,0.08)',
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: 'rgba(245,158,11,0.15)',
  },
  tomorrowSkippedText: { fontSize: 11, fontWeight: '600', color: Colors.warning },
  tomorrowRow: {
    flexDirection: 'row', gap: Spacing.md, padding: Spacing.md,
  },
  tomorrowDateBox: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.primary,
  },
  tomorrowDay: { fontSize: 9, fontWeight: '800', color: Colors.primary, letterSpacing: 0.5 },
  tomorrowDate: { fontSize: 18, fontWeight: '800', color: Colors.primary, lineHeight: 20 },
  tomorrowTheme: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  tomorrowChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 999,
  },
  chipSecondary: { backgroundColor: Colors.bgTint },
  chipEvent: { backgroundColor: Colors.primarySoft, borderWidth: 1, borderColor: Colors.primary },
  chipText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  chipTextSecondary: { color: Colors.textMuted },
  tomorrowActions: {
    flexDirection: 'row', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.md,
  },
  tomorrowActionsNarrow: {
    flexDirection: 'column',
  },
  tomorrowBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1, borderColor: Colors.warning,
    backgroundColor: 'transparent',
  },
  tomorrowBtnActive: {
    backgroundColor: Colors.warning,
    borderColor: Colors.warning,
  },
  tomorrowBtnLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.warning },
  tomorrowBtnPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  tomorrowBtnPrimaryLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.white },
  tomorrowBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginHorizontal: Spacing.md, marginBottom: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.success,
  },
  tomorrowBannerErr: { backgroundColor: 'rgba(239,68,68,0.06)', borderColor: Colors.error },
  tomorrowBannerText: { fontSize: 11, fontWeight: '600', color: Colors.success },
});
