/**
 * Admin · Support inbox.
 *
 * Wave 3 rebuild. AdminPage shell + FilterBar tabs + DataTable
 * + SlideOver-based ticket detail with reply thread, quick replies,
 * status switcher, and push-on-reply toggle.
 */
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import {
  AdminPage,
  Column,
  DataTable,
  FilterBar,
  SlideOver,
  StatCard,
  StatusBadge,
  Toolbar,
  ToolbarButton,
} from '../../components/admin/ui';
import { TICKET_STATUSES, TICKET_STATUS_COLORS, TICKET_STATUS_LABELS, TicketStatus } from '../../lib/adminEnums';
import { useAuthStore } from '../../store/useAuthStore';
import { useAdminRole } from '../../lib/useAdminRole';
import { can } from '../../lib/admin';
import { listSupportTickets, replyToTicket, setTicketStatus, SupportTicket } from '../../services/admin';
import { draftTicketReply, isAdminAiConfigured } from '../../services/adminAi';

const QUICK_REPLIES = [
  { label: 'Acknowledge', text: 'Thank you for reaching out — we have received your message and will look into it.' },
  { label: 'Ask for info', text: 'Could you share a screenshot of what you are seeing, plus the email address on the account? That will help us reproduce it quickly.' },
  { label: 'Resolved', text: 'This should be fixed now in the latest version of the app. Please pull to refresh and let us know if it still happens.' },
  { label: 'Vaccine question', text: 'The schedule shown follows the IAP recommendations for India. If your paediatrician has suggested a variation you can long-press the dose to mark it complete on the date they administered.' },
];

