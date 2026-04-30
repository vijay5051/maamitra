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
  cancelScheduledPush,
  listPushOutbox,
  listScheduledPushes,
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

  const isValid = title.trim().length > 0 && body.trim().length > 0 &&
    (audience !== 'custom' || customUids.size > 0);
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
    const audLabel = audience === 'custom'
      ? `${customUids.size} hand-picked user${customUids.size === 1 ? '' : 's'}`
      : AUDIENCE_OPTIONS.find((a) => a.key === audience)?.label;
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
      if (audience === 'custom') {
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

      {/* Audience */}
      <Text style={styles.sectionTitle}>Audience</Text>
      <View style={styles.card}>
        {AUDIENCE_OPTIONS.map((a, i) => (
          <View key={a.key}>
            <TouchableOpacity style={styles.audienceRow} onPress={() => setAudience(a.key)}>
              <View style={[styles.audienceIcon, audience === a.key && { backgroundColor: Colors.primary }]}>
                <Ionicons name={a.icon as any} size={16} color={audience === a.key ? '#fff' : '#9ca3af'} />
              </View>
              <View style={styles.audienceInfo}>
                <Text style={styles.audienceLabel}>{a.label}</Text>
                <Text style={styles.audienceDesc}>{a.desc}</Text>
              </View>
              <View style={[styles.radio, audience === a.key && styles.radioActive]}>
                {audience === a.key ? <View style={styles.radioDot} /> : null}
              </View>
            </TouchableOpacity>
            {i < AUDIENCE_OPTIONS.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </View>

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
  return (
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
        <View key={e.id} style={styles.outboxCard}>
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
          </View>
        </View>
      ))}
    </ScrollView>
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

  // Picker modal
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
