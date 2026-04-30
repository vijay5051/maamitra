/**
 * Admin · Support inbox.
 *
 * Reads every doc in `supportTickets`, groups by status, lets the admin
 * reply (push notification + ticket-thread record) and move tickets through
 * open → in_progress → resolved.
 *
 * Quick-reply templates live in-component to keep this surface entirely
 * client-driven; if templates ever grow we'll move them to app_settings.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { useAuthStore } from '../../store/useAuthStore';
import { useAdminRole } from '../../lib/useAdminRole';
import { can } from '../../lib/admin';
import {
  listSupportTickets,
  replyToTicket,
  setTicketStatus,
  SupportTicket,
} from '../../services/admin';
import { infoAlert } from '../../lib/cross-platform-alerts';

const STATUS_LABEL: Record<SupportTicket['status'], string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const STATUS_COLOR: Record<SupportTicket['status'], string> = {
  open: '#F59E0B',
  in_progress: '#3B82F6',
  resolved: '#10B981',
  closed: '#9CA3AF',
};

const QUICK_REPLIES = [
  { label: 'Acknowledge', text: 'Thank you for reaching out — we have received your message and will look into it.' },
  { label: 'Asking for more info', text: 'Could you share a screenshot of what you are seeing, plus the email address on the account? That will help us reproduce it quickly.' },
  { label: 'Resolved', text: 'This should be fixed now in the latest version of the app. Please pull to refresh and let us know if it still happens.' },
  { label: 'Vaccine schedule question', text: 'The schedule shown follows the IAP recommendations for India. If your paediatrician has suggested a variation you can long-press the dose to mark it complete on the date they administered.' },
];

// ─── Status filter pill ──────────────────────────────────────────────────────

function StatusPill({
  k,
  label,
  count,
  active,
  onPress,
}: {
  k: SupportTicket['status'] | 'all';
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  const color = k === 'all' ? Colors.primary : STATUS_COLOR[k as SupportTicket['status']];
  return (
    <TouchableOpacity
      style={[styles.statusPill, active && { backgroundColor: color, borderColor: color }]}
      onPress={onPress}
    >
      <Text style={[styles.statusPillText, active && { color: '#fff' }]}>{label}</Text>
      <View style={[styles.statusBadge, active && { backgroundColor: '#ffffff44' }]}>
        <Text style={[styles.statusBadgeText, active && { color: '#fff' }]}>{count}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Ticket detail modal ─────────────────────────────────────────────────────

function TicketModal({
  ticket,
  onClose,
  onReply,
  onSetStatus,
}: {
  ticket: SupportTicket | null;
  onClose: () => void;
  onReply: (text: string, sendPush: boolean) => Promise<void>;
  onSetStatus: (status: SupportTicket['status']) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [sendPush, setSendPush] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setText(''); setSendPush(true); }, [ticket?.id]);

  if (!ticket) return null;

  return (
    <Modal visible={!!ticket} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalCard}>
          <View style={styles.modalHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle} numberOfLines={1}>{ticket.subject}</Text>
              <Text style={styles.modalSub}>{ticket.name}{ticket.email ? ` · ${ticket.email}` : ''}</Text>
              <Text style={styles.modalSubMeta}>
                {ticket.appVersion ? `v${ticket.appVersion}` : 'unknown version'}
                {ticket.platform ? ` · ${ticket.platform}` : ''}
                {ticket.createdAt ? ` · ${new Date(ticket.createdAt).toLocaleString('en-IN')}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={{ gap: 10, paddingBottom: 12 }}>
            <View style={styles.bubble}>
              <Text style={styles.bubbleAuthor}>{ticket.name || 'User'}</Text>
              <Text style={styles.bubbleText}>{ticket.message}</Text>
            </View>
            {ticket.replies?.map((r, i) => (
              <View key={i} style={[styles.bubble, styles.bubbleAdmin]}>
                <Text style={[styles.bubbleAuthor, { color: '#fff' }]}>You · {r.byEmail}{r.sentPush ? ' · push sent' : ''}</Text>
                <Text style={[styles.bubbleText, { color: '#fff' }]}>{r.text}</Text>
                <Text style={styles.bubbleMeta}>{r.at ? new Date(r.at).toLocaleString('en-IN') : ''}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Status row */}
          <View style={styles.statusRow}>
            {(['open', 'in_progress', 'resolved', 'closed'] as const).map((s) => {
              const active = ticket.status === s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusBtn, active && { backgroundColor: STATUS_COLOR[s], borderColor: STATUS_COLOR[s] }]}
                  disabled={active || busy}
                  onPress={async () => {
                    setBusy(true);
                    try { await onSetStatus(s); } finally { setBusy(false); }
                  }}
                >
                  <Text style={[styles.statusBtnText, active && { color: '#fff' }]}>{STATUS_LABEL[s]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Quick reply chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
            {QUICK_REPLIES.map((q) => (
              <TouchableOpacity
                key={q.label}
                style={styles.quickReplyChip}
                onPress={() => setText((cur) => cur ? `${cur}\n\n${q.text}` : q.text)}
              >
                <Text style={styles.quickReplyText}>{q.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TextInput
            style={styles.replyInput}
            placeholder="Reply…"
            placeholderTextColor="#9CA3AF"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2000}
          />
          <View style={styles.replyFoot}>
            <View style={styles.toggleRow}>
              <Switch value={sendPush} onValueChange={setSendPush} />
              <Text style={styles.toggleLabel}>Notify by push</Text>
            </View>
            <TouchableOpacity
              style={[styles.sendBtn, (!text.trim() || busy) && { opacity: 0.5 }]}
              disabled={!text.trim() || busy}
              onPress={async () => {
                setBusy(true);
                try { await onReply(text.trim(), sendPush); setText(''); }
                finally { setBusy(false); }
              }}
            >
              <Ionicons name="paper-plane" size={14} color="#fff" />
              <Text style={styles.sendBtnText}>{busy ? 'Sending…' : 'Send reply'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function SupportInbox() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user: actor } = useAuthStore();
  const role = useAdminRole();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<SupportTicket['status'] | 'all'>('open');
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<SupportTicket | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setTickets(await listSupportTickets({ status: 'all' }));
    setLoading(false);
  }

  async function refresh() {
    setRefreshing(true);
    setTickets(await listSupportTickets({ status: 'all' }));
    setRefreshing(false);
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: tickets.length, open: 0, in_progress: 0, resolved: 0, closed: 0 };
    for (const t of tickets) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [tickets]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tickets.filter((t) => {
      if (filter !== 'all' && t.status !== filter) return false;
      if (!q) return true;
      return (
        t.subject.toLowerCase().includes(q) ||
        t.message.toLowerCase().includes(q) ||
        (t.email ?? '').toLowerCase().includes(q) ||
        (t.name ?? '').toLowerCase().includes(q)
      );
    });
  }, [tickets, filter, search]);

  async function handleReply(text: string, sendPush: boolean) {
    if (!actor || !active) return;
    if (!can(role, 'reply_support')) {
      infoAlert('Not allowed', 'Your role does not include support reply.');
      return;
    }
    try {
      await replyToTicket(actor, active.id, text, { sendPush });
      const fresh = await listSupportTickets({ status: 'all' });
      setTickets(fresh);
      setActive(fresh.find((t) => t.id === active.id) ?? null);
    } catch (e: any) {
      infoAlert('Failed', e?.message ?? 'Reply failed');
    }
  }

  async function handleStatus(status: SupportTicket['status']) {
    if (!actor || !active) return;
    if (status !== 'open' && !can(role, 'close_ticket')) {
      infoAlert('Not allowed', 'Your role cannot change ticket status.');
      return;
    }
    try {
      await setTicketStatus(actor, active.id, status);
      const fresh = await listSupportTickets({ status: 'all' });
      setTickets(fresh);
      setActive(fresh.find((t) => t.id === active.id) ?? null);
    } catch (e: any) {
      infoAlert('Failed', e?.message ?? 'Status change failed');
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} />}
    >
      <LinearGradient colors={['#F5F0FF', '#EDE4FF']} style={styles.headerCard}>
        <Text style={styles.headerEyebrow}>Admin · Support</Text>
        <Text style={styles.headerTitle}>Inbox</Text>
        <Text style={styles.headerSub}>{counts.open} open · {counts.in_progress} in progress · {counts.resolved + counts.closed} closed</Text>
      </LinearGradient>

      <View style={styles.filterRow}>
        {(['all', 'open', 'in_progress', 'resolved', 'closed'] as const).map((k) => (
          <StatusPill
            key={k}
            k={k as any}
            label={k === 'all' ? 'All' : STATUS_LABEL[k as SupportTicket['status']]}
            count={counts[k] ?? 0}
            active={filter === k}
            onPress={() => setFilter(k)}
          />
        ))}
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search subject, message, email…"
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 30 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="checkmark-done-outline" size={36} color="#D1D5DB" />
          <Text style={styles.emptyText}>{search ? 'No tickets match' : filter === 'open' ? 'Inbox zero — no open tickets.' : 'Nothing here.'}</Text>
        </View>
      ) : (
        filtered.map((t) => (
          <Pressable key={t.id} style={styles.ticketCard} onPress={() => setActive(t)} android_ripple={{ color: '#F3F4F6' }}>
            <View style={[styles.ticketBar, { backgroundColor: STATUS_COLOR[t.status] }]} />
            <View style={{ flex: 1 }}>
              <View style={styles.ticketHead}>
                <Text style={styles.ticketSubject} numberOfLines={1}>{t.subject}</Text>
                <Text style={styles.ticketDate}>{t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</Text>
              </View>
              <Text style={styles.ticketMeta} numberOfLines={1}>{t.name}{t.email ? ` · ${t.email}` : ''}</Text>
              <Text style={styles.ticketBody} numberOfLines={2}>{t.message}</Text>
              <View style={styles.ticketFoot}>
                <View style={[styles.ticketStatusChip, { backgroundColor: `${STATUS_COLOR[t.status]}20` }]}>
                  <Text style={[styles.ticketStatusText, { color: STATUS_COLOR[t.status] }]}>{STATUS_LABEL[t.status]}</Text>
                </View>
                {t.replies && t.replies.length > 0 ? (
                  <View style={styles.ticketStatusChip}>
                    <Ionicons name="chatbubble-outline" size={10} color="#6B7280" />
                    <Text style={[styles.ticketStatusText, { color: '#6B7280' }]}>{t.replies.length} repl{t.replies.length === 1 ? 'y' : 'ies'}</Text>
                  </View>
                ) : null}
                {t.uid ? (
                  <TouchableOpacity onPress={() => router.push(`/admin/users/${t.uid}` as any)}>
                    <Text style={styles.openProfile}>Open profile →</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </Pressable>
        ))
      )}

      <TicketModal
        ticket={active}
        onClose={() => setActive(null)}
        onReply={handleReply}
        onSetStatus={handleStatus}
      />
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  content: { padding: 16, gap: 12 },

  headerCard: { borderRadius: 16, padding: 16 },
  headerEyebrow: { fontSize: 11, fontWeight: '800', color: Colors.primary, letterSpacing: 1.2, textTransform: 'uppercase' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1a1a2e', marginTop: 2 },
  headerSub: { fontSize: 12, color: '#6B7280', marginTop: 4 },

  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB',
  },
  statusPillText: { fontSize: 11, fontWeight: '700', color: '#1a1a2e' },
  statusBadge: { backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 6, minWidth: 20, alignItems: 'center' },
  statusBadgeText: { fontSize: 10, fontWeight: '800', color: '#6B7280' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  searchInput: { flex: 1, fontSize: 13, color: '#1a1a2e' },

  empty: { alignItems: 'center', padding: 30, gap: 8 },
  emptyText: { fontSize: 13, color: '#9CA3AF' },

  ticketCard: {
    flexDirection: 'row', gap: 10,
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#F0EDF5',
  },
  ticketBar: { width: 4, borderRadius: 2 },
  ticketHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ticketSubject: { flex: 1, fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  ticketDate: { fontSize: 11, color: '#9CA3AF' },
  ticketMeta: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  ticketBody: { fontSize: 12, color: '#4B5563', marginTop: 6, lineHeight: 17 },
  ticketFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  ticketStatusChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: '#F3F4F6' },
  ticketStatusText: { fontSize: 10, fontWeight: '700' },
  openProfile: { fontSize: 11, fontWeight: '700', color: Colors.primary, marginLeft: 'auto' as any },

  // Ticket modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 16, gap: 10, maxHeight: '90%',
  },
  modalHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a2e' },
  modalSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  modalSubMeta: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  closeBtn: { padding: 6 },
  modalBody: { maxHeight: 240 },

  bubble: {
    backgroundColor: '#F3F4F6', borderRadius: 12, padding: 10, gap: 4,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  bubbleAdmin: { backgroundColor: Colors.primary, borderColor: Colors.primary, alignSelf: 'flex-end', maxWidth: '92%' },
  bubbleAuthor: { fontSize: 10, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.6 },
  bubbleText: { fontSize: 13, color: '#1a1a2e', lineHeight: 18 },
  bubbleMeta: { fontSize: 10, color: '#ffffff99', marginTop: 4 },

  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusBtn: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB',
  },
  statusBtnText: { fontSize: 11, fontWeight: '700', color: '#1a1a2e' },

  quickReplyChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: '#F3F4F6' },
  quickReplyText: { fontSize: 11, fontWeight: '700', color: '#1a1a2e' },

  replyInput: {
    backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, minHeight: 80,
    fontSize: 13, color: '#1a1a2e', textAlignVertical: 'top' as any,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  replyFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLabel: { fontSize: 12, color: '#1a1a2e', fontWeight: '600' },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