export default function SupportInbox() {
  const { user: actor } = useAuthStore();
  const role = useAdminRole();
  const canReply = can(role, 'reply_support');
  const canClose = can(role, 'close_ticket');

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TicketStatus | 'all'>('open');
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<SupportTicket | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setTickets(await listSupportTickets({ status: 'all' }));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleReply(text: string, sendPush: boolean) {
    if (!actor || !active || !canReply) return;
    try {
      await replyToTicket(actor, active.id, text, { sendPush });
      const fresh = await listSupportTickets({ status: 'all' });
      setTickets(fresh);
      setActive(fresh.find((t) => t.id === active.id) ?? null);
    } catch (e: any) {
      setError(e?.message ?? 'Reply failed');
    }
  }

  async function handleStatus(status: TicketStatus) {
    if (!actor || !active) return;
    if (status !== 'open' && !canClose) return;
    try {
      await setTicketStatus(actor, active.id, status);
      const fresh = await listSupportTickets({ status: 'all' });
      setTickets(fresh);
      setActive(fresh.find((t) => t.id === active.id) ?? null);
    } catch (e: any) {
      setError(e?.message ?? 'Status change failed');
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: tickets.length, open: 0, in_progress: 0, resolved: 0, closed: 0 };
    for (const t of tickets) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [tickets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
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

  const filterChips = [
    { key: 'open', label: 'Open', count: counts.open ?? 0 },
    { key: 'in_progress', label: 'In progress', count: counts.in_progress ?? 0 },
    { key: 'resolved', label: 'Resolved', count: counts.resolved ?? 0 },
    { key: 'closed', label: 'Closed', count: counts.closed ?? 0 },
    { key: 'all', label: 'All', count: counts.all ?? 0 },
  ];

  const columns: Column<SupportTicket>[] = [
    {
      key: 'status',
      header: 'Status',
      width: 130,
      render: (t) => (
        <StatusBadge
          label={TICKET_STATUS_LABELS[t.status as TicketStatus] ?? t.status}
          color={TICKET_STATUS_COLORS[t.status as TicketStatus] ?? Colors.textMuted}
        />
      ),
      sort: (t) => t.status,
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (t) => (
        <View>
          <Text style={styles.cellPrimary} numberOfLines={1}>{t.subject || '—'}</Text>
          <Text style={styles.cellMeta} numberOfLines={1}>{t.message}</Text>
        </View>
      ),
      sort: (t) => t.subject ?? '',
    },
    {
      key: 'who',
      header: 'From',
      width: 200,
      render: (t) => (
        <View>
          <Text style={styles.cellPrimary} numberOfLines={1}>{t.name || 'Anonymous'}</Text>
          <Text style={styles.cellMeta} numberOfLines={1}>{t.email || '—'}</Text>
        </View>
      ),
      sort: (t) => t.name ?? '',
    },
    {
      key: 'replies',
      header: 'Replies',
      width: 90,
      align: 'right',
      render: (t) => <Text style={styles.cellNumber}>{t.replies?.length ?? 0}</Text>,
      sort: (t) => t.replies?.length ?? 0,
    },
    {
      key: 'createdAt',
      header: 'When',
      width: 140,
      align: 'right',
      render: (t) => (
        <Text style={styles.cellMeta}>
          {t.createdAt
            ? new Date(t.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
            : '—'}
        </Text>
      ),
      sort: (t) => t.createdAt ?? '',
    },
  ];

  return (
    <>
      <Stack.Screen options={{ title: 'Support' }} />
      <AdminPage
        title="Support inbox"
        description="Reply, close, reopen. Tap a ticket to open the thread, send a reply (optionally with a push), and walk it through the status pipeline."
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Support' }]}
        headerActions={<ToolbarButton label="Refresh" icon="refresh" onPress={load} />}
        toolbar={
          <View style={{ gap: 10 }}>
            <Toolbar
              search={{
                value: search,
                onChange: setSearch,
                placeholder: 'Search subject, message, email, name…',
              }}
              leading={<Text style={styles.countText}>{filtered.length} of {tickets.length}</Text>}
            />
            <FilterBar chips={filterChips} active={filter} onChange={(k) => setFilter(k as any)} />
          </View>
        }
        error={error}
      >
        <View style={styles.statsRow}>
          <StatCard label="Open"        value={counts.open}        icon="alert-circle-outline" deltaPositive="down" />
          <StatCard label="In progress" value={counts.in_progress} icon="hourglass-outline" />
          <StatCard label="Resolved"    value={counts.resolved}    icon="checkmark-done-outline" />
          <StatCard label="Total"       value={counts.all}         icon="archive-outline" />
        </View>

        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(t) => t.id}
          loading={loading}
          onRowPress={(t) => setActive(t)}
          emptyTitle={search ? 'No tickets match' : filter === 'open' ? 'Inbox clear' : 'Nothing here'}
          emptyBody={search ? 'Try a different search.' : filter === 'open' ? 'No open tickets — nice work.' : 'Adjust the filter to see more.'}
        />
      </AdminPage>

      <TicketDrawer
        ticket={active}
        canReply={canReply}
        canClose={canClose}
        onClose={() => setActive(null)}
        onReply={handleReply}
        onSetStatus={handleStatus}
      />
    </>
  );
}

// ─── Ticket detail drawer ─────────────────────────────────────────────────
function TicketDrawer({ ticket, canReply, canClose, onClose, onReply, onSetStatus }: {
  ticket: SupportTicket | null;
  canReply: boolean;
  canClose: boolean;
  onClose: () => void;
  onReply: (text: string, sendPush: boolean) => Promise<void>;
  onSetStatus: (status: TicketStatus) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [sendPush, setSendPush] = useState(true);
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  useEffect(() => { setText(''); setSendPush(true); setDraftError(null); }, [ticket?.id]);

  async function aiDraft() {
    if (!ticket) return;
    setDrafting(true);
    setDraftError(null);
    try {
      const draft = await draftTicketReply({
        subject: ticket.subject,
        message: ticket.message,
        userName: ticket.name,
        priorReplies: ticket.replies?.map((r) => ({ from: 'admin' as const, text: r.text })) ?? [],
      });
      setText(draft);
    } catch (e: any) {
      setDraftError(e?.message ?? 'AI draft failed.');
    } finally {
      setDrafting(false);
    }
  }

  return (
    <SlideOver
      visible={!!ticket}
      title={ticket?.subject ?? ''}
      subtitle={ticket ? `${ticket.name || 'Anonymous'}${ticket.email ? ` · ${ticket.email}` : ''}` : undefined}
      onClose={onClose}
      footer={
        canReply ? (
          <>
            <View style={styles.toggleRow}>
              <Switch value={sendPush} onValueChange={setSendPush} thumbColor={Colors.white} trackColor={{ false: Colors.border, true: Colors.primary }} />
              <Text style={styles.toggleLabel}>Send push</Text>
            </View>
            <ToolbarButton
              label={busy ? 'Sending…' : 'Send reply'}
              icon="paper-plane-outline"
              variant="primary"
              disabled={!text.trim() || busy}
              onPress={async () => {
                setBusy(true);
                try { await onReply(text.trim(), sendPush); setText(''); }
                finally { setBusy(false); }
              }}
            />
          </>
        ) : null
      }
    >
      {ticket ? (
        <>
          <Text style={styles.metaLine}>
            {ticket.appVersion ? `v${ticket.appVersion}` : 'unknown version'}
            {ticket.platform ? ` · ${ticket.platform}` : ''}
            {ticket.createdAt ? ` · ${new Date(ticket.createdAt).toLocaleString('en-IN')}` : ''}
          </Text>

          <View style={styles.bubble}>
            <Text style={styles.bubbleAuthor}>{ticket.name || 'User'}</Text>
            <Text style={styles.bubbleText}>{ticket.message}</Text>
          </View>

          {ticket.replies?.map((r, i) => (
            <View key={i} style={[styles.bubble, styles.bubbleAdmin]}>
              <Text style={[styles.bubbleAuthor, { color: Colors.white }]}>You · {r.byEmail}{r.sentPush ? ' · push sent' : ''}</Text>
              <Text style={[styles.bubbleText, { color: Colors.white }]}>{r.text}</Text>
              <Text style={styles.bubbleMeta}>{r.at ? new Date(r.at).toLocaleString('en-IN') : ''}</Text>
            </View>
          ))}

          <Text style={styles.sectionLabel}>Status</Text>
          <View style={styles.statusRow}>
            {TICKET_STATUSES.map((s) => {
              const active = ticket.status === s;
              const canSwitch = s === 'open' || canClose;
              return (
                <Pressable
                  key={s}
                  onPress={() => canSwitch && !active && onSetStatus(s)}
                  style={[
                    styles.statusBtn,
                    active && { backgroundColor: TICKET_STATUS_COLORS[s], borderColor: TICKET_STATUS_COLORS[s] },
                    !canSwitch && { opacity: 0.4 },
                  ]}
                >
                  <Text style={[styles.statusBtnText, active && { color: Colors.white }]}>
                    {TICKET_STATUS_LABELS[s]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {canReply ? (
            <>
              <Text style={styles.sectionLabel}>Quick replies</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {QUICK_REPLIES.map((q) => (
                  <Pressable
                    key={q.label}
                    style={styles.quickReplyChip}
                    onPress={() => setText((cur) => cur ? `${cur}\n\n${q.text}` : q.text)}
                  >
                    <Text style={styles.quickReplyText}>{q.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.lg }}>
                <Text style={styles.sectionLabel}>Reply</Text>
                <View style={{ flex: 1 }} />
                {isAdminAiConfigured() ? (
                  <ToolbarButton
                    label={drafting ? 'Drafting…' : 'AI draft'}
                    icon="sparkles-outline"
                    onPress={aiDraft}
                    disabled={drafting}
                  />
                ) : null}
              </View>
              <TextInput
                style={styles.replyInput}
                placeholder="Write a reply…"
                placeholderTextColor={Colors.textMuted}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={2000}
              />
              {draftError ? <Text style={[styles.helperText, { color: Colors.error }]}>{draftError}</Text> : null}
              <Text style={styles.helperText}>
                Replies are stored in the ticket thread. Toggle "Send push" to also notify the user.
                {isAdminAiConfigured() ? ' Tap "AI draft" to have Claude propose a reply you can edit before sending.' : ''}
              </Text>
            </>
          ) : null}
        </>
      ) : null}
    </SlideOver>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  countText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textLight, letterSpacing: 0.4 },
  cellPrimary: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  cellMeta: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 2 },
  cellNumber: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark, fontVariant: ['tabular-nums'] },

  metaLine: { fontSize: FontSize.xs, color: Colors.textMuted },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textLight,
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginTop: Spacing.md, marginBottom: 6,
  },

  bubble: {
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
    gap: 4,
  },
  bubbleAdmin: { backgroundColor: Colors.primary, borderColor: Colors.primary, alignSelf: 'flex-end', maxWidth: '90%' },
  bubbleAuthor: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.textDark },
  bubbleText: { fontSize: FontSize.sm, color: Colors.textDark, lineHeight: 19 },
  bubbleMeta: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgLight,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  statusBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textDark },

  quickReplyChip: {
    paddingHorizontal: Spacing.md, paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySoft,
    borderWidth: 1, borderColor: Colors.primary,
  },
  quickReplyText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },

  replyInput: {
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: FontSize.sm, color: Colors.textDark,
    backgroundColor: Colors.bgLight,
    minHeight: 100, textAlignVertical: 'top',
  },
  helperText: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 6 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 'auto' },
  toggleLabel: { fontSize: FontSize.sm, color: Colors.textDark, fontWeight: '600' },
});
