// Unified inbox service (M4).
//
// Reads `marketing_inbox` threads + their `messages` subcollection. Most
// writes happen server-side (webhook receiver) but admin-driven writes
// (mark resolved, send reply, classify on demand) go through here.
//
// Outbound replies are queued with status='pending_send' until M4b wires
// the Graph API call. The UI shows a clear "queued — copy/paste manually
// for now" hint for any pending_send message.

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import {
  InboxChannel,
  InboxIntent,
  InboxMessage,
  InboxSentiment,
  InboxStatus,
  InboxThread,
  InboxUrgency,
  OutboundStatus,
} from '../lib/marketingTypes';
import { logAdminAction } from './audit';
import { app, db } from './firebase';

const THREADS_COL = 'marketing_inbox';

// ── Reads ───────────────────────────────────────────────────────────────────

export interface ListThreadsOpts {
  status?: InboxStatus | 'all';
  limitN?: number;
}

export function subscribeThreads(
  opts: ListThreadsOpts,
  cb: (rows: InboxThread[]) => void,
): Unsubscribe {
  if (!db) {
    cb([]);
    return () => {};
  }
  const { status = 'all', limitN = 100 } = opts;
  const constraints: any[] = [orderBy('lastMessageAt', 'desc'), limit(Math.min(limitN, 300))];
  if (status !== 'all') constraints.unshift(where('status', '==', status));
  const q = query(collection(db, THREADS_COL), ...constraints);
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map(rowToThread)),
    () => cb([]),
  );
}

export function subscribeMessages(threadId: string, cb: (rows: InboxMessage[]) => void): Unsubscribe {
  if (!db || !threadId) {
    cb([]);
    return () => {};
  }
  const q = query(collection(db, THREADS_COL, threadId, 'messages'), orderBy('sentAt', 'asc'), limit(500));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => rowToMessage(d.id, d.data() as any, threadId))),
    () => cb([]),
  );
}

export async function fetchThread(threadId: string): Promise<InboxThread | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, THREADS_COL, threadId));
    if (!snap.exists()) return null;
    return rowToThread(snap as any);
  } catch {
    return null;
  }
}

export async function countByStatus(): Promise<Record<InboxStatus | 'all', number>> {
  const empty: Record<InboxStatus | 'all', number> = {
    all: 0, unread: 0, replied: 0, resolved: 0, archived: 0, spam: 0,
  };
  if (!db) return empty;
  try {
    const snap = await getDocs(query(collection(db, THREADS_COL), orderBy('lastMessageAt', 'desc'), limit(300)));
    const out = { ...empty };
    out.all = snap.size;
    snap.forEach((d) => {
      const s = (d.data() as any)?.status as InboxStatus | undefined;
      if (s && s in out) out[s] += 1;
    });
    return out;
  } catch {
    return empty;
  }
}

// ── Writes (admin-driven) ───────────────────────────────────────────────────

export async function setThreadStatus(
  actor: { uid: string; email: string | null | undefined },
  threadId: string,
  status: InboxStatus,
): Promise<void> {
  if (!db) throw new Error('Firestore not ready');
  const update: Record<string, unknown> = { status };
  if (status === 'replied' || status === 'resolved') update.unreadCount = 0;
  await updateDoc(doc(db, THREADS_COL, threadId), update);
  await logAdminAction(
    actor,
    status === 'archived' || status === 'spam' ? 'marketing.inbox.archive' : 'marketing.inbox.reply',
    { docId: threadId },
    { status },
  );
}

/** Mark a thread "read" without changing its status — clears unreadCount. */
export async function markThreadRead(threadId: string): Promise<void> {
  if (!db) throw new Error('Firestore not ready');
  await updateDoc(doc(db, THREADS_COL, threadId), { unreadCount: 0 });
}

