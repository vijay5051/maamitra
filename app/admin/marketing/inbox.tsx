/**
 * Admin · Marketing unified inbox (M4).
 *
 * Split-pane: thread list left, selected conversation right.
 * Shows IG comments + IG DMs + FB comments + FB messages in one queue.
 *
 * Status: M4a (UI + endpoint scaffolding) is shipped. M4b will register
 * the webhook URL with Meta + wire outbound Graph API calls. Until then:
 *   - Real Meta events won't flow in (admin can inject test threads).
 *   - "Send reply" stores message with outboundStatus=pending_send;
 *     a hint tells admin to copy + paste manually until M4b lands.
 */

import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../../constants/theme';
import {
  AdminPage,
  EmptyState,
  StatusBadge,
  ToolbarButton,
} from '../../../components/admin/ui';
import {
  classifyInboxThread,
  countByStatus,
  deleteThread,
  injectTestThread,
  markThreadRead,
  sendReply,
  setThreadStatus,
  subscribeMessages,
  subscribeThreads,
  suggestInboxReplies,
} from '../../../services/marketingInbox';
import {
  InboxIntent,
  InboxMessage,
  InboxStatus,
  InboxThread,
} from '../../../lib/marketingTypes';
import { useAuthStore } from '../../../store/useAuthStore';

const STATUS_FILTERS: { value: InboxStatus | 'all'; label: string }[] = [
  { value: 'all',      label: 'All' },
  { value: 'unread',   label: 'Unread' },
  { value: 'replied',  label: 'Replied' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'archived', label: 'Archived' },
  { value: 'spam',     label: 'Spam' },
];

const CHANNEL_LABEL: Record<string, string> = {
  ig_comment: 'IG · Comment',
  ig_dm: 'IG · DM',
  fb_comment: 'FB · Comment',
  fb_message: 'FB · Msg',
};

const SENTIMENT_TONE: Record<string, string> = {
  positive: Colors.success,
  question: Colors.primary,
  complaint: Colors.error,
  neutral: Colors.textMuted,
  spam: Colors.textMuted,
};

const URGENCY_LABEL: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'Urgent' };
const URGENCY_TONE: Record<string, string> = { low: Colors.textMuted, medium: Colors.warning, high: Colors.error };

