// Consolidated admin service.
//
// Every action the admin UI takes that mutates Firestore goes through this
// module so we get audit logging in one place. Reads stay free-form.
//
// Cross-references on rename — if you change a function name here, also
// search for callers in app/admin/* (the admin UI) before merging.

import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { logAdminAction } from './audit';
import { AdminRole } from '../lib/admin';
import { VACCINE_SCHEDULE } from '../data/vaccines';

type Actor = { uid: string; email: string | null | undefined };

// ─── Admin roles ─────────────────────────────────────────────────────────────

export interface AdminMember {
  uid: string;
  name: string;
  email: string;
  role: AdminRole;
}

export async function listAdminMembers(): Promise<AdminMember[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(query(collection(db, 'users'), where('adminRole', 'in', ['super', 'moderator', 'support', 'content'])));
    return snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        uid: d.id,
        name: data.name ?? data.motherName ?? 'Unnamed',
        email: data.email ?? '',
        role: data.adminRole as AdminRole,
      };
    });
  } catch (err) {
    console.warn('listAdminMembers failed:', err);
    return [];
  }
}

export async function setUserAdminRole(actor: Actor, targetUid: string, role: AdminRole | null): Promise<void> {
  if (!db) throw new Error('Firestore not configured');
  await setDoc(
    doc(db, 'users', targetUid),
    { adminRole: role ?? null, updatedAt: serverTimestamp() },
    { merge: true },
  );
  await logAdminAction(actor, 'user.adminRole.change', { uid: targetUid }, { role: role ?? 'none' });
}

// ─── Per-user 360 ────────────────────────────────────────────────────────────

export interface UserSnapshot {
  uid: string;
  profile: Record<string, any> | null;
  publicProfile: Record<string, any> | null;
  postCount: number;
  commentCount: number;
  reportsAgainst: number;
  blockedBy: number;
  conversationCount: number;
  unreadTickets: number;
  recentPosts: Array<{ id: string; text: string; createdAt: string; approved: boolean; hidden?: boolean }>;
  recentTickets: Array<{ id: string; subject: string; status: string; createdAt: string }>;
}

export async function getUserSnapshot(uid: string): Promise<UserSnapshot | null> {
  if (!db) return null;

  const [profileSnap, publicSnap] = await Promise.all([
    getDoc(doc(db, 'users', uid)).catch(() => null),
    getDoc(doc(db, 'publicProfiles', uid)).catch(() => null),
  ]);
  const profile = profileSnap?.exists() ? (profileSnap.data() as Record<string, any>) : null;
  const publicProfile = publicSnap?.exists() ? (publicSnap.data() as Record<string, any>) : null;
  if (!profile && !publicProfile) return null;

  // Count posts (both legacy + new collections)
  let postCount = 0;
  const recentPosts: UserSnapshot['recentPosts'] = [];
  for (const coll of ['communityPosts', 'community_posts'] as const) {
    try {
      const snap = await getDocs(query(collection(db, coll), where('authorUid', '==', uid), orderBy('createdAt', 'desc'), limit(20)));
      postCount += snap.size;
      snap.docs.forEach((d) => {
        const data = d.data() as any;
        const ts = data.createdAt;
        const iso = ts?.toDate ? ts.toDate().toISOString() : (typeof ts === 'string' ? ts : '');
        recentPosts.push({
          id: d.id,
          text: (data.text ?? '').slice(0, 240),
          createdAt: iso,
          approved: data.approved !== false,
          hidden: data.hidden === true,
        });
      });
    } catch {/* collection-or-query may not exist */}
  }
  recentPosts.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

  // Comments authored
  let commentCount = 0;
  try {
    const snap = await getDocs(query(collectionGroup(db, 'comments'), where('authorUid', '==', uid)));
    commentCount = snap.size;
  } catch {/* collection-group index may not be built — fine */}

  // Blocks against
  let blockedBy = 0;
  try {
    const snap = await getDocs(query(collection(db, 'blocks'), where('blockedUid', '==', uid)));
    blockedBy = snap.size;
  } catch {/* */}

  // Reports flagged on their posts
  let reportsAgainst = 0;
  try {
    for (const coll of ['communityPosts', 'community_posts'] as const) {
      const snap = await getDocs(query(collection(db, coll), where('authorUid', '==', uid)));
      snap.docs.forEach((d) => {
        const data = d.data() as any;
        if (Array.isArray(data.reports) && data.reports.length > 0) reportsAgainst++;
      });
    }
  } catch {/* */}

  // Conversations they participate in
  let conversationCount = 0;
  try {
    const snap = await getDocs(query(collection(db, 'conversations'), where('participants', 'array-contains', uid)));
    conversationCount = snap.size;
  } catch {/* */}

  // Their support tickets
  const recentTickets: UserSnapshot['recentTickets'] = [];
  let unreadTickets = 0;
  try {
    const snap = await getDocs(query(collection(db, 'supportTickets'), where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(10)));
    snap.docs.forEach((d) => {
      const data = d.data() as any;
      const ts = data.createdAt;
      const iso = ts?.toDate ? ts.toDate().toISOString() : '';
      if (data.status === 'open') unreadTickets++;
      recentTickets.push({
        id: d.id,
        subject: data.subject ?? '(no subject)',
        status: data.status ?? 'open',
        createdAt: iso,
      });
    });
  } catch {/* */}

  return {
    uid,
    profile,
    publicProfile,
    postCount,
    commentCount,
    reportsAgainst,
    blockedBy,
    conversationCount,
    unreadTickets,
    recentPosts: recentPosts.slice(0, 10),
    recentTickets,
  };
}