/** Queue an outbound reply. Status=pending_send until M4b wires Graph. */
export async function sendReply(
  actor: { uid: string; email: string | null | undefined },
  threadId: string,
  text: string,
  fromSuggestion: boolean,
): Promise<string> {
  if (!db) throw new Error('Firestore not ready');
  const trimmed = text.trim().slice(0, 2000);
  if (!trimmed) throw new Error('Empty reply.');
  const messagesCol = collection(db, THREADS_COL, threadId, 'messages');
  const ref = await addDoc(messagesCol, {
    direction: 'outbound',
    text: trimmed,
    attachments: [],
    sentAt: serverTimestamp(),
    sentBy: actor.email ?? actor.uid,
    fromSuggestion,
    outboundStatus: 'pending_send' as OutboundStatus,
    outboundError: null,
  });
  // Bump thread status to 'replied' so it leaves the unread queue.
  await updateDoc(doc(db, THREADS_COL, threadId), {
    status: 'replied',
    unreadCount: 0,
    lastMessageAt: serverTimestamp(),
  });
  await logAdminAction(actor, 'marketing.inbox.reply', { docId: threadId }, { messageId: ref.id });
  return ref.id;
}

/** Synthetic test thread — admin-only, opt-in, clearly tagged. Per CLAUDE.md
 *  "no mocks in prod" rules: this is admin-clicked, not unconditional, and
 *  every consumer renders an explicit TEST badge so it's never confused
 *  with a real Meta event. */
export async function injectTestThread(actor: { uid: string; email: string | null | undefined }): Promise<string> {
  if (!db) throw new Error('Firestore not ready');
  const channel: InboxChannel = (['ig_comment', 'ig_dm', 'fb_comment', 'fb_message'] as InboxChannel[])[
    Math.floor(Math.random() * 4)
  ];
  const samples = [
    { author: 'Priya Sharma',  msg: 'Hi! My 4-month-old refuses bottle feeds. Any tips?',                                                              intent: 'question_general' as InboxIntent, sent: 'question' as InboxSentiment, urg: 'medium' as InboxUrgency },
    { author: 'Aanya Verma',   msg: 'Loved your post on weaning! Bookmarked and sharing with my mom group ❤️',                                          intent: 'praise' as InboxIntent,           sent: 'positive' as InboxSentiment, urg: 'low' as InboxUrgency },
    { author: 'Ritu K.',       msg: 'My 6-week-old has a high fever and not feeding. What should I do?? Is this normal??',                              intent: 'question_medical' as InboxIntent, sent: 'question' as InboxSentiment, urg: 'high' as InboxUrgency },
    { author: 'Anonymous',     msg: 'CHECK MY PROFILE FOR FREE GIFTS!!! www.spam-link.com',                                                              intent: 'spam' as InboxIntent,             sent: 'spam' as InboxSentiment,     urg: 'low' as InboxUrgency },
    { author: 'Sneha M.',      msg: 'Your app crashed on me yesterday and I lost my growth tracking entries. Very frustrating.',                         intent: 'complaint' as InboxIntent,        sent: 'complaint' as InboxSentiment, urg: 'medium' as InboxUrgency },
  ];
  const pick = samples[Math.floor(Math.random() * samples.length)];

  const threadRef = doc(collection(db, THREADS_COL));
  await setDoc(threadRef, {
    channel,
    status: 'unread' as InboxStatus,
    sentiment: pick.sent,
    intent: pick.intent,
    urgency: pick.urg,
    authorName: pick.author,
    authorExternalId: `synthetic_${threadRef.id}`,
    preview: pick.msg.slice(0, 120),
    unreadCount: 1,
    lastMessageAt: serverTimestamp(),
    draftId: null,
    isSynthetic: true,
    createdAt: serverTimestamp(),
  });
  await addDoc(collection(db, THREADS_COL, threadRef.id, 'messages'), {
    direction: 'inbound',
    text: pick.msg,
    attachments: [],
    sentAt: serverTimestamp(),
    sentBy: null,
    fromSuggestion: false,
    externalId: `synthetic_${Date.now()}`,
  });
  await logAdminAction(actor, 'marketing.inbox.archive', { docId: threadRef.id }, { synthetic: true });
  return threadRef.id;
}