export default function MarketingInboxScreen() {
  const user = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState<InboxStatus | 'all'>('unread');
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [injecting, setInjecting] = useState(false);

  // Subscribe to threads.
  useEffect(() => {
    setLoading(true);
    const unsub = subscribeThreads({ limitN: 200 }, (rows) => {
      setThreads(rows);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Subscribe to messages of selected thread.
  useEffect(() => {
    if (!openId) {
      setMessages([]);
      return;
    }
    const unsub = subscribeMessages(openId, setMessages);
    // Mark read on open (clears unreadCount).
    void markThreadRead(openId).catch(() => {});
    return () => unsub();
  }, [openId]);

  const visible = useMemo(() => {
    let rows = threads;
    if (filter !== 'all') rows = rows.filter((t) => t.status === filter);
    return rows;
  }, [threads, filter]);

  const counts = useMemo(() => {
    const out: Record<InboxStatus | 'all', number> = {
      all: threads.length, unread: 0, replied: 0, resolved: 0, archived: 0, spam: 0,
    };
    threads.forEach((t) => { out[t.status] += 1; });
    return out;
  }, [threads]);

  const openThread = openId ? threads.find((t) => t.id === openId) ?? null : null;

  async function handleInjectTest() {
    if (!user) return;
    setInjecting(true);
    setError(null);
    try {
      const id = await injectTestThread({ uid: user.uid, email: user.email });
      setOpenId(id);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setInjecting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Inbox' }} />
      <AdminPage
        title="Unified inbox"
        description="Comments + DMs from Instagram and Facebook in one queue. AI suggestions in your brand voice; sentiment + urgency auto-classified on every inbound."
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Marketing', href: '/admin/marketing' },
          { label: 'Inbox' },
        ]}
        headerActions={
          <ToolbarButton
            label={injecting ? 'Injecting…' : 'Inject test thread'}
            icon="flask"
            onPress={handleInjectTest}
            disabled={injecting}
          />
        }
        loading={loading && threads.length === 0}
        error={error}
      >
        <View style={styles.gatedNote}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.gatedNoteText}>
            M4a — endpoint + UI shipped. Real Meta events flow once the webhook URL is registered + App Review approves the inbox permissions. Until then, "Inject test thread" lets you exercise the UX with synthetic data.
          </Text>
        </View>

        <View style={styles.split}>
          <View style={styles.leftRail}>
            <View style={styles.filterBar}>
              {STATUS_FILTERS.map((f) => (
                <Pressable
                  key={f.value}
                  onPress={() => setFilter(f.value)}
                  style={[styles.filterChip, filter === f.value && styles.filterChipActive]}
                >
                  <Text style={[styles.filterLabel, filter === f.value && styles.filterLabelActive]}>{f.label}</Text>
                  <Text style={[styles.filterCount, filter === f.value && styles.filterCountActive]}>{counts[f.value]}</Text>
                </Pressable>
              ))}
            </View>

            {visible.length === 0 ? (
              <EmptyState
                kind="empty"
                title={filter === 'all' ? 'No threads yet' : `No ${filter} threads`}
                body="Inject a test thread to exercise the UX, or wait for real Meta events once the webhook is approved."
                compact
              />
            ) : (
              <View style={{ gap: 6 }}>
                {visible.map((t) => (
                  <ThreadRow
                    key={t.id}
                    thread={t}
                    selected={t.id === openId}
                    onSelect={() => setOpenId(t.id)}
                  />
                ))}
              </View>
            )}
          </View>

          <View style={styles.rightPane}>
            {openThread ? (
              <ConversationPane
                thread={openThread}
                messages={messages}
                actor={user ? { uid: user.uid, email: user.email } : null}
                onClose={() => setOpenId(null)}
              />
            ) : (
              <View style={styles.placeholder}>
                <Ionicons name="chatbubble-outline" size={56} color={Colors.textMuted} />
                <Text style={styles.placeholderTitle}>Pick a thread</Text>
                <Text style={styles.placeholderBody}>The conversation appears here. Click a row on the left.</Text>
              </View>
            )}
          </View>
        </View>
      </AdminPage>
    </>
  );
}

// ── Thread row ──────────────────────────────────────────────────────────────

function ThreadRow({ thread, selected, onSelect }: { thread: InboxThread; selected: boolean; onSelect: () => void }) {
  const sentTone = SENTIMENT_TONE[thread.sentiment] ?? Colors.textMuted;
  const channelLabel = CHANNEL_LABEL[thread.channel] ?? thread.channel;
  return (
    <Pressable onPress={onSelect} style={[styles.threadRow, selected && styles.threadRowSelected]}>
      <View style={styles.threadAvatar}>
        <Text style={styles.threadAvatarText}>{thread.authorName?.[0]?.toUpperCase() ?? '?'}</Text>
        {thread.unreadCount > 0 ? (
          <View style={styles.unreadDot}>
            <Text style={styles.unreadDotText}>{thread.unreadCount > 9 ? '9+' : thread.unreadCount}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.threadHead}>
          <Text style={styles.threadAuthor} numberOfLines={1}>{thread.authorName}</Text>
          {thread.urgency === 'high' ? <Text style={[styles.urgencyDot, { color: Colors.error }]}>•</Text> : null}
          {thread.isSynthetic ? <Text style={styles.testBadge}>TEST</Text> : null}
          <Text style={styles.threadTime}>{shortTime(thread.lastMessageAt)}</Text>
        </View>
        <View style={styles.threadMeta}>
          <Text style={styles.threadChannel}>{channelLabel}</Text>
          <View style={[styles.sentDot, { backgroundColor: sentTone }]} />
          <Text style={styles.threadSent}>{thread.sentiment}</Text>
        </View>
        <Text style={styles.threadPreview} numberOfLines={2}>{thread.preview}</Text>
      </View>
    </Pressable>
  );
}

// ── Conversation pane ───────────────────────────────────────────────────────

function ConversationPane({
  thread,
  messages,
  actor,
  onClose,
}: {
  thread: InboxThread;
  messages: InboxMessage[];
  actor: { uid: string; email: string | null | undefined } | null;
  onClose: () => void;
}) {
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [suggestions, setSuggestions] = useState<{ tone: string; text: string }[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [paneError, setPaneError] = useState<string | null>(null);
  const [usedSuggestion, setUsedSuggestion] = useState(false);

  // Reset state on thread change.
  useEffect(() => {
    setReply('');
    setSuggestions([]);
    setPaneError(null);
    setUsedSuggestion(false);
  }, [thread.id]);

  async function handleSuggest() {
    if (!actor) return;
    setSuggesting(true);
    setPaneError(null);
    try {
      const res = await suggestInboxReplies({ threadId: thread.id });
      if (!res.ok) throw new Error(`${res.code}: ${res.message}`);
      setSuggestions(res.suggestions);
    } catch (e: any) {
      setPaneError(e?.message ?? String(e));
    } finally {
      setSuggesting(false);
    }
  }

  async function handleClassify() {
    if (!actor) return;
    setClassifying(true);
    setPaneError(null);
    try {
      const res = await classifyInboxThread({ threadId: thread.id });
      if (!res.ok) throw new Error(`${res.code}: ${res.message}`);
    } catch (e: any) {
      setPaneError(e?.message ?? String(e));
    } finally {
      setClassifying(false);
    }
  }

  async function handleSend() {
    if (!actor || !reply.trim()) return;
    setSending(true);
    setPaneError(null);
    try {
      await sendReply(actor, thread.id, reply, usedSuggestion);
      setReply('');
      setSuggestions([]);
      setUsedSuggestion(false);
    } catch (e: any) {
      setPaneError(e?.message ?? String(e));
    } finally {
      setSending(false);
    }
  }

  async function handleStatus(status: InboxStatus) {
    if (!actor) return;
    setPaneError(null);
    try {
      await setThreadStatus(actor, thread.id, status);
      if (status === 'archived' || status === 'spam') onClose();
    } catch (e: any) {
      setPaneError(e?.message ?? String(e));
    }
  }

  async function handleDelete() {
    if (!actor) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && !window.confirm('Delete this thread permanently?')) return;
    try {
      await deleteThread(actor, thread.id);
      onClose();
    } catch (e: any) {
      setPaneError(e?.message ?? String(e));
    }
  }

  async function copyText(text: string) {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    }
  }

  return (
    <View style={styles.convo}>
      <View style={styles.convoHeader}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={styles.convoAuthor}>{thread.authorName}</Text>
            {thread.isSynthetic ? <Text style={styles.testBadge}>TEST</Text> : null}
            <Text style={styles.convoChannel}>{CHANNEL_LABEL[thread.channel] ?? thread.channel}</Text>
          </View>
          <View style={styles.convoMeta}>
            <StatusBadge label={thread.sentiment} color={SENTIMENT_TONE[thread.sentiment] ?? Colors.textMuted} />
            <StatusBadge label={intentLabel(thread.intent)} color={Colors.textMuted} />
            <StatusBadge label={URGENCY_LABEL[thread.urgency] ?? thread.urgency} color={URGENCY_TONE[thread.urgency] ?? Colors.textMuted} />
            <Text style={styles.metaInline}>External: {thread.authorExternalId.slice(0, 16)}…</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Pressable
            onPress={handleClassify}
            disabled={classifying}
            style={[styles.headerBtn, styles.btnGhost]}
          >
            <Ionicons name="sparkles-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.headerBtnLabel}>{classifying ? 'Classifying…' : 'Re-classify'}</Text>
          </Pressable>
          {thread.status !== 'resolved' ? (
            <Pressable onPress={() => handleStatus('resolved')} style={[styles.headerBtn, styles.btnGhost]}>
              <Ionicons name="checkmark-done" size={14} color={Colors.success} />
              <Text style={[styles.headerBtnLabel, { color: Colors.success }]}>Resolve</Text>
            </Pressable>
          ) : null}
          {thread.status !== 'spam' ? (
            <Pressable onPress={() => handleStatus('spam')} style={[styles.headerBtn, styles.btnGhost]}>
              <Ionicons name="warning-outline" size={14} color={Colors.warning} />
              <Text style={[styles.headerBtnLabel, { color: Colors.warning }]}>Spam</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => handleStatus('archived')} style={[styles.headerBtn, styles.btnGhost]}>
            <Ionicons name="archive-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.headerBtnLabel}>Archive</Text>
          </Pressable>
          <Pressable onPress={handleDelete} style={[styles.headerBtn, styles.btnGhost]}>
            <Ionicons name="trash-outline" size={14} color={Colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <View style={styles.timeline}>
        {messages.length === 0 ? (
          <Text style={styles.empty}>No messages yet.</Text>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} authorName={thread.authorName} onCopy={copyText} />)
        )}
      </View>

      <View style={styles.replyArea}>
        {paneError ? <Text style={styles.errorText}>{paneError}</Text> : null}

        {suggestions.length > 0 ? (
          <View style={styles.suggestList}>
            {suggestions.map((s, i) => (
              <Pressable key={i} onPress={() => { setReply(s.text); setUsedSuggestion(true); }} style={styles.suggestChip}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.suggestTone}>{s.tone}</Text>
                  <Text style={styles.suggestText} numberOfLines={3}>{s.text}</Text>
                </View>
                <Ionicons name="arrow-down-circle-outline" size={18} color={Colors.primary} />
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.replyRow}>
          <TextInput
            style={[styles.input, styles.replyInput]}
            value={reply}
            onChangeText={setReply}
            placeholder="Type a reply…"
            placeholderTextColor={Colors.textMuted}
            multiline
          />
          <View style={{ gap: 6 }}>
            <Pressable onPress={handleSuggest} disabled={suggesting} style={[styles.btn, styles.btnGhost]}>
              <Ionicons name="sparkles" size={14} color={Colors.primary} />
              <Text style={[styles.btnLabel, { color: Colors.primary }]}>{suggesting ? 'Thinking…' : 'AI suggest'}</Text>
            </Pressable>
            <Pressable
              onPress={handleSend}
              disabled={sending || !reply.trim()}
              style={[styles.btn, styles.btnPrimary, (!reply.trim() || sending) && { opacity: 0.6 }]}
            >
              <Ionicons name="send" size={14} color="#fff" />
              <Text style={styles.btnLabel}>{sending ? 'Queuing…' : 'Queue reply'}</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.replyHint}>
          Replies are queued (status: pending_send). They auto-publish via Graph once Meta access lands. For now, hit Copy on the message bubble after queueing and paste manually into Meta.
        </Text>
      </View>
    </View>
  );
}

function MessageBubble({ message, authorName, onCopy }: { message: InboxMessage; authorName: string; onCopy: (text: string) => void }) {
  const isOutbound = message.direction === 'outbound';
  const status = message.outboundStatus;
  return (
    <View style={[styles.bubbleWrap, isOutbound ? styles.bubbleWrapOutbound : styles.bubbleWrapInbound]}>
      <View style={[styles.bubble, isOutbound ? styles.bubbleOutbound : styles.bubbleInbound]}>
        <Text style={[styles.bubbleAuthor, isOutbound ? styles.bubbleAuthorOutbound : null]}>
          {isOutbound ? (message.sentBy ?? 'us') : authorName}
        </Text>
        <Text style={[styles.bubbleText, isOutbound ? styles.bubbleTextOutbound : null]}>{message.text}</Text>
        <View style={styles.bubbleMeta}>
          <Text style={[styles.bubbleTime, isOutbound ? styles.bubbleTimeOutbound : null]}>
            {shortTime(message.sentAt)}{message.fromSuggestion ? ' · AI assist' : ''}
          </Text>
          {isOutbound && status ? (
            <Text style={[styles.bubbleStatus, status === 'failed' && { color: Colors.error }]}>
              {status === 'pending_send' ? 'queued' : status === 'sent' ? 'sent' : 'failed'}
            </Text>
          ) : null}
        </View>
        {isOutbound && status === 'pending_send' ? (
          <Pressable onPress={() => onCopy(message.text)} style={styles.copyInline}>
            <Ionicons name="copy" size={12} color={Colors.primary} />
            <Text style={styles.copyInlineLabel}>Copy to paste manually</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function intentLabel(intent: InboxIntent): string {
  switch (intent) {
    case 'greeting': return 'greeting';
    case 'question_general': return 'question';
    case 'question_medical': return 'medical Q';
    case 'praise': return 'praise';
    case 'complaint': return 'complaint';
    case 'lead': return 'lead';
    case 'spam': return 'spam';
    default: return intent;
  }
}

function shortTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth() && d.getUTCDate() === now.getUTCDate();
  if (sameDay) {
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  }
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' });
}

const styles = StyleSheet.create({
  gatedNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: Spacing.md,
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    marginBottom: Spacing.md,
  },
  gatedNoteText: { flex: 1, fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 18 },

  split: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  leftRail: {
    width: 360,
    flexShrink: 0,
    gap: Spacing.sm,
  },
  rightPane: {
    flex: 1,
    minWidth: 320,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    minHeight: 500,
    overflow: 'hidden',
    ...Shadow.sm,
  },

  filterBar: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 4 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bgLight,
  },
  filterChipActive: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  filterLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textMuted },
  filterLabelActive: { color: Colors.primary, fontWeight: '700' },
  filterCount: {
    fontSize: 10, color: Colors.textMuted, backgroundColor: Colors.cardBg,
    paddingHorizontal: 6, borderRadius: 999, fontWeight: '700', minWidth: 18, textAlign: 'center',
  },
  filterCountActive: { color: Colors.primary, backgroundColor: '#fff' },

  threadRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  threadRowSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  threadAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  threadAvatarText: { color: Colors.primary, fontWeight: '800', fontSize: FontSize.sm },
  unreadDot: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.error,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadDotText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  threadHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  threadAuthor: { flex: 1, fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  threadTime: { fontSize: 10, color: Colors.textMuted },
  urgencyDot: { fontSize: 18, fontWeight: '900', lineHeight: 14 },
  testBadge: {
    fontSize: 9, fontWeight: '800', color: '#fff',
    backgroundColor: Colors.warning, paddingHorizontal: 4, paddingVertical: 1,
    borderRadius: 3, letterSpacing: 0.5,
  },
  threadMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  threadChannel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  sentDot: { width: 6, height: 6, borderRadius: 3 },
  threadSent: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', textTransform: 'capitalize' },
  threadPreview: { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 18 },

  placeholder: { padding: Spacing.xl * 2, alignItems: 'center', justifyContent: 'center', gap: 6 },
  placeholderTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  placeholderBody: { fontSize: FontSize.xs, color: Colors.textMuted },

  convo: { flex: 1 },
  convoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSoft,
    backgroundColor: Colors.bgLight,
  },
  convoAuthor: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textDark },
  convoChannel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
  convoMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  metaInline: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600' },

  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: Radius.sm },
  headerBtnLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  btnGhost: { backgroundColor: Colors.bgLight, borderWidth: 1, borderColor: Colors.border },

  timeline: { padding: Spacing.md, gap: 8, minHeight: 240, maxHeight: 460 },
  empty: { color: Colors.textMuted, textAlign: 'center', padding: Spacing.lg },

  bubbleWrap: { flexDirection: 'row' },
  bubbleWrapInbound: { justifyContent: 'flex-start' },
  bubbleWrapOutbound: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.lg,
    gap: 4,
  },
  bubbleInbound: { backgroundColor: Colors.bgLight, borderTopLeftRadius: 4 },
  bubbleOutbound: { backgroundColor: Colors.primary, borderTopRightRadius: 4 },
  bubbleAuthor: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  bubbleAuthorOutbound: { color: '#FAD9E5' },
  bubbleText: { fontSize: FontSize.sm, color: Colors.textDark, lineHeight: 20 },
  bubbleTextOutbound: { color: '#fff' },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bubbleTime: { fontSize: 10, color: Colors.textMuted },
  bubbleTimeOutbound: { color: '#FAD9E5' },
  bubbleStatus: { fontSize: 10, fontWeight: '800', color: Colors.warning, textTransform: 'uppercase', letterSpacing: 0.4 },
  copyInline: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, alignSelf: 'flex-start' },
  copyInlineLabel: { fontSize: 10, fontWeight: '700', color: Colors.primary },

  replyArea: {
    padding: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.borderSoft,
    gap: 8,
  },
  replyRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  replyInput: { flex: 1, minHeight: 70, textAlignVertical: 'top' },
  replyHint: { fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: 'italic', lineHeight: 18 },
  errorText: { color: Colors.error, fontSize: FontSize.xs, fontWeight: '600' },

  suggestList: { gap: 6 },
  suggestChip: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: 10,
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  suggestTone: { fontSize: 10, fontWeight: '800', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  suggestText: { fontSize: FontSize.xs, color: Colors.textDark, lineHeight: 18 },

  input: {
    backgroundColor: '#fff',
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: FontSize.sm,
    color: Colors.textDark,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  btnPrimary: { backgroundColor: Colors.primary },
  btnLabel: { color: '#fff', fontWeight: '700', fontSize: FontSize.xs },
});