// ─── DSAR — full data export ─────────────────────────────────────────────────
//
// DPDP Act 2023 / GDPR-style: a user (or admin on their behalf) can request a
// portable JSON of every doc the platform has on them. We serialize the user
// doc + every owned/authored sub-record into one downloadable bundle. The
// admin clicks a button, gets a JSON file. Deeper privacy review can be done
// on the file offline.

export interface UserDataExport {
  exportedAt: string;
  uid: string;
  profile: any;
  publicProfile: any;
  posts: any[];
  comments: any[];
  conversations: any[];
  notifications: any[];
  moods: any[];
  savedAnswers: any[];
  chats: any[];
  follows: { from: any[]; to: any[] };
  blocks: any[];
  supportTickets: any[];
  testerFeedback: any[];
}

export async function exportUserData(actor: Actor, uid: string): Promise<UserDataExport> {
  if (!db) throw new Error('Firestore not configured');

  const [
    profileSnap,
    publicSnap,
    posts1,
    posts2,
    moods,
    saved,
    chats,
    notifs,
    convs,
    followsFrom,
    followsTo,
    blocks,
    tickets,
    feedback,
    cgComments,
  ] = await Promise.all([
    getDoc(doc(db, 'users', uid)).catch(() => null),
    getDoc(doc(db, 'publicProfiles', uid)).catch(() => null),
    getDocs(query(collection(db, 'communityPosts'), where('authorUid', '==', uid))).catch(() => null),
    getDocs(query(collection(db, 'community_posts'), where('authorUid', '==', uid))).catch(() => null),
    getDocs(collection(db, 'moods', uid, 'entries')).catch(() => null),
    getDocs(collection(db, 'saved_answers', uid, 'items')).catch(() => null),
    getDocs(collection(db, 'chats', uid, 'threads')).catch(() => null),
    getDocs(collection(db, 'notifications', uid, 'items')).catch(() => null),
    getDocs(query(collection(db, 'conversations'), where('participants', 'array-contains', uid))).catch(() => null),
    getDocs(query(collection(db, 'follows'), where('fromUid', '==', uid))).catch(() => null),
    getDocs(query(collection(db, 'follows'), where('toUid', '==', uid))).catch(() => null),
    getDocs(query(collection(db, 'blocks'), where('blockerUid', '==', uid))).catch(() => null),
    getDocs(query(collection(db, 'supportTickets'), where('uid', '==', uid))).catch(() => null),
    getDocs(query(collection(db, 'testerFeedback'), where('uid', '==', uid))).catch(() => null),
    getDocs(query(collectionGroup(db, 'comments'), where('authorUid', '==', uid))).catch(() => null),
  ]);

  const dump = (snap: any) => snap?.docs?.map((d: any) => ({ id: d.id, ...d.data() })) ?? [];

  const out: UserDataExport = {
    exportedAt: new Date().toISOString(),
    uid,
    profile: profileSnap?.exists() ? profileSnap.data() : null,
    publicProfile: publicSnap?.exists() ? publicSnap.data() : null,
    posts: [...dump(posts1), ...dump(posts2)],
    comments: dump(cgComments),
    conversations: dump(convs),
    notifications: dump(notifs),
    moods: dump(moods),
    savedAnswers: dump(saved),
    chats: dump(chats),
    follows: { from: dump(followsFrom), to: dump(followsTo) },
    blocks: dump(blocks),
    supportTickets: dump(tickets),
    testerFeedback: dump(feedback),
  };

  await logAdminAction(actor, 'user.export', { uid }, {
    posts: out.posts.length,
    comments: out.comments.length,
    tickets: out.supportTickets.length,
  });
  return out;
}

// ─── Support tickets ─────────────────────────────────────────────────────────

export interface SupportTicket {
  id: string;
  uid: string | null;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  appVersion?: string;
  platform?: string;
  createdAt: string;
  resolvedAt?: string;
  replies?: Array<{ at: string; byUid: string; byEmail: string; text: string; sentPush: boolean }>;
}

export async function listSupportTickets(opts?: { status?: SupportTicket['status'] | 'all' }): Promise<SupportTicket[]> {
  if (!db) return [];
  try {
    const base = collection(db, 'supportTickets');
    const q = opts?.status && opts.status !== 'all'
      ? query(base, where('status', '==', opts.status), orderBy('createdAt', 'desc'))
      : query(base, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => normaliseTicket(d.id, d.data() as any));
  } catch (err) {
    console.warn('listSupportTickets failed:', err);
    return [];
  }
}

