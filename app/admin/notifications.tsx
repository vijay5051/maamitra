/**
 * Admin · Notifications.
 *
 * Three tabs:
 *   1. Compose  — broadcast push (audience-targeted) + send-now or schedule
 *   2. Outbox   — every push_queue entry with delivery counts + status
 *   3. Schedule — pending scheduled_pushes the cron will fire
 *
 * Audit-logged via services/admin. Personal pushes happen from the
 * per-user 360 — we don't expose a free-form recipient picker here so
 * the "who could I be sending to" surface stays simple.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '../../constants/theme';
import { enqueueBroadcastPush, getUsers, AdminUser } from '../../services/firebase';
import {
  listPushDeliveryReport,
  cancelScheduledPush,
  listPushOutbox,
  listScheduledPushes,
  PushDeliveryEntry,
  PushQueueEntry,
  ScheduledPushEntry,
  scheduleBroadcastPush,
  scheduleCustomListPush,
  sendPushToUidList,
} from '../../services/admin';
import { logAdminAction } from '../../services/audit';
import { useAuthStore } from '../../store/useAuthStore';
import { useAdminRole } from '../../lib/useAdminRole';
import { can } from '../../lib/admin';
import { confirmAction, infoAlert } from '../../lib/cross-platform-alerts';

type Audience = 'all' | 'pregnant' | 'newborn' | 'toddler' | 'custom';
type NotifType = 'info' | 'reminder' | 'alert' | 'celebration';

const AUDIENCE_OPTIONS: { key: Audience; label: string; icon: string; desc: string }[] = [
  { key: 'all',      label: 'All Users',          icon: 'people-outline',         desc: 'Every registered user with push on' },
  { key: 'pregnant', label: 'Expecting Moms',     icon: 'heart-outline',          desc: 'Users with pregnancy profile' },
  { key: 'newborn',  label: 'Newborn Parents',    icon: 'happy-outline',          desc: 'Babies under 6 months' },
  { key: 'toddler',  label: 'Toddler Parents',    icon: 'walk-outline',           desc: 'Kids 6m – 36m' },
  { key: 'custom',   label: 'Custom recipients',  icon: 'list-outline',           desc: 'Hand-pick one or more users' },
];

const TYPE_OPTIONS: { key: NotifType; label: string; emoji: string; color: string }[] = [
  { key: 'info',        label: 'Info',        emoji: 'i', color: '#6b7280' },
  { key: 'reminder',    label: 'Reminder',    emoji: '!', color: '#8b5cf6' },
  { key: 'alert',       label: 'Alert',       emoji: '*', color: '#ef4444' },
  { key: 'celebration', label: 'Celebrate',   emoji: '+', color: Colors.primary },
];

const QUICK_TEMPLATES = [
  { title: 'Vaccine Reminder', body: 'Your baby\'s next vaccine appointment may be coming up soon. Check your schedule in MaaMitra.' },
  { title: 'New Article', body: 'We just added new articles to the library — curated for your baby\'s age. Tap to read.' },
  { title: 'Community Tip', body: 'Mothers in your community are sharing helpful tips today. Join the conversation!' },
  { title: 'Wellness Check', body: 'How are you feeling today? Log your mood in the Wellness tab and track your wellbeing.' },
  { title: 'New Government Scheme', body: 'A new benefit scheme is available for mothers in India. Check the Health tab for details.' },
];

const STATUS_COLOR: Record<PushQueueEntry['status'], string> = {
  pending: '#F59E0B',
  scheduled: '#3B82F6',
  sent: '#10B981',
  failed: '#EF4444',
  skipped: '#6B7280',
};

function deliveryTint(status: PushDeliveryEntry['status']): string {
  if (status === 'partial') return '#F59E0B';
  return STATUS_COLOR[status];
}

// Validate ISO-ish "YYYY-MM-DD HH:MM" or "YYYY-MM-DDTHH:MM" — return Date or null.
function parseScheduleInput(s: string): Date | null {
  if (!s) return null;
  const cleaned = s.trim().replace(' ', 'T');
  const t = Date.parse(cleaned);
  if (isNaN(t)) return null;
  const d = new Date(t);
  if (d.getTime() < Date.now() - 60_000) return null; // can't schedule into the past
  return d;
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

type Tab = 'compose' | 'outbox' | 'schedule';

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { user: actor } = useAuthStore();
  const role = useAdminRole();

  const [tab, setTab] = useState<Tab>('compose');
  const [outbox, setOutbox] = useState<PushQueueEntry[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledPushEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { void loadAll(); }, []);
  useEffect(() => { if (tab !== 'compose') void loadAll(); }, [tab]);

  async function loadAll() {
    setRefreshing(true);
    const [o, s] = await Promise.all([listPushOutbox(60), listScheduledPushes()]);
    setOutbox(o);
    setScheduled(s);
    setRefreshing(false);
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TabBtn label="Compose"  active={tab === 'compose'}  onPress={() => setTab('compose')}  />
        <TabBtn label={`Outbox (${outbox.length})`} active={tab === 'outbox'} onPress={() => setTab('outbox')} />
        <TabBtn label={`Scheduled (${scheduled.filter((s) => s.status === 'scheduled').length})`} active={tab === 'schedule'} onPress={() => setTab('schedule')} />
      </View>

      {tab === 'compose' && <ComposeTab onSent={loadAll} />}
      {tab === 'outbox' && (
        <OutboxList outbox={outbox} refreshing={refreshing} onRefresh={loadAll} />
      )}
      {tab === 'schedule' && (
        <ScheduleList
          scheduled={scheduled}
          refreshing={refreshing}
          onRefresh={loadAll}
          onCancel={async (id) => {
            if (!actor) return;
            const ok = await confirmAction('Cancel scheduled push?', 'It will not be sent. This is logged.');
            if (!ok) return;
            try {
              await cancelScheduledPush(actor, id);
              await loadAll();
            } catch (e: any) { infoAlert('Failed', e?.message ?? ''); }
          }}
        />
      )}
    </View>
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={onPress}>
      <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Compose tab ─────────────────────────────────────────────────────────────

function ComposeTab({ onSent }: { onSent: () => Promise<void> }) {
  const insets = useSafeAreaInsets();
  const { user: actor } = useAuthStore();
  const role = useAdminRole();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [type, setType] = useState<NotifType>('info');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [sending, setSending] = useState(false);
  // Custom recipient list — populated via the picker modal when audience='custom'.
  const [customUids, setCustomUids] = useState<Set<string>>(new Set());
  const [customLookup, setCustomLookup] = useState<Map<string, AdminUser>>(new Map());
  const [pickerOpen, setPickerOpen] = useState(false);

  // Audience preview state — when admin picks pregnant/newborn/toddler/all,
  // we lazy-load every user matching that bucket and let them tick names
  // off before sending. If anyone is deselected on send, we silently fall
  // back to the custom-list dispatch path with the kept uids.
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [audiencePreviewOpen, setAudiencePreviewOpen] = useState(false);
  const [deselectedAudienceUids, setDeselectedAudienceUids] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Wipe deselections any time the audience changes, so a tester
    // ticked off in "Newborn Parents" doesn't ghost-hide them when the
    // admin switches to "Toddler Parents".
    setDeselectedAudienceUids(new Set());
    setAudiencePreviewOpen(false);
  }, [audience]);

  // Eager-load the user list on mount so chip counts and the live
  // matched list are populated before the admin picks anything.
  useEffect(() => {
    void ensureUsersLoaded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ensureUsersLoaded() {
    if (usersLoaded || usersLoading) return;
    setUsersLoading(true);
    try {
      const data = await getUsers();
      setAllUsers(data);
      setUsersLoaded(true);
    } catch (err) {
      console.warn('audience preview load failed:', err);
    } finally {
      setUsersLoading(false);
    }
  }

  function audienceMatches(user: AdminUser, aud: Audience): boolean {
    if (aud === 'custom') return false;
    if (aud === 'all') return true;
    return user.audienceBuckets.includes(aud);
  }

  const audienceMatchedUsers = useMemo(() => {
    if (audience === 'custom') return [];
    return allUsers
      .filter((u) => audienceMatches(u, audience))
      .sort((a, b) => {
        // Push-enabled first, then alphabetical
        if (a.hasPushToken !== b.hasPushToken) return a.hasPushToken ? -1 : 1;
        return (a.name || a.email).localeCompare(b.name || b.email);
      });
  }, [allUsers, audience]);

  const audiencePushOnCount = useMemo(
    () => audienceMatchedUsers.filter((u) => u.hasPushToken).length,
    [audienceMatchedUsers],
  );

  // Real reach = bucket match ∩ push-on ∩ not deselected.
  const effectiveAudienceCount = useMemo(
    () =>
      audienceMatchedUsers.filter(
        (u) => u.hasPushToken && !deselectedAudienceUids.has(u.uid),
      ).length,
    [audienceMatchedUsers, deselectedAudienceUids],
  );

  // Audience counts for the filter chip badges (lazy — only after load).
  const audienceCounts = useMemo(() => {
    const map: Record<Audience, { matched: number; pushOn: number }> = {
      all: { matched: 0, pushOn: 0 },
      pregnant: { matched: 0, pushOn: 0 },
      newborn: { matched: 0, pushOn: 0 },
      toddler: { matched: 0, pushOn: 0 },
      custom: { matched: 0, pushOn: 0 },
    };
    if (!usersLoaded) return map;
    for (const u of allUsers) {
      map.all.matched++;
      if (u.hasPushToken) map.all.pushOn++;
      for (const b of u.audienceBuckets) {
        if (b === 'pregnant' || b === 'newborn' || b === 'toddler') {
          map[b].matched++;
          if (u.hasPushToken) map[b].pushOn++;
        }
      }
    }
    return map;
  }, [allUsers, usersLoaded]);

  function toggleAudienceDeselect(uid: string) {
    setDeselectedAudienceUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  function clearAudienceDeselects() {
    setDeselectedAudienceUids(new Set());
  }

  const hasAudienceDeselections = audience !== 'custom' && deselectedAudienceUids.size > 0;
  const audienceKeptUids = useMemo(() => {
    if (audience === 'custom') return [];
    // Skip push-off users — the dispatcher would skip them anyway, but
    // queuing per-user docs for them creates Firestore noise.
    return audienceMatchedUsers
      .filter((u) => u.hasPushToken && !deselectedAudienceUids.has(u.uid))
      .map((u) => u.uid);
  }, [audienceMatchedUsers, deselectedAudienceUids, audience]);

  const isValid =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    (audience !== 'custom' || customUids.size > 0) &&
    (!hasAudienceDeselections || audienceKeptUids.length > 0);
  const parsedSchedule = scheduleEnabled ? parseScheduleInput(scheduleDate) : null;

  function applyTemplate(tpl: typeof QUICK_TEMPLATES[0]) {
    setTitle(tpl.title);
    setBody(tpl.body);
  }

  async function handleSend() {
    if (!isValid || !actor) return;
    // Capability gate: custom-list uses the personal-push capability;
    // audience targeting uses the broadcast capability. They map to
    // different roles in lib/admin.ts.
    if (audience === 'custom' && !can(role, 'send_personal_push')) {
      infoAlert('Not allowed', 'Your role does not allow sending personal pushes.');
      return;
    }
    if (audience !== 'custom' && !can(role, 'send_broadcast_push')) {
      infoAlert('Not allowed', 'Your role does not allow sending broadcasts.');
      return;
    }
    if (scheduleEnabled && !parsedSchedule) {
      infoAlert('Invalid time', 'Use format YYYY-MM-DD HH:MM and pick a time in the future.');
      return;
    }
    const baseAudLabel = audience === 'custom'
      ? `${customUids.size} hand-picked user${customUids.size === 1 ? '' : 's'}`
      : AUDIENCE_OPTIONS.find((a) => a.key === audience)?.label;
    const audLabel = hasAudienceDeselections
      ? `${baseAudLabel} (${audienceKeptUids.length} of ${audienceMatchedUsers.length} after deselects)`
      : baseAudLabel;
    const ok = await confirmAction(
      scheduleEnabled ? 'Schedule push' : 'Send push',
      scheduleEnabled
        ? `Schedule "${title}" to ${audLabel} at ${parsedSchedule!.toLocaleString('en-IN')}?`
        : `Send "${title}" to ${audLabel} now?`,
      { confirmLabel: scheduleEnabled ? 'Schedule' : 'Send' },
    );
    if (!ok) return;

    setSending(true);
    try {
      // Audience with deselections → fan out as a per-user list so we
      // hit only the kept uids. Server-side broadcast doesn't accept an
      // exclusion list, so the cleanest path is to reuse the
      // custom-list dispatcher with the filtered uids.
      if (hasAudienceDeselections) {
        const uids = audienceKeptUids;
        if (scheduleEnabled && parsedSchedule) {
          await scheduleCustomListPush(actor, uids, {
            title: title.trim(),
            body: body.trim(),
            pushType: type,
            scheduledFor: parsedSchedule,
          });
          infoAlert('Scheduled', `Will fire to ${uids.length} user${uids.length === 1 ? '' : 's'} at ${parsedSchedule.toLocaleString('en-IN')}.`);
        } else {
          const { sent, failed } = await sendPushToUidList(actor, uids, {
            title: title.trim(),
            body: body.trim(),
          });
          infoAlert('Sent', `${sent} push${sent === 1 ? '' : 'es'} queued${failed ? `, ${failed} failed` : ''}.`);
        }
      } else if (audience === 'custom') {
        const uids = Array.from(customUids);
        if (scheduleEnabled && parsedSchedule) {
          await scheduleCustomListPush(actor, uids, {
            title: title.trim(),
            body: body.trim(),
            pushType: type,
            scheduledFor: parsedSchedule,
          });
          infoAlert('Scheduled', `Will fire to ${uids.length} user${uids.length === 1 ? '' : 's'} at ${parsedSchedule.toLocaleString('en-IN')}.`);
        } else {
          const { sent, failed } = await sendPushToUidList(actor, uids, {
            title: title.trim(),
            body: body.trim(),
          });
          infoAlert('Sent', `${sent} push${sent === 1 ? '' : 'es'} queued${failed ? `, ${failed} failed` : ''}.`);
        }
      } else if (scheduleEnabled && parsedSchedule) {
        await scheduleBroadcastPush(actor, {
          title: title.trim(),
          body: body.trim(),
          audience,
          pushType: type,
          scheduledFor: parsedSchedule,
        });
        infoAlert('Scheduled', `Will fire at ${parsedSchedule.toLocaleString('en-IN')}.`);
      } else {
        const id = await enqueueBroadcastPush({
          title: title.trim(),
          body: body.trim(),
          audience,
          type,
        });
        await logAdminAction(actor, 'push.broadcast', { docId: id ?? undefined, label: title.trim() }, { audience, type });
        infoAlert('Sent', 'The push job is queued. The dispatcher fans out to matching devices in seconds.');
      }
      setTitle('');
      setBody('');
      setScheduleDate('');
      setScheduleEnabled(false);
      setDeselectedAudienceUids(new Set());
      setAudiencePreviewOpen(false);
      // Keep the picker selection on send so the admin can compose a follow-up
      // to the same list quickly. Comment out the next two lines if you'd
      // rather clear it.
      // setCustomUids(new Set());
      // setCustomLookup(new Map());
      await onSent();
    } catch (e: any) {
      infoAlert('Failed', e?.message ?? 'Could not enqueue push.');
    } finally {
      setSending(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.composeContent, { paddingBottom: insets.bottom + 60 }]}>
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle-outline" size={16} color="#8b5cf6" />
        <Text style={styles.infoText}>
          Broadcasts are queued in Firestore and dispatched by the deployed
          <Text style={{ fontWeight: '700' }}> dispatchPush</Text> Cloud Function. Scheduled
          pushes wait in <Text style={{ fontWeight: '700' }}>scheduled_pushes</Text> until the
          scheduler promotes them. Users with announcements opt-out are skipped.
        </Text>
      </View>

      {/* Compose */}
      <Text style={styles.sectionTitle}>Message</Text>
      <View style={styles.card}>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Title (max 60 chars)"
          placeholderTextColor="#9ca3af"
          maxLength={60}
        />
        <TextInput
          style={[styles.input, styles.textArea, { marginTop: 10 }]}
          value={body}
          onChangeText={setBody}
          placeholder="Message body (max 200)"
          placeholderTextColor="#9ca3af"
          multiline
          maxLength={200}
        />
        <Text style={styles.charCount}>{title.length}/60 · {body.length}/200</Text>
      </View>

      {/* Templates */}
      <Text style={styles.sectionTitle}>Quick templates</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateRow}>
        {QUICK_TEMPLATES.map((t) => (
          <TouchableOpacity key={t.title} style={styles.templateChip} onPress={() => applyTemplate(t)}>
            <Text style={styles.templateText}>{t.title}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Type */}
      <Text style={styles.sectionTitle}>Type</Text>
      <View style={styles.typeRow}>
        {TYPE_OPTIONS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.typeChip, type === t.key && { backgroundColor: t.color + '18', borderColor: t.color }]}
            onPress={() => setType(t.key)}
          >
            <View style={[styles.typeBadge, { backgroundColor: t.color }]}>
              <Text style={styles.typeBadgeText}>{t.emoji}</Text>
            </View>
            <Text style={[styles.typeLabel, type === t.key && { color: t.color, fontWeight: '700' }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Audience — chip filters; matched list populates below */}
      <Text style={styles.sectionTitle}>Audience</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.audienceChipRow}>
        {AUDIENCE_OPTIONS.map((a) => {
          const active = audience === a.key;
          const counts = audienceCounts[a.key];
          const showCount = a.key !== 'custom' && usersLoaded;
          return (
            <TouchableOpacity
              key={a.key}
              style={[styles.audienceFilterChip, active && styles.audienceFilterChipActive]}
              onPress={() => setAudience(a.key)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={a.icon as any}
                size={13}
                color={active ? '#fff' : '#6b7280'}
              />
              <Text style={[styles.audienceFilterChipText, active && { color: '#fff' }]}>
                {a.label}
              </Text>
              {showCount ? (
                <View style={[styles.audienceFilterChipBadge, active && styles.audienceFilterChipBadgeActive]}>
                  <Text style={[styles.audienceFilterChipBadgeText, active && { color: '#fff' }]}>
                    {counts.pushOn}/{counts.matched}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <Text style={styles.audienceHelper}>
        {AUDIENCE_OPTIONS.find((a) => a.key === audience)?.desc}
        {audience !== 'custom' && usersLoaded ? '   ·   X / Y = push-enabled / total' : ''}
      </Text>

      {/* Live matched list — always visible for non-custom audiences */}
      {audience !== 'custom' ? (
        <View style={styles.audiencePreviewBlock}>
          <View style={styles.audienceSummaryRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.audienceSummaryHead}>
                {usersLoaded
                  ? `${effectiveAudienceCount} will receive`
                  : 'Loading users…'}
              </Text>
              <Text style={styles.audienceSummarySub}>
                {usersLoaded
                  ? `${audiencePushOnCount} push-on · ${audienceMatchedUsers.length - audiencePushOnCount} push-off · ${audienceMatchedUsers.length} matched`
                  : ' '}
              </Text>
            </View>
            {hasAudienceDeselections ? (
              <TouchableOpacity onPress={clearAudienceDeselects} style={styles.audiencePreviewClear}>
                <Ionicons name="refresh" size={11} color="#6B7280" />
                <Text style={styles.audiencePreviewClearText}>
                  Reset {deselectedAudienceUids.size}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {usersLoading && !usersLoaded ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 18 }} />
          ) : audienceMatchedUsers.length === 0 ? (
            <Text style={styles.audiencePreviewEmpty}>
              No users match this audience yet.
            </Text>
          ) : (
            <ScrollView
              style={styles.audiencePreviewList}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {audienceMatchedUsers.map((u) => {
                const isOff = deselectedAudienceUids.has(u.uid);
                const pushOn = u.hasPushToken;
                return (
                  <Pressable
                    key={u.uid}
                    style={[styles.audiencePreviewRow, isOff && { opacity: 0.45 }]}
                    onPress={() => toggleAudienceDeselect(u.uid)}
                  >
                    <View style={[styles.pickerCheckbox, !isOff && styles.pickerCheckboxOn]}>
                      {!isOff ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerRowName} numberOfLines={1}>
                        {u.name || 'Unnamed'}
                      </Text>
                      <Text style={styles.pickerRowMeta} numberOfLines={1}>
                        {u.email || '—'}
                        {u.state ? ` · ${u.state}` : ''}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.pushPill,
                        pushOn ? styles.pushPillOn : styles.pushPillOff,
                      ]}
                    >
                      <Ionicons
                        name={pushOn ? 'notifications' : 'notifications-off-outline'}
                        size={10}
                        color={pushOn ? '#10B981' : '#9CA3AF'}
                      />
                      <Text
                        style={[
                          styles.pushPillText,
                          { color: pushOn ? '#10B981' : '#9CA3AF' },
                        ]}
                      >
                        {pushOn ? 'on' : 'off'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      ) : null}

      {/* Custom recipient picker — only visible when audience='custom' */}
      {audience === 'custom' ? (
        <View style={styles.customRecipientsBlock}>
          <View style={styles.customRecipientsRow}>
            <Text style={styles.customRecipientsLabel}>
              {customUids.size === 0
                ? 'No recipients picked yet'
                : `${customUids.size} recipient${customUids.size === 1 ? '' : 's'} selected`}
            </Text>
            <TouchableOpacity style={styles.customPickBtn} onPress={() => setPickerOpen(true)}>
              <Ionicons name="people-outline" size={14} color="#fff" />
              <Text style={styles.customPickBtnText}>{customUids.size === 0 ? 'Pick users' : 'Edit list'}</Text>
            </TouchableOpacity>
          </View>
          {customUids.size > 0 ? (
            <View style={styles.chipsWrap}>
              {Array.from(customUids).slice(0, 12).map((uid) => {
                const u = customLookup.get(uid);
                const label = u?.name || u?.email || uid.slice(0, 8);
                return (
                  <View key={uid} style={styles.recipientChip}>
                    <Text style={styles.recipientChipText} numberOfLines={1}>{label}</Text>
                    <Pressable
                      onPress={() => {
                        setCustomUids((prev) => { const n = new Set(prev); n.delete(uid); return n; });
                      }}
                      hitSlop={6}
                    >
                      <Ionicons name="close" size={11} color="#6B7280" />
                    </Pressable>
                  </View>
                );
              })}
              {customUids.size > 12 ? (
                <View style={styles.recipientChip}>
                  <Text style={styles.recipientChipText}>+{customUids.size - 12} more</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      <RecipientPickerModal
        visible={pickerOpen}
        initialSelected={customUids}
        onClose={() => setPickerOpen(false)}
        onConfirm={(selectedUids, lookup) => {
          setCustomUids(selectedUids);
          setCustomLookup(lookup);
          setPickerOpen(false);
        }}
      />

      {/* Schedule */}
      <View style={styles.scheduleHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Schedule for later</Text>
          <Text style={styles.scheduleSub}>Off = send now. On = wait until the time below.</Text>
        </View>
        <Switch
          value={scheduleEnabled}
          onValueChange={setScheduleEnabled}
          trackColor={{ false: '#e5e7eb', true: Colors.primary }}
          thumbColor="#fff"
        />
      </View>

      {scheduleEnabled && (
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            value={scheduleDate}
            onChangeText={setScheduleDate}
            placeholder="YYYY-MM-DD HH:MM (e.g. 2026-05-01 09:00)"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
          />
          {parsedSchedule ? (
            <Text style={styles.scheduleParsed}>Will fire at {parsedSchedule.toLocaleString('en-IN')}</Text>
          ) : (
            <Text style={[styles.scheduleParsed, { color: '#ef4444' }]}>Enter a future timestamp.</Text>
          )}
        </View>
      )}

      <TouchableOpacity
        style={[styles.sendBtn, (!isValid || sending) && styles.sendBtnDim]}
        onPress={handleSend}
        disabled={!isValid || sending || (scheduleEnabled && !parsedSchedule)}
      >
        <LinearGradient
          colors={[Colors.primary, '#8b5cf6']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.sendBtnGrad}
        >
          {sending
            ? <ActivityIndicator color="#fff" size="small" />
            : <>
                <Ionicons name={scheduleEnabled ? 'time-outline' : 'send'} size={16} color="#fff" />
                <Text style={styles.sendBtnText}>{scheduleEnabled ? 'Schedule' : 'Send Now'}</Text>
              </>
          }
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Recipient picker modal ──────────────────────────────────────────────────
//
// Multi-select user list for custom-recipient pushes. Loads getUsers() once
// when the modal opens, lets the admin search by name/email/state and toggle
// selection. "Select all matches" makes it easy to push to every user
// matching a search term (e.g. all users in a particular state).

function RecipientPickerModal({
  visible,
  initialSelected,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  initialSelected: Set<string>;
  onClose: () => void;
  onConfirm: (selected: Set<string>, lookup: Map<string, AdminUser>) => void;
}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [lookup, setLookup] = useState<Map<string, AdminUser>>(new Map());

  // Reset selection to incoming when re-opening; load list lazily.
  useEffect(() => {
    if (!visible) return;
    setSelected(new Set(initialSelected));
    if (users.length === 0 && !loading) {
      setLoading(true);
      getUsers()
        .then((data) => {
          setUsers(data.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')));
          const m = new Map<string, AdminUser>();
          data.forEach((u) => m.set(u.uid, u));
          setLookup(m);
        })
        .finally(() => setLoading(false));
    }
  }, [visible]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return users;
    const tokens = q.split(/\s+/).filter(Boolean);
    return users.filter((u) => {
      const blob = [
        u.name ?? '',
        u.email ?? '',
        u.state ?? '',
        u.uid,
      ]
        .join(' ')
        .toLowerCase();
      return tokens.every((t) => blob.includes(t));
    });
  }, [users, search]);

  function toggle(uid: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(uid)) n.delete(uid);
      else n.add(uid);
      return n;
    });
  }
  function selectAllMatches() {
    setSelected((prev) => {
      const n = new Set(prev);
      filtered.forEach((u) => n.add(u.uid));
      return n;
    });
  }
  function clearAll() {
    setSelected(new Set());
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Pick recipients</Text>
              <Text style={styles.modalSub}>{selected.size} selected · {users.length} total</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.pickerSearchWrap}>
            <Ionicons name="search" size={14} color="#9CA3AF" />
            <TextInput
              style={styles.pickerSearchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search name, email, state…"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={14} color="#9CA3AF" />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.pickerToolbar}>
            <TouchableOpacity style={styles.pickerToolbarBtn} onPress={selectAllMatches} disabled={filtered.length === 0}>
              <Ionicons name="checkmark-done-outline" size={12} color={Colors.primary} />
              <Text style={styles.pickerToolbarBtnText}>Select all {search ? 'matches' : ''}{filtered.length > 0 ? ` (${filtered.length})` : ''}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pickerToolbarBtn} onPress={clearAll} disabled={selected.size === 0}>
              <Ionicons name="close-circle-outline" size={12} color="#EF4444" />
              <Text style={[styles.pickerToolbarBtnText, { color: '#EF4444' }]}>Clear</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled">
            {loading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 30 }} />
            ) : filtered.length === 0 ? (
              <Text style={styles.pickerEmpty}>{search ? 'No users match.' : 'No users yet.'}</Text>
            ) : filtered.map((u) => {
              const isSel = selected.has(u.uid);
              return (
                <Pressable key={u.uid} style={[styles.pickerRow, isSel && styles.pickerRowSelected]} onPress={() => toggle(u.uid)}>
                  <View style={[styles.pickerCheckbox, isSel && styles.pickerCheckboxOn]}>
                    {isSel ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerRowName} numberOfLines={1}>{u.name || 'Unnamed'}</Text>
                    <Text style={styles.pickerRowMeta} numberOfLines={1}>
                      {u.email || '—'}
                      {u.state ? ` · ${u.state}` : ''}
                      {u.kidsCount ? ` · ${u.kidsCount} kid${u.kidsCount === 1 ? '' : 's'}` : ''}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalBtn} onPress={onClose}>
              <Text style={styles.modalBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnPrimary, selected.size === 0 && { opacity: 0.5 }]}
              disabled={selected.size === 0}
              onPress={() => onConfirm(selected, lookup)}
            >
              <Text style={[styles.modalBtnText, { color: '#fff' }]}>Use {selected.size} selected</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Outbox tab ──────────────────────────────────────────────────────────────

function OutboxList({
  outbox,
  refreshing,
  onRefresh,
}: {
  outbox: PushQueueEntry[];
  refreshing: boolean;
  onRefresh: () => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportRows, setReportRows] = useState<PushDeliveryEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<PushQueueEntry | null>(null);

  async function openReport(entry: PushQueueEntry) {
    setActiveEntry(entry);
    setReportOpen(true);
    setReportLoading(true);
    try {
      const rows = await listPushDeliveryReport(entry.id);
      setReportRows(rows);
    } finally {
      setReportLoading(false);
    }
  }

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.composeContent, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {outbox.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="paper-plane-outline" size={40} color="#D1D5DB" />
            <Text style={styles.emptyText}>No pushes have been sent yet.</Text>
          </View>
        ) : outbox.map((e) => (
          <TouchableOpacity
            key={e.id}
            style={styles.outboxCard}
            activeOpacity={0.82}
            onPress={() => openReport(e)}
          >
            <View style={styles.outboxHead}>
              <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[e.status] }]} />
              <Text style={styles.outboxTitle} numberOfLines={1}>{e.title || '(no title)'}</Text>
              <Text style={styles.outboxTime}>{e.sentAt ? new Date(e.sentAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : new Date(e.createdAt || Date.now()).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
            <Text style={styles.outboxBody} numberOfLines={2}>{e.body}</Text>
            <View style={styles.outboxFoot}>
              <Chip label={e.kind === 'broadcast' ? `audience: ${e.audience ?? 'all'}` : 'personal'} />
              <Chip label={`status: ${e.status}`} tint={STATUS_COLOR[e.status]} />
              {typeof e.successCount === 'number' ? <Chip label={`✓ ${e.successCount}`} tint="#10B981" /> : null}
              {typeof e.failureCount === 'number' && e.failureCount > 0 ? <Chip label={`✗ ${e.failureCount}`} tint="#EF4444" /> : null}
              {typeof e.skippedRecipientCount === 'number' && e.skippedRecipientCount > 0 ? <Chip label={`skip ${e.skippedRecipientCount}`} tint="#6B7280" /> : null}
            </View>
            <Text style={styles.outboxHint}>Tap to view recipient report</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal
        visible={reportOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setReportOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setReportOpen(false)} />
          <View style={styles.reportSheet}>
            <View style={styles.reportHandle} />
            <View style={styles.reportHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.reportTitle} numberOfLines={2}>
                  {activeEntry?.title || 'Delivery report'}
                </Text>
                <Text style={styles.reportSub}>
                  {activeEntry?.recipientCount ?? reportRows.length} recipient{(activeEntry?.recipientCount ?? reportRows.length) === 1 ? '' : 's'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReportOpen(false)} style={styles.reportCloseBtn}>
                <Ionicons name="close" size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.reportSummaryRow}>
              <Chip label={`Delivered ${activeEntry?.deliveredRecipientCount ?? reportRows.filter((r) => r.status === 'sent' || r.status === 'partial').length}`} tint="#10B981" />
              <Chip label={`Failed ${activeEntry?.failedRecipientCount ?? reportRows.filter((r) => r.status === 'failed').length}`} tint="#EF4444" />
              <Chip label={`Skipped ${activeEntry?.skippedRecipientCount ?? reportRows.filter((r) => r.status === 'skipped').length}`} tint="#6B7280" />
            </View>

            <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ paddingBottom: 16 }}>
              {reportLoading ? (
                <View style={styles.empty}>
                  <ActivityIndicator color={Colors.primary} />
                  <Text style={styles.emptyText}>Loading recipient report…</Text>
                </View>
              ) : reportRows.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="document-text-outline" size={32} color="#D1D5DB" />
                  <Text style={styles.emptyText}>No recipient-level report recorded for this push.</Text>
                </View>
              ) : reportRows.map((row) => {
                const errorLabel = Object.entries(row.errorCodes || {})
                  .map(([code, count]) => `${code.replace('messaging/', '')} (${count})`)
                  .join(', ');
                return (
                  <View key={row.uid} style={styles.reportRow}>
                    <View style={styles.reportRowTop}>
                      <View style={[styles.statusDot, { backgroundColor: deliveryTint(row.status) }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reportRowName} numberOfLines={1}>
                          {row.name || row.email || row.uid}
                        </Text>
                        <Text style={styles.reportRowMeta} numberOfLines={1}>
                          {row.email || row.uid}
                        </Text>
                      </View>
                      <Chip label={row.status} tint={deliveryTint(row.status)} />
                    </View>
                    <Text style={styles.reportRowDetail}>
                      tokens {row.tokenCount} · delivered {row.successCount} · failed {row.failureCount}{row.deadTokens ? ` · dead ${row.deadTokens}` : ''}
                    </Text>
                    {row.skippedReason ? (
                      <Text style={styles.reportRowReason}>Skipped: {row.skippedReason}</Text>
                    ) : null}
                    {errorLabel ? (
                      <Text style={styles.reportRowReason}>Errors: {errorLabel}</Text>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Chip({ label, tint }: { label: string; tint?: string }) {
  return (
    <View style={[styles.outboxChip, tint ? { backgroundColor: `${tint}15`, borderColor: `${tint}40` } : null]}>
      <Text style={[styles.outboxChipText, tint ? { color: tint } : null]}>{label}</Text>
    </View>
  );
}

// ─── Schedule tab ────────────────────────────────────────────────────────────

function ScheduleList({
  scheduled,
  refreshing,
  onRefresh,
  onCancel,
}: {
  scheduled: ScheduledPushEntry[];
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  onCancel: (id: string) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const upcoming = scheduled.filter((s) => s.status === 'scheduled');
  const past = scheduled.filter((s) => s.status !== 'scheduled');
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.composeContent, { paddingBottom: insets.bottom + 40 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      <Text style={styles.sectionTitle}>Upcoming</Text>
      {upcoming.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="time-outline" size={36} color="#D1D5DB" />
          <Text style={styles.emptyText}>Nothing scheduled.</Text>
        </View>
      ) : upcoming.map((s) => (
        <View key={s.id} style={styles.outboxCard}>
          <View style={styles.outboxHead}>
            <Ionicons name="time-outline" size={14} color="#3B82F6" />
            <Text style={styles.outboxTitle} numberOfLines={1}>{s.title}</Text>
            <Text style={styles.outboxTime}>{new Date(s.scheduledFor).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
          <Text style={styles.outboxBody} numberOfLines={2}>{s.body}</Text>
          <View style={styles.outboxFoot}>
            {s.kind === 'custom' ? (
              <Chip label={`custom · ${(s.targetUids?.length ?? 0)} recipient${(s.targetUids?.length ?? 0) === 1 ? '' : 's'}`} tint="#EC4899" />
            ) : (
              <Chip label={`audience: ${s.audience ?? 'all'}`} />
            )}
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={styles.cancelBtn} onPress={() => onCancel(s.id)}>
              <Ionicons name="close" size={13} color="#EF4444" />
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {past.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 18 }]}>History</Text>
          {past.map((s) => (
            <View key={s.id} style={[styles.outboxCard, { opacity: 0.7 }]}>
              <View style={styles.outboxHead}>
                <Ionicons name="checkmark-circle-outline" size={14} color={s.status === 'sent' ? '#10B981' : '#9CA3AF'} />
                <Text style={styles.outboxTitle} numberOfLines={1}>{s.title}</Text>
                <Text style={styles.outboxTime}>{new Date(s.scheduledFor).toLocaleString('en-IN', { day: 'numeric', month: 'short' })}</Text>
              </View>
              <Text style={styles.outboxBody} numberOfLines={2}>{s.body}</Text>
              <View style={styles.outboxFoot}>
                <Chip label={`status: ${s.status}`} />
                {s.kind === 'custom' ? (
                  <Chip label={`custom · ${(s.targetUids?.length ?? 0)} recipient${(s.targetUids?.length ?? 0) === 1 ? '' : 's'}`} tint="#EC4899" />
                ) : (
                  <Chip label={`audience: ${s.audience ?? 'all'}`} />
                )}
              </View>
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },

  tabBar: {
    flexDirection: 'row', gap: 6, padding: 12, paddingBottom: 6,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  tabBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabBtnText: { fontSize: 12, fontWeight: '700', color: '#6b7280' },
  tabBtnTextActive: { color: '#fff' },

  composeContent: { padding: 16 },

  infoBanner: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#ede9fe', borderRadius: 12, padding: 12, marginBottom: 12,
  },
  infoText: { flex: 1, fontSize: 12, color: '#5b21b6', lineHeight: 17 },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#1a1a2e', marginBottom: 8, marginTop: 12 },

  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#f3f4f6', padding: 12, marginBottom: 4 },
  input: { backgroundColor: '#f9fafb', borderRadius: 10, padding: 10, fontSize: 14, color: '#1a1a2e', borderWidth: 1, borderColor: '#e5e7eb' },
  textArea: { minHeight: 80, textAlignVertical: 'top' as any },
  charCount: { fontSize: 11, color: '#d1d5db', textAlign: 'right', marginTop: 6 },

  templateRow: { gap: 8, paddingBottom: 4 },
  templateChip: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#e5e7eb' },
  templateText: { fontSize: 12, color: '#374151', fontWeight: '600' },

  typeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  typeChip: {
    flex: 1, minWidth: '48%',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: '#f3f4f6',
  },
  typeBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  typeBadgeText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  typeLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280' },

  audienceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  audienceIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  audienceInfo: { flex: 1 },
  audienceLabel: { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  audienceDesc: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: Colors.primary },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  divider: { height: 1, backgroundColor: '#f9fafb' },

  scheduleHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  scheduleSub: { fontSize: 11, color: '#9ca3af' },
  scheduleParsed: { fontSize: 11, color: '#10B981', marginTop: 8, fontWeight: '700' },

  sendBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 16 },
  sendBtnDim: { opacity: 0.4 },
  sendBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  sendBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  // Outbox / schedule list
  empty: { alignItems: 'center', padding: 30, gap: 8 },
  emptyText: { fontSize: 13, color: '#9ca3af' },

  outboxCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#F0EDF5', gap: 6,
  },
  outboxHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  outboxTitle: { flex: 1, fontSize: 13, fontWeight: '800', color: '#1a1a2e' },
  outboxTime: { fontSize: 10, color: '#9CA3AF' },
  outboxBody: { fontSize: 12, color: '#4B5563', lineHeight: 17 },
  outboxFoot: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, alignItems: 'center' },
  outboxHint: { fontSize: 11, color: '#8B5CF6', fontWeight: '700', marginTop: 2 },
  outboxChip: {
    flexDirection: 'row', gap: 4, alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  outboxChipText: { fontSize: 10, fontWeight: '700', color: '#6B7280' },

  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8,
  },
  cancelBtnText: { fontSize: 11, fontWeight: '700', color: '#EF4444' },

  // Audience filter chips
  audienceChipRow: { gap: 6, paddingBottom: 4, paddingRight: 4 },
  audienceFilterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 11, paddingVertical: 7, borderRadius: 16,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB',
  },
  audienceFilterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  audienceFilterChipText: { fontSize: 12, fontWeight: '700', color: '#374151' },
  audienceFilterChipBadge: {
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  audienceFilterChipBadgeActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  audienceFilterChipBadgeText: { fontSize: 10, fontWeight: '800', color: '#6B7280' },
  audienceHelper: { fontSize: 10, color: '#9CA3AF', marginTop: 6, marginBottom: 4 },

  // Live audience list (no toggle — always shown when non-custom)
  audiencePreviewBlock: {
    backgroundColor: '#fff', borderRadius: 12, marginTop: 4,
    borderWidth: 1, borderColor: '#E9D5FF', overflow: 'hidden',
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10,
  },
  audienceSummaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  audienceSummaryHead: { fontSize: 13, fontWeight: '800', color: '#1a1a2e' },
  audienceSummarySub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  audiencePreviewEmpty: {
    fontSize: 12, color: '#9CA3AF', textAlign: 'center', paddingVertical: 14,
  },
  audiencePreviewClear: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
    marginBottom: 6,
  },
  audiencePreviewClearText: { fontSize: 10, fontWeight: '700', color: '#6B7280' },
  audiencePreviewList: { maxHeight: 320 },
  audiencePreviewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  pushPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
    borderWidth: 1,
  },
  pushPillOn: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  pushPillOff: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' },
  pushPillText: { fontSize: 10, fontWeight: '800' },

  // Custom recipients block (compose tab, audience='custom')
  customRecipientsBlock: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12, marginTop: 4,
    borderWidth: 1, borderColor: '#E9D5FF', gap: 10,
  },
  customRecipientsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  customRecipientsLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  customPickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primary, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  customPickBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  recipientChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F3F4F6', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#E5E7EB',
    maxWidth: 200,
  },
  recipientChipText: { fontSize: 11, fontWeight: '600', color: '#1a1a2e' },

  reportSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    maxHeight: '88%',
  },
  reportHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 12,
  },
  reportHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  reportTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a2e' },
  reportSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  reportCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  reportSummaryRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  reportRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0EDF5',
    padding: 12,
    gap: 6,
    marginBottom: 8,
  },
  reportRowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reportRowName: { fontSize: 13, fontWeight: '800', color: '#1a1a2e' },
  reportRowMeta: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  reportRowDetail: { fontSize: 12, color: '#4B5563' },
  reportRowReason: { fontSize: 11, color: '#9CA3AF', lineHeight: 16 },

  // Picker modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 16, gap: 10, maxHeight: '90%',
  },
  modalHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a2e' },
  modalSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  closeBtn: { padding: 6 },

  pickerSearchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F9FAFB', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  pickerSearchInput: { flex: 1, fontSize: 13, color: '#1a1a2e' },

  pickerToolbar: { flexDirection: 'row', gap: 8 },
  pickerToolbarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  pickerToolbarBtnText: { fontSize: 11, fontWeight: '700', color: Colors.primary },

  pickerList: { maxHeight: 380 },
  pickerEmpty: { textAlign: 'center', color: '#9CA3AF', fontSize: 13, paddingVertical: 30 },

  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 4, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  pickerRowSelected: { backgroundColor: '#FAF5FF' },
  pickerCheckbox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 2, borderColor: '#D1D5DB', backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  pickerCheckboxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pickerRowName: { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  pickerRowMeta: { fontSize: 11, color: '#6B7280', marginTop: 2 },

  modalActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  modalBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  modalBtnPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  modalBtnText: { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
});