export async function deleteThread(
  actor: { uid: string; email: string | null | undefined },
  threadId: string,
): Promise<void> {
  if (!db) throw new Error('Firestore not ready');
  // Delete subcollection first (Firestore doesn't cascade).
  const msgs = await getDocs(collection(db, THREADS_COL, threadId, 'messages'));
  const batch = writeBatch(db);
  msgs.forEach((m) => batch.delete(m.ref));
  batch.delete(doc(db, THREADS_COL, threadId));
  await batch.commit();
  await logAdminAction(actor, 'marketing.inbox.archive', { docId: threadId }, { deleted: true });
}

// ── AI helpers (Cloud Function callables) ──────────────────────────────────

export interface SuggestRepliesInput { threadId: string }
export interface SuggestRepliesResult {
  ok: true;
  suggestions: { tone: string; text: string }[];
}
export interface SuggestRepliesError { ok: false; code: string; message: string }

export async function suggestInboxReplies(
  input: SuggestRepliesInput,
): Promise<SuggestRepliesResult | SuggestRepliesError> {
  if (!app) throw new Error('Firebase app not configured');
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions(app);
  const call = httpsCallable<SuggestRepliesInput, SuggestRepliesResult | SuggestRepliesError>(
    functions,
    'generateInboxReplies',
  );
  const result = await call(input);
  return result.data;
}

export interface ClassifyInput { threadId: string }
export interface ClassifyResult {
  ok: true;
  sentiment: InboxSentiment;
  intent: InboxIntent;
  urgency: InboxUrgency;
}
export interface ClassifyError { ok: false; code: string; message: string }

export async function classifyInboxThread(
  input: ClassifyInput,
): Promise<ClassifyResult | ClassifyError> {
  if (!app) throw new Error('Firebase app not configured');
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions(app);
  const call = httpsCallable<ClassifyInput, ClassifyResult | ClassifyError>(
    functions,
    'classifyInboxThread',
  );
  const result = await call(input);
  return result.data;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function tsToIso(ts: unknown): string {
  if (!ts) return '';
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  if (typeof (ts as any)?.toDate === 'function') {
    try { return (ts as any).toDate().toISOString(); } catch { return ''; }
  }
  if (typeof ts === 'string') return ts;
  return '';
}

function rowToThread(snap: { id: string; data: () => any }): InboxThread {
  const d = snap.data() as Record<string, any>;
  return {
    id: snap.id,
    channel: (d.channel ?? 'ig_dm') as InboxChannel,
    status: (d.status ?? 'unread') as InboxStatus,
    sentiment: (d.sentiment ?? 'neutral') as InboxSentiment,
    intent: (d.intent ?? 'other') as InboxIntent,
    urgency: (d.urgency ?? 'low') as InboxUrgency,
    authorName: typeof d.authorName === 'string' ? d.authorName : 'Unknown',
    authorExternalId: typeof d.authorExternalId === 'string' ? d.authorExternalId : '',
    preview: typeof d.preview === 'string' ? d.preview : '',
    unreadCount: typeof d.unreadCount === 'number' ? d.unreadCount : 0,
    lastMessageAt: tsToIso(d.lastMessageAt),
    draftId: typeof d.draftId === 'string' ? d.draftId : null,
    isSynthetic: d.isSynthetic === true,
    createdAt: tsToIso(d.createdAt),
  };
}

function rowToMessage(id: string, d: Record<string, any>, threadId: string): InboxMessage {
  return {
    id,
    threadId,
    direction: d.direction === 'outbound' ? 'outbound' : 'inbound',
    text: typeof d.text === 'string' ? d.text : '',
    attachments: Array.isArray(d.attachments) ? d.attachments : [],
    sentAt: tsToIso(d.sentAt),
    sentBy: typeof d.sentBy === 'string' ? d.sentBy : null,
    fromSuggestion: d.fromSuggestion === true,
    outboundStatus: typeof d.outboundStatus === 'string' ? (d.outboundStatus as OutboundStatus) : undefined,
    outboundError: typeof d.outboundError === 'string' ? d.outboundError : null,
    externalId: typeof d.externalId === 'string' ? d.externalId : undefined,
  };
}