function normaliseTicket(id: string, data: any): SupportTicket {
  const ts = data.createdAt;
  const createdIso = ts?.toDate ? ts.toDate().toISOString() : (typeof ts === 'string' ? ts : '');
  const rs = data.resolvedAt;
  const resolvedIso = rs?.toDate ? rs.toDate().toISOString() : (typeof rs === 'string' ? rs : undefined);
  const replies = Array.isArray(data.replies) ? data.replies.map((r: any) => ({
    at: r.at?.toDate ? r.at.toDate().toISOString() : (r.at ?? ''),
    byUid: r.byUid ?? '',
    byEmail: r.byEmail ?? '',
    text: r.text ?? '',
    sentPush: !!r.sentPush,
  })) : [];
  return {
    id,
    uid: data.uid ?? null,
    name: data.name ?? 'Unknown',
    email: data.email ?? '',
    subject: data.subject ?? '(no subject)',
    message: data.message ?? '',
    status: data.status ?? 'open',
    appVersion: data.appVersion,
    platform: data.platform,
    createdAt: createdIso,
    resolvedAt: resolvedIso,
    replies,
  };
}

export async function setTicketStatus(actor: Actor, ticketId: string, status: SupportTicket['status']): Promise<void> {
  if (!db) throw new Error('Firestore not configured');
  const patch: Record<string, any> = { status };
  if (status === 'resolved' || status === 'closed') patch.resolvedAt = serverTimestamp();
  await updateDoc(doc(db, 'supportTickets', ticketId), patch);
  await logAdminAction(actor, status === 'open' ? 'support.reopen' : 'support.close', { docId: ticketId }, { status });
}

/**
 * Reply to a ticket. Appends a reply record to the ticket doc AND, if the
 * submitter has a uid, queues a personal push so they're notified.
 */
export async function replyToTicket(
  actor: Actor,
  ticketId: string,
  text: string,
  opts: { sendPush: boolean },
): Promise<void> {
  if (!db) throw new Error('Firestore not configured');
  const ref = doc(db, 'supportTickets', ticketId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Ticket not found');
  const ticket = snap.data() as any;

  const reply = {
    at: new Date().toISOString(),
    byUid: actor.uid,
    byEmail: (actor.email ?? '').toLowerCase(),
    text,
    sentPush: false,
  };

  let sentPush = false;
  if (opts.sendPush && ticket.uid) {
    try {
      await addDoc(collection(db, 'push_queue'), {
        kind: 'personal',
        toUid: ticket.uid,
        fromUid: actor.uid,
        title: 'MaaMitra support replied',
        body: text.length > 160 ? text.slice(0, 157) + '...' : text,
        data: { type: 'support_reply', ticketId },
        notifType: 'message',
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      sentPush = true;
      reply.sentPush = true;
    } catch (err) {
      console.warn('replyToTicket push failed:', err);
    }
  }

  await updateDoc(ref, {
    replies: [...(ticket.replies ?? []), reply],
    status: ticket.status === 'open' ? 'in_progress' : ticket.status,
    lastReplyAt: serverTimestamp(),
  });

  await logAdminAction(actor, 'support.reply', { uid: ticket.uid ?? '', docId: ticketId }, { sentPush });
}

// ─── Personal push (admin DM) ────────────────────────────────────────────────

export async function sendPersonalPushFromAdmin(
  actor: Actor,
  targetUid: string,
  payload: { title: string; body: string; data?: Record<string, string> },
): Promise<void> {
  if (!db) throw new Error('Firestore not configured');
  await addDoc(collection(db, 'push_queue'), {
    kind: 'personal',
    toUid: targetUid,
    fromUid: actor.uid,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    notifType: 'message',
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  await logAdminAction(actor, 'push.personal', { uid: targetUid }, { title: payload.title });
}

/**
 * Send the same personal push to a hand-picked list of user uids. Each
 * recipient gets their own push_queue doc — that's how delivery counts /
 * dead-token cleanup track per user. The audit log captures the whole
 * action as one entry with a count, not N entries.
 *
 * Returns { sent, failed } so the UI can surface partial failures without
 * blocking the rest of the list.
 */
export async function sendPushToUidList(
  actor: Actor,
  uids: string[],
  payload: { title: string; body: string; data?: Record<string, string> },
): Promise<{ sent: number; failed: number }> {
  if (!db) throw new Error('Firestore not configured');
  let sent = 0;
  let failed = 0;
  for (const uid of uids) {
    try {
      await addDoc(collection(db, 'push_queue'), {
        kind: 'personal',
        toUid: uid,
        fromUid: actor.uid,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        notifType: 'message',
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      sent++;
    } catch {
      failed++;
    }
  }
  await logAdminAction(actor, 'push.personal', { label: 'custom-list' }, {
    title: payload.title,
    count: uids.length,
    sent,
    failed,
  });
  return { sent, failed };
}

/**
 * Schedule a future push to a hand-picked list of users. Lives in
 * `scheduled_pushes` with kind='custom' until the cron promotes it. At
 * fire time, the cron iterates targetUids and creates one personal
 * push_queue doc per recipient.
 */
export async function scheduleCustomListPush(
  actor: Actor,
  uids: string[],
  payload: {
    title: string;
    body: string;
    pushType?: string;
    data?: Record<string, string>;
    scheduledFor: Date;
  },
): Promise<string> {
  if (!db) throw new Error('Firestore not configured');
  if (uids.length === 0) throw new Error('No recipients selected.');
  if (uids.length > 1000) throw new Error('Custom list capped at 1000 recipients.');
  const ref = await addDoc(collection(db, 'scheduled_pushes'), {
    kind: 'custom',
    targetUids: uids,
    title: payload.title,
    body: payload.body,
    pushType: payload.pushType ?? 'info',
    data: payload.data ?? {},
    scheduledFor: Timestamp.fromDate(payload.scheduledFor),
    status: 'scheduled',
    createdByUid: actor.uid,
    createdAt: serverTimestamp(),
  });
  await logAdminAction(actor, 'push.schedule', { docId: ref.id }, {
    kind: 'custom',
    count: uids.length,
    scheduledFor: payload.scheduledFor.toISOString(),
  });
  return ref.id;
}

// ─── Push outbox (delivery log) ──────────────────────────────────────────────

export interface PushQueueEntry {
  id: string;
  kind: 'personal' | 'broadcast';
  audience?: string;
  toUid?: string;
  fromUid?: string;
  title: string;
  body: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped' | 'scheduled';
  successCount?: number;
  failureCount?: number;
  scheduledFor?: string;
  createdAt: string;
  sentAt?: string;
}

export async function listPushOutbox(limitN = 50): Promise<PushQueueEntry[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(query(collection(db, 'push_queue'), orderBy('createdAt', 'desc'), limit(limitN)));
    return snap.docs.map((d) => {
      const data = d.data() as any;
      const ts = data.createdAt;
      const iso = ts?.toDate ? ts.toDate().toISOString() : '';
      const sentTs = data.sentAt;
      const sentIso = sentTs?.toDate ? sentTs.toDate().toISOString() : undefined;
      const sched = data.scheduledFor;
      const schedIso = sched?.toDate ? sched.toDate().toISOString() : (typeof sched === 'string' ? sched : undefined);
      return {
        id: d.id,
        kind: data.kind ?? 'broadcast',
        audience: data.audience,
        toUid: data.toUid,
        fromUid: data.fromUid,
        title: data.title ?? '',
        body: data.body ?? '',
        status: data.status ?? 'pending',
        successCount: data.successCount,
        failureCount: data.failureCount,
        scheduledFor: schedIso,
        createdAt: iso,
        sentAt: sentIso,
      };
    });
  } catch (err) {
    console.warn('listPushOutbox failed:', err);
    return [];
  }
}

// ─── Scheduled pushes ────────────────────────────────────────────────────────
//
// Schedule shape: same as a push_queue doc but lives in `scheduled_pushes`
// until a Cloud Scheduler-driven function (`processScheduledPushes`)
// promotes due entries into push_queue. Keeping the two collections separate
// keeps the dispatcher simple — it only reacts to push_queue writes.

export async function scheduleBroadcastPush(
  actor: Actor,
  payload: {
    title: string;
    body: string;
    audience: 'all' | 'pregnant' | 'newborn' | 'toddler';
    pushType?: string;
    data?: Record<string, string>;
    scheduledFor: Date;
  },
): Promise<string> {
  if (!db) throw new Error('Firestore not configured');
  const ref = await addDoc(collection(db, 'scheduled_pushes'), {
    kind: 'broadcast',
    audience: payload.audience,
    title: payload.title,
    body: payload.body,
    pushType: payload.pushType ?? 'info',
    data: payload.data ?? {},
    scheduledFor: Timestamp.fromDate(payload.scheduledFor),
    status: 'scheduled',
    createdByUid: actor.uid,
    createdAt: serverTimestamp(),
  });
  await logAdminAction(actor, 'push.schedule', { docId: ref.id }, {
    audience: payload.audience,
    scheduledFor: payload.scheduledFor.toISOString(),
  });
  return ref.id;
}

export interface ScheduledPushEntry {
  id: string;
  kind: 'broadcast' | 'custom';
  /** For broadcast — the audience filter. For custom, undefined. */
  audience?: string;
  /** For custom — the explicit recipient list. */
  targetUids?: string[];
  title: string;
  body: string;
  scheduledFor: string;
  status: 'scheduled' | 'sent' | 'cancelled' | 'failed';
  createdAt: string;
}

export async function listScheduledPushes(): Promise<ScheduledPushEntry[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(query(collection(db, 'scheduled_pushes'), orderBy('scheduledFor', 'asc')));
    return snap.docs.map((d) => {
      const data = d.data() as any;
      const sf = data.scheduledFor?.toDate ? data.scheduledFor.toDate().toISOString() : (data.scheduledFor ?? '');
      const ca = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : '';
      return {
        id: d.id,
        kind: (data.kind === 'custom' ? 'custom' : 'broadcast') as 'broadcast' | 'custom',
        audience: data.audience,
        targetUids: Array.isArray(data.targetUids) ? data.targetUids : undefined,
        title: data.title ?? '',
        body: data.body ?? '',
        scheduledFor: sf,
        status: data.status ?? 'scheduled',
        createdAt: ca,
      };
    });
  } catch (err) {
    console.warn('listScheduledPushes failed:', err);
    return [];
  }
}

export async function cancelScheduledPush(actor: Actor, scheduledId: string): Promise<void> {
  if (!db) throw new Error('Firestore not configured');
  await updateDoc(doc(db, 'scheduled_pushes', scheduledId), { status: 'cancelled', cancelledAt: serverTimestamp() });
  await logAdminAction(actor, 'push.cancel', { docId: scheduledId });
}

// ─── In-app banner ───────────────────────────────────────────────────────────
// Persisted at app_settings/config.banner. Clients read on mount; users can
// dismiss locally. Empty banner.title = banner is off.

export interface AppBanner {
  title: string;
  body: string;
  cta?: { label: string; href: string };
  tone?: 'info' | 'warn' | 'celebrate';
  publishedAt: string;
  expiresAt?: string;
}

export async function publishBanner(actor: Actor, banner: AppBanner): Promise<void> {
  if (!db) throw new Error('Firestore not configured');
  await setDoc(
    doc(db, 'app_settings', 'config'),
    { banner, updatedAt: serverTimestamp() },
    { merge: true },
  );
  await logAdminAction(actor, 'banner.publish', { label: banner.title });
}

export async function clearBanner(actor: Actor): Promise<void> {
  if (!db) throw new Error('Firestore not configured');
  await setDoc(
    doc(db, 'app_settings', 'config'),
    { banner: null, updatedAt: serverTimestamp() },
    { merge: true },
  );
  await logAdminAction(actor, 'banner.clear', {});
}

// ─── Vaccine overdue ops ─────────────────────────────────────────────────────
//
// Walks every user, every kid, every IAP-scheduled vaccine and flags
// dose-by-dose what's overdue (>= 7 days past the schedule date and not
// already in completedVaccines). Returns a flat list the admin can scan.

export interface OverdueVaccine {
  uid: string;
  userName: string;
  email: string;
  phone?: string;
  kidId: string;
  kidName: string;
  vaccineId: string;
  vaccineName: string;
  dueDate: string;     // ISO yyyy-mm-dd
  daysOverdue: number;
  ageLabel: string;
}

export async function getOverdueVaccines(thresholdDays = 7): Promise<OverdueVaccine[]> {
  if (!db) return [];
  const out: OverdueVaccine[] = [];
  const now = Date.now();
  const threshold = thresholdDays * 86400000;

  try {
    const snap = await getDocs(collection(db, 'users'));
    for (const d of snap.docs) {
      const data = d.data() as any;
      const kids = Array.isArray(data.kids) ? data.kids : [];
      const completed: Record<string, any> = data.completedVaccines ?? {};
      const userName = data.name ?? data.motherName ?? 'Parent';
      for (const kid of kids) {
        if (!kid?.dob) continue;
        const dobMs = new Date(kid.dob).getTime();
        if (isNaN(dobMs)) continue;
        const kidId = kid.id ?? kid.kidId ?? '';
        const kidName = kid.name ?? 'Baby';
        const completedForKid: Record<string, any> = completed[kidId] ?? completed;
        for (const vac of VACCINE_SCHEDULE) {
          const dueMs = dobMs + (vac.daysFromBirth ?? 0) * 86400000;
          if (now - dueMs < threshold) continue; // not overdue yet
          const isDone = !!(completedForKid?.[vac.id]);
          if (isDone) continue;
          const daysOverdue = Math.floor((now - dueMs) / 86400000);
          out.push({
            uid: d.id,
            userName,
            email: data.email ?? '',
            phone: data.phone,
            kidId,
            kidName,
            vaccineId: vac.id,
            vaccineName: vac.name,
            dueDate: new Date(dueMs).toISOString().slice(0, 10),
            ageLabel: vac.ageLabel,
            daysOverdue,
          });
        }
      }
    }
  } catch (err) {
    console.warn('getOverdueVaccines failed:', err);
  }

  out.sort((a, b) => b.daysOverdue - a.daysOverdue);
  return out;
}

export async function sendVaccineReminderPush(
  actor: Actor,
  targets: Array<{ uid: string; kidName: string; vaccineName: string; daysOverdue: number }>,
): Promise<{ sent: number; failed: number }> {
  if (!db) throw new Error('Firestore not configured');
  let sent = 0;
  let failed = 0;
  for (const t of targets) {
    try {
      await addDoc(collection(db, 'push_queue'), {
        kind: 'personal',
        toUid: t.uid,
        fromUid: actor.uid,
        title: `Vaccine reminder for ${t.kidName}`,
        body: `${t.vaccineName} is ${t.daysOverdue} day${t.daysOverdue === 1 ? '' : 's'} overdue. Tap to mark it complete.`,
        data: { type: 'vaccine_reminder' },
        notifType: 'message',
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      sent++;
    } catch {
      failed++;
    }
  }
  await logAdminAction(actor, 'push.personal', { label: 'vaccine.reminder.bulk' }, { count: targets.length, sent, failed });
  return { sent, failed };
}

// ─── Comments admin ──────────────────────────────────────────────────────────

export interface AdminComment {
  id: string;
  postId: string;
  postCollection: 'communityPosts' | 'community_posts';
  authorUid: string;
  author: string;
  text: string;
  createdAt: string;
}

export async function listRecentComments(limitN = 100): Promise<AdminComment[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(query(collectionGroup(db, 'comments'), orderBy('createdAt', 'desc'), limit(limitN)));
    return snap.docs.map((d) => {
      const data = d.data() as any;
      const ts = data.createdAt;
      const iso = ts?.toDate ? ts.toDate().toISOString() : '';
      // path: communityPosts/{postId}/comments/{commentId}
      const segs = d.ref.path.split('/');
      const postCollection = (segs[0] as any) ?? 'communityPosts';
      const postId = segs[1] ?? '';
      return {
        id: d.id,
        postId,
        postCollection,
        authorUid: data.authorUid ?? '',
        author: data.author ?? data.authorName ?? 'Unknown',
        text: data.text ?? '',
        createdAt: iso,
      };
    });
  } catch (err) {
    console.warn('listRecentComments failed:', err);
    return [];
  }
}

export async function deleteComment(
  actor: Actor,
  commentId: string,
  postId: string,
  postCollection: 'communityPosts' | 'community_posts' = 'communityPosts',
): Promise<void> {
  if (!db) throw new Error('Firestore not configured');
  await deleteDoc(doc(db, postCollection, postId, 'comments', commentId));
  await logAdminAction(actor, 'comment.delete', { docId: commentId }, { postId });
}

// ─── Bulk post moderation ────────────────────────────────────────────────────

export async function bulkApprovePosts(actor: Actor, ids: Array<{ id: string; collection: 'communityPosts' | 'community_posts' }>): Promise<void> {
  if (!db) return;
  await Promise.all(ids.map(async ({ id, collection: c }) => {
    try {
      await updateDoc(doc(db!, c, id), { approved: true, hidden: false });
      await logAdminAction(actor, 'post.approve', { docId: id });
    } catch (err) {
      console.warn(`bulkApprovePosts ${c}/${id}:`, err);
    }
  }));
}

export async function bulkHidePosts(actor: Actor, ids: Array<{ id: string; collection: 'communityPosts' | 'community_posts' }>, reason = 'Bulk moderation'): Promise<void> {
  if (!db) return;
  await Promise.all(ids.map(async ({ id, collection: c }) => {
    try {
      await updateDoc(doc(db!, c, id), {
        hidden: true,
        hiddenAt: serverTimestamp(),
        hiddenReason: reason,
        hiddenBy: actor.uid,
      });
      await logAdminAction(actor, 'post.hide', { docId: id }, { reason });
    } catch (err) {
      console.warn(`bulkHidePosts ${c}/${id}:`, err);
    }
  }));
}

// ─── Analytics extensions: funnel + retention ────────────────────────────────

export interface FunnelStep {
  key: string;
  label: string;
  users: number;
  pct: number;
}

export interface RetentionCohort {
  cohort: string;       // 'YYYY-MM-DD' (week start)
  size: number;
  d1: number;
  d7: number;
  d30: number;
}

export interface FunnelAndRetention {
  funnel: FunnelStep[];
  retention: RetentionCohort[];
}

function isoWeekStart(ms: number): string {
  const d = new Date(ms);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function asMillis(v: any): number | null {
  if (!v) return null;
  if (typeof v === 'string') { const t = Date.parse(v); return isNaN(t) ? null : t; }
  if (v instanceof Date) return v.getTime();
  if (typeof v?.toDate === 'function') return v.toDate().getTime();
  if (v?.seconds) return v.seconds * 1000;
  return null;
}

export async function getFunnelAndRetention(): Promise<FunnelAndRetention> {
  if (!db) return { funnel: [], retention: [] };
  const snap = await getDocs(collection(db, 'users'));
  const users = snap.docs.map((d) => ({ id: d.id, data: d.data() as any }));
  const total = users.length;

  let signedUp = 0;
  let onboarded = 0;
  let added1Kid = 0;
  let usedAnyTracker = 0;
  let firstPost = 0;
  let returnedD7 = 0;

  // Posts by author for first-post check
  const authorPosted = new Set<string>();
  try {
    for (const coll of ['communityPosts', 'community_posts'] as const) {
      const ps = await getDocs(collection(db, coll));
      ps.docs.forEach((d) => {
        const a = (d.data() as any).authorUid;
        if (a) authorPosted.add(a);
      });
    }
  } catch {/* */}

  const cohortBuckets = new Map<string, { size: number; d1: number; d7: number; d30: number }>();
  const now = Date.now();

  for (const { id, data } of users) {
    signedUp++;
    if (data.onboardingComplete === true) onboarded++;
    if (Array.isArray(data.kids) && data.kids.length > 0) added1Kid++;
    const usedTracker =
      (data.completedVaccines && Object.keys(data.completedVaccines).length > 0) ||
      (data.teethTracking && Object.keys(data.teethTracking).length > 0) ||
      (data.foodTracking && Object.keys(data.foodTracking).length > 0) ||
      (data.growthTracking && Object.keys(data.growthTracking).length > 0) ||
      (data.healthTracking && Object.keys(data.healthTracking).length > 0);
    if (usedTracker) usedAnyTracker++;
    if (authorPosted.has(id)) firstPost++;

    const created = asMillis(data.createdAt);
    const updated = asMillis(data.updatedAt);
    if (created !== null) {
      const cohort = isoWeekStart(created);
      const bucket = cohortBuckets.get(cohort) ?? { size: 0, d1: 0, d7: 0, d30: 0 };
      bucket.size++;
      if (updated !== null) {
        const ageDays = (updated - created) / 86400000;
        if (ageDays >= 1) bucket.d1++;
        if (ageDays >= 7) bucket.d7++;
        if (ageDays >= 30) bucket.d30++;
        if (now - created >= 7 * 86400000 && ageDays >= 7) returnedD7++;
      }
      cohortBuckets.set(cohort, bucket);
    }
  }

  const base = Math.max(1, total);
  const funnel: FunnelStep[] = [
    { key: 'signup',     label: 'Signed up',         users: signedUp,       pct: Math.round((signedUp / base) * 100) },
    { key: 'onboarded',  label: 'Completed onboarding', users: onboarded,    pct: Math.round((onboarded / base) * 100) },
    { key: 'kid',        label: 'Added a child',     users: added1Kid,      pct: Math.round((added1Kid / base) * 100) },
    { key: 'tracker',    label: 'Used any tracker',  users: usedAnyTracker, pct: Math.round((usedAnyTracker / base) * 100) },
    { key: 'post',       label: 'Posted in community', users: firstPost,    pct: Math.round((firstPost / base) * 100) },
    { key: 'd7',         label: 'Returned after 7d', users: returnedD7,     pct: Math.round((returnedD7 / base) * 100) },
  ];

  const retention: RetentionCohort[] = Array.from(cohortBuckets.entries())
    .map(([cohort, b]) => ({ cohort, ...b }))
    .sort((a, b) => (a.cohort < b.cohort ? 1 : -1))
    .slice(0, 8);

  return { funnel, retention };
}

// ─── Chat usage analytics ────────────────────────────────────────────────────
//
// Walks `chats/{uid}/threads/{threadId}` via collectionGroup so we can see
// who's actually using the AI chat and how heavily. The "intensity" metric
// (messages per day in the last 7 days) is the abuse signal — if a single
// uid spikes well above the rest, we throttle them.
//
// Cost note: this reads every thread doc. For a few thousand threads this
// is fine; once we cross ~50k we should denormalise per-user counters into
// users/{uid}.chatStats and read those instead.

export interface ChatUsageRow {
  uid: string;
  name: string;
  email: string;
  /** Number of separate conversation threads the user has started. */
  threadCount: number;
  /** Total messages across all threads (user + assistant + system). */
  messageCount: number;
  /** User-authored messages only — i.e. how much they're prompting. */
  userMessageCount: number;
  /** Messages in the last 7 days (any role). */
  messagesLast7d: number;
  /** Approximate messages per active day (last 7d / unique-active-days). */
  intensity: number;
  lastActivity: string | null;
  firstActivity: string | null;
}

export interface ChatUsageReport {
  totals: {
    chatUsers: number;
    totalThreads: number;
    totalMessages: number;
    activeLast7d: number;
  };
  rows: ChatUsageRow[];
}

function asMillisAdmin(v: any): number | null {
  if (!v) return null;
  if (typeof v === 'string') { const t = Date.parse(v); return isNaN(t) ? null : t; }
  if (v instanceof Date) return v.getTime();
  if (typeof v?.toDate === 'function') return v.toDate().getTime();
  if (v?.seconds) return v.seconds * 1000;
  return null;
}

export async function getChatUsageReport(): Promise<ChatUsageReport> {
  if (!db) return { totals: { chatUsers: 0, totalThreads: 0, totalMessages: 0, activeLast7d: 0 }, rows: [] };

  // Index uid → { name, email } from users sweep.
  const usersSnap = await getDocs(collection(db, 'users'));
  const profile = new Map<string, { name: string; email: string }>();
  usersSnap.docs.forEach((d) => {
    const data = d.data() as any;
    profile.set(d.id, {
      name: data.name ?? data.motherName ?? 'Unnamed',
      email: data.email ?? '',
    });
  });

  // Aggregate per-user.
  const byUid = new Map<string, ChatUsageRow>();
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 86400000;
  let totalThreads = 0;
  let totalMessages = 0;
  let activeUidsLast7d = new Set<string>();

  try {
    // Path: chats/{uid}/threads/{threadId}
    const threadsSnap = await getDocs(collectionGroup(db, 'threads'));
    threadsSnap.docs.forEach((d) => {
      const segs = d.ref.path.split('/');
      // segs[0] === 'chats', segs[1] === uid, segs[2] === 'threads', segs[3] === threadId
      if (segs[0] !== 'chats' || segs[2] !== 'threads') return;
      const uid = segs[1];
      const data = d.data() as any;
      const messages: any[] = Array.isArray(data.messages) ? data.messages : [];
      const lastMsAtMs = asMillisAdmin(data.lastMessageAt);
      const createdMs = asMillisAdmin(data.createdAt);

      const row = byUid.get(uid) ?? {
        uid,
        name: profile.get(uid)?.name ?? 'Unknown',
        email: profile.get(uid)?.email ?? '',
        threadCount: 0,
        messageCount: 0,
        userMessageCount: 0,
        messagesLast7d: 0,
        intensity: 0,
        lastActivity: null,
        firstActivity: null,
      };

      row.threadCount += 1;
      row.messageCount += messages.length;
      const activeDays = new Set<string>();
      for (const msg of messages) {
        const role = msg.role ?? msg.from ?? '';
        if (role === 'user') row.userMessageCount += 1;
        const t = asMillisAdmin(msg.timestamp);
        if (t === null) continue;
        if (t >= sevenDaysAgo) {
          row.messagesLast7d += 1;
          activeDays.add(new Date(t).toISOString().slice(0, 10));
          activeUidsLast7d.add(uid);
        }
      }
      // Intensity = msgs in window / # active days in window. Caps the
      // skew when one heavy day inflates the per-week rate.
      if (activeDays.size > 0) {
        const candidate = row.messagesLast7d / activeDays.size;
        if (candidate > row.intensity) row.intensity = candidate;
      }

      if (lastMsAtMs !== null) {
        const iso = new Date(lastMsAtMs).toISOString();
        if (!row.lastActivity || iso > row.lastActivity) row.lastActivity = iso;
      }
      if (createdMs !== null) {
        const iso = new Date(createdMs).toISOString();
        if (!row.firstActivity || iso < row.firstActivity) row.firstActivity = iso;
      }

      byUid.set(uid, row);
      totalThreads += 1;
      totalMessages += messages.length;
    });
  } catch (err) {
    console.warn('getChatUsageReport collectionGroup failed:', err);
  }

  const rows = Array.from(byUid.values()).sort((a, b) => b.messageCount - a.messageCount);
  return {
    totals: {
      chatUsers: rows.length,
      totalThreads,
      totalMessages,
      activeLast7d: activeUidsLast7d.size,
    },
    rows,
  };
}

// ─── Activity feed (live) ────────────────────────────────────────────────────
//
// Convenience subscription that surfaces the latest signups, posts, and
// audit log writes as a single feed for the dashboard. Returns an
// unsubscribe — caller is responsible for cleanup.

export interface ActivityItem {
  kind: 'signup' | 'post' | 'audit' | 'support';
  id: string;
  at: string;
  title: string;
  sub?: string;
  href?: string;
}

export function subscribeActivity(
  onChange: (items: ActivityItem[]) => void,
  limitN = 30,
): () => void {
  if (!db) return () => {};
  const items: Map<string, ActivityItem> = new Map();
  const emit = () => {
    onChange(Array.from(items.values()).sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, limitN));
  };

  const unsubs: Array<() => void> = [];

  // Recent signups via users.createdAt (best-effort; not all writers stamp it)
  unsubs.push(
    onSnapshot(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(15)), (snap) => {
      snap.docs.forEach((d) => {
        const data = d.data() as any;
        const ts = data.createdAt;
        const iso = ts?.toDate ? ts.toDate().toISOString() : (typeof ts === 'string' ? ts : '');
        if (!iso) return;
        items.set(`signup:${d.id}`, {
          kind: 'signup',
          id: d.id,
          at: iso,
          title: data.name ?? data.motherName ?? 'New signup',
          sub: data.email ?? '',
          href: `/admin/users/${d.id}`,
        });
      });
      emit();
    }, () => {/* permissions / index errors — silent */}),
  );

  unsubs.push(
    onSnapshot(query(collection(db, 'communityPosts'), orderBy('createdAt', 'desc'), limit(15)), (snap) => {
      snap.docs.forEach((d) => {
        const data = d.data() as any;
        const ts = data.createdAt;
        const iso = ts?.toDate ? ts.toDate().toISOString() : '';
        if (!iso) return;
        items.set(`post:${d.id}`, {
          kind: 'post',
          id: d.id,
          at: iso,
          title: (data.text ?? '').slice(0, 80) || 'New post',
          sub: data.author ?? data.authorName ?? '',
          href: `/admin/community`,
        });
      });
      emit();
    }, () => {/* */}),
  );

  unsubs.push(
    onSnapshot(query(collection(db, 'admin_audit'), orderBy('createdAt', 'desc'), limit(15)), (snap) => {
      snap.docs.forEach((d) => {
        const data = d.data() as any;
        const ts = data.createdAt;
        const iso = ts?.toDate ? ts.toDate().toISOString() : '';
        if (!iso) return;
        items.set(`audit:${d.id}`, {
          kind: 'audit',
          id: d.id,
          at: iso,
          title: data.action ?? 'audit',
          sub: data.actorEmail ?? '',
        });
      });
      emit();
    }, () => {/* */}),
  );

  unsubs.push(
    onSnapshot(query(collection(db, 'supportTickets'), orderBy('createdAt', 'desc'), limit(10)), (snap) => {
      snap.docs.forEach((d) => {
        const data = d.data() as any;
        const ts = data.createdAt;
        const iso = ts?.toDate ? ts.toDate().toISOString() : '';
        if (!iso) return;
        items.set(`support:${d.id}`, {
          kind: 'support',
          id: d.id,
          at: iso,
          title: data.subject ?? 'Support ticket',
          sub: data.email ?? '',
          href: `/admin/support`,
        });
      });
      emit();
    }, () => {/* */}),
  );

  return () => unsubs.forEach((u) => { try { u(); } catch {} });
}
