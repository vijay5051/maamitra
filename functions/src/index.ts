/**
 * MaaMitra — push dispatcher Cloud Function
 *
 * Subscribes to `push_queue/{jobId}` writes. For each job:
 *   - personal: read target uid's fcmTokens + notifPrefs; skip if the
 *               matching topic pref is disabled, else send.
 *   - broadcast: query users in the right audience bucket via
 *                array-contains + pushEnabled + announcements pref,
 *                send in batches of 500.
 *
 * Cleans up dead tokens (FCM returns `messaging/registration-token-not-registered`)
 * by removing them from the user's array so future sends skip them.
 *
 * Deploy:
 *   firebase deploy --only functions:dispatchPush
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import textToSpeech from '@google-cloud/text-to-speech';

admin.initializeApp();

// Allow undefined fields in setDoc/update payloads to be silently dropped
// rather than throwing "Cannot use 'undefined' as a Firestore value".
// Without this, dispatchPush failed every time a recipient's
// skippedReason was undefined (the common "successfully sent" case),
// so admin notifications never recorded a delivery report.
admin.firestore().settings({ ignoreUndefinedProperties: true });

interface PushJob {
  kind: 'personal' | 'broadcast';
  toUid?: string;
  audience?: 'all' | 'pregnant' | 'newborn' | 'toddler';
  title: string;
  body: string;
  data?: Record<string, string>;
  fromUid?: string;
  pushType?: string;
  // For personal pushes, the in-app notification type (reaction / comment
  // / follow_request / follow_accepted / message) so we can look up the
  // matching per-topic pref on the recipient.
  notifType?: 'reaction' | 'comment' | 'follow_request' | 'follow_accepted' | 'message';
}

interface ResolvedRecipient {
  uid: string;
  email?: string;
  name?: string;
  tokens: string[];
  skippedReason?: string;
}

interface NotifPrefs {
  reactions: boolean;
  comments: boolean;
  dms: boolean;
  follows: boolean;
  announcements: boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  reactions: true,
  comments: true,
  dms: true,
  follows: true,
  announcements: true,
};

const MAX_BATCH = 500;

export const dispatchPush = functions.firestore
  .document('push_queue/{jobId}')
  .onCreate(async (snap, context) => {
    const job = snap.data() as PushJob;
    const jobId = context.params.jobId as string;
    const db = admin.firestore();
    const msg = admin.messaging();
    const reportRef = snap.ref.collection('delivery_report');

    try {
      const recipients = await resolveRecipients(db, job);
      const activeRecipients = recipients.filter((r) => r.tokens.length > 0);
      const skippedRecipients = recipients.filter((r) => r.tokens.length === 0);
      const tokenOwners = activeRecipients.flatMap((r) =>
        r.tokens.map((token) => ({
          token,
          uid: r.uid,
          email: r.email,
          name: r.name,
        })),
      );

      if (tokenOwners.length === 0) {
        if (skippedRecipients.length > 0) {
          await writeDeliveryReport(reportRef, skippedRecipients.map((r) => ({
            uid: r.uid,
            email: r.email,
            name: r.name,
            status: 'skipped',
            tokenCount: 0,
            successCount: 0,
            failureCount: 0,
            deadTokens: 0,
            skippedReason: r.skippedReason ?? 'no-tokens-or-prefs-off',
            errorCodes: {},
          })));
        }
        await snap.ref.update({
          status: 'skipped',
          reason: 'no-tokens-or-prefs-off',
          recipientCount: recipients.length,
          skippedCount: skippedRecipients.length,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
      }

      const deadTokens = new Set<string>();
      let successCount = 0;
      let failureCount = 0;
      const perRecipient = new Map<string, {
        uid: string;
        email?: string;
        name?: string;
        tokenCount: number;
        successCount: number;
        failureCount: number;
        deadTokens: number;
        skippedReason?: string;
        errorCodes: Record<string, number>;
      }>();

      for (const recipient of recipients) {
        perRecipient.set(recipient.uid, {
          uid: recipient.uid,
          email: recipient.email,
          name: recipient.name,
          tokenCount: recipient.tokens.length,
          successCount: 0,
          failureCount: 0,
          deadTokens: 0,
          skippedReason: recipient.tokens.length === 0 ? (recipient.skippedReason ?? 'no-tokens') : undefined,
          errorCodes: {},
        });
      }

      for (let i = 0; i < tokenOwners.length; i += MAX_BATCH) {
        const batchOwners = tokenOwners.slice(i, i + MAX_BATCH);
        const batch = batchOwners.map((b) => b.token);
        const response = await msg.sendEachForMulticast({
          tokens: batch,
          notification: {
            title: job.title,
            body: job.body,
          },
          data: sanitiseData(job.data),
          webpush: {
            fcmOptions: { link: job.data?.url || '/' },
            notification: {
              icon: '/icon-192.png',
              badge: '/icon-192.png',
            },
          },
        });
        successCount += response.successCount;
        failureCount += response.failureCount;
        response.responses.forEach((r, idx) => {
          const owner = batchOwners[idx];
          const rec = perRecipient.get(owner.uid);
          if (!rec) return;
          if (r.success) {
            rec.successCount += 1;
            return;
          }
          rec.failureCount += 1;
          const code = r.error?.code ?? '';
          if (code) rec.errorCodes[code] = (rec.errorCodes[code] ?? 0) + 1;
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            deadTokens.add(batch[idx]);
            rec.deadTokens += 1;
          }
        });
      }

      if (deadTokens.size > 0) {
        await pruneDeadTokens(db, [...deadTokens]);
      }

      const deliveryRows: Array<{
        uid: string;
        email?: string;
        name?: string;
        status: 'sent' | 'failed' | 'partial' | 'skipped';
        tokenCount: number;
        successCount: number;
        failureCount: number;
        deadTokens: number;
        skippedReason?: string;
        errorCodes: Record<string, number>;
      }> = [...perRecipient.values()].map((rec) => ({
        uid: rec.uid,
        email: rec.email,
        name: rec.name,
        status: rec.skippedReason
          ? 'skipped'
          : rec.failureCount > 0 && rec.successCount === 0
            ? 'failed'
            : rec.failureCount > 0
              ? 'partial'
              : 'sent',
        tokenCount: rec.tokenCount,
        successCount: rec.successCount,
        failureCount: rec.failureCount,
        deadTokens: rec.deadTokens,
        skippedReason: rec.skippedReason,
        errorCodes: rec.errorCodes,
      }));
      await writeDeliveryReport(reportRef, deliveryRows);

      await snap.ref.update({
        status: failureCount > 0 && successCount === 0 ? 'failed' : 'sent',
        successCount,
        failureCount,
        deadTokens: deadTokens.size,
        recipientCount: recipients.length,
        deliveredRecipientCount: deliveryRows.filter((r) => r.status === 'sent' || r.status === 'partial').length,
        failedRecipientCount: deliveryRows.filter((r) => r.status === 'failed').length,
        skippedRecipientCount: deliveryRows.filter((r) => r.status === 'skipped').length,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err: any) {
      console.error(`[dispatchPush ${jobId}] error:`, err);
      await snap.ref.update({
        status: 'failed',
        error: String(err?.message ?? err),
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

/**
 * Collect the token list that should receive this job, respecting
 * pushEnabled + per-topic prefs. Returns an empty array if the user has
 * opted out of the relevant category — that's a silent skip, not an
 * error.
 */
async function resolveTokens(
  db: admin.firestore.Firestore,
  job: PushJob,
): Promise<string[]> {
  const recipients = await resolveRecipients(db, job);
  return recipients.flatMap((r) => r.tokens);
}

async function resolveRecipients(
  db: admin.firestore.Firestore,
  job: PushJob,
): Promise<ResolvedRecipient[]> {
  if (job.kind === 'personal') {
    if (!job.toUid) return [];
    const doc = await db.doc(`users/${job.toUid}`).get();
    const data = doc.data();
    if (!data) return [];
    const email = typeof data.email === 'string' ? data.email : undefined;
    const name = typeof data.name === 'string'
      ? data.name
      : typeof data.motherName === 'string'
        ? data.motherName
        : undefined;
    if (data.pushEnabled === false) {
      return [{ uid: job.toUid, email, name, tokens: [], skippedReason: 'push-disabled' }];
    }

    // Per-topic gate. Map the in-app notification type to a pref key;
    // if the pref is false we return no tokens → silent skip.
    const prefs: NotifPrefs = { ...DEFAULT_PREFS, ...(data.notifPrefs || {}) };
    const prefKey = personalPrefKey(job.notifType);
    if (prefKey && !prefs[prefKey]) {
      return [{ uid: job.toUid, email, name, tokens: [], skippedReason: `pref-off:${prefKey}` }];
    }

    const tokens = data.fcmTokens;
    const cleaned = Array.isArray(tokens) ? tokens.filter((t: any) => typeof t === 'string' && t.length > 0) : [];
    return [{ uid: job.toUid, email, name, tokens: cleaned, skippedReason: cleaned.length === 0 ? 'no-tokens' : undefined }];
  }

  // ── broadcast ──────────────────────────────────────────────────
  // 'all' audience: everyone with push on AND announcements not
  // explicitly off. We use two queries per filter (can't combine
  // !=-equivalent with other filters easily) — simpler path: pull
  // pushEnabled users and filter announcements in-memory.
  const q: admin.firestore.Query =
    job.audience && job.audience !== 'all'
      ? db.collection('users')
          .where('pushEnabled', '==', true)
          .where('audienceBuckets', 'array-contains', job.audience)
      : db.collection('users').where('pushEnabled', '==', true);

  const snap = await q.get();
  const out: ResolvedRecipient[] = [];
  snap.forEach((doc) => {
    const d = doc.data();
    const email = typeof d.email === 'string' ? d.email : undefined;
    const name = typeof d.name === 'string'
      ? d.name
      : typeof d.motherName === 'string'
        ? d.motherName
        : undefined;
    // Respect announcements opt-out. Missing prefs default to true.
    const wantsAnnouncements = d.notifPrefs?.announcements !== false;
    if (!wantsAnnouncements) {
      out.push({
        uid: doc.id,
        email,
        name,
        tokens: [],
        skippedReason: 'pref-off:announcements',
      });
      return;
    }
    const arr = d.fcmTokens;
    const cleaned = Array.isArray(arr)
      ? arr.filter((t: any) => typeof t === 'string' && t.length > 0)
      : [];
    out.push({
      uid: doc.id,
      email,
      name,
      tokens: cleaned,
      skippedReason: cleaned.length === 0 ? 'no-tokens' : undefined,
    });
  });
  return out;
}

async function writeDeliveryReport(
  reportRef: admin.firestore.CollectionReference,
  rows: Array<{
    uid: string;
    email?: string;
    name?: string;
    status: 'sent' | 'failed' | 'partial' | 'skipped';
    tokenCount: number;
    successCount: number;
    failureCount: number;
    deadTokens: number;
    skippedReason?: string;
    errorCodes: Record<string, number>;
  }>,
): Promise<void> {
  if (rows.length === 0) return;
  const batch = admin.firestore().batch();
  for (const row of rows) {
    const ref = reportRef.doc(row.uid);
    batch.set(ref, {
      ...row,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();
}

/** Map a personal-push in-app type to its matching pref key. */
function personalPrefKey(
  type: PushJob['notifType'],
): keyof NotifPrefs | null {
  switch (type) {
    case 'reaction': return 'reactions';
    case 'comment': return 'comments';
    case 'message': return 'dms';
    case 'follow_request':
    case 'follow_accepted':
      return 'follows';
    default:
      // Missing type (older client) — don't gate. Better to deliver than
      // silently drop during rollout.
      return null;
  }
}

function sanitiseData(data: Record<string, any> | undefined): Record<string, string> | undefined {
  if (!data) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined) continue;
    out[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }
  return out;
}

// ─── adminDeleteUser ─────────────────────────────────────────────────────────
// Admin-gated callable that fully removes a user — both their Firebase Auth
// account AND their Firestore data. Necessary because the client-side
// `deleteUserData` only wipes Firestore; the Auth record (with any linked
// phone provider) lingers and blocks the freed phone number from being
// re-linked to a new account ("auth/credential-already-in-use").
//
// Caller must be authenticated AND admin (custom claim or email allowlist —
// kept in sync with firestore.rules → isAdmin()).

const ADMIN_EMAILS = new Set<string>([
  'admin@maamitra.app',
  'vijay@maamitra.app',
  'rocking.vsr@gmail.com',
  'demo@maamitra.app',
]);

async function isAdminTokenAsync(token: admin.auth.DecodedIdToken | undefined): Promise<boolean> {
  if (!token) return false;
  if (token.admin === true) return true;
  if (token.email_verified === true && token.email && ADMIN_EMAILS.has(token.email.toLowerCase())) {
    return true;
  }
  // Fallback: stored role on the user doc (matches firestore.rules helper).
  if (!token.uid) return false;
  try {
    const snap = await admin.firestore().doc(`users/${token.uid}`).get();
    const role = snap.exists ? (snap.data() as any)?.adminRole : null;
    return role === 'super' || role === 'moderator' || role === 'support' || role === 'content';
  } catch {
    return false;
  }
}

function isAdminToken(token: admin.auth.DecodedIdToken | undefined): boolean {
  if (!token) return false;
  if (token.admin === true) return true;
  if (token.email_verified === true && token.email && ADMIN_EMAILS.has(token.email.toLowerCase())) {
    return true;
  }
  return false;
}

interface AdminDeleteUserPayload {
  uid: string;
}

interface AdminCreateUserPayload {
  email: string;
  password: string;
  name: string;
  adminRole?: 'super' | 'moderator' | 'support' | 'content' | null;
}

export const adminDeleteUser = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .https.onCall(async (data: AdminDeleteUserPayload, context) => {
    const ok = await isAdminTokenAsync(context.auth?.token);
    if (!ok) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins can delete user accounts.',
      );
    }
    const targetUid = data?.uid;
    if (!targetUid || typeof targetUid !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'A target user uid is required.',
      );
    }
    const callerUid = context.auth?.uid;
    if (callerUid && callerUid === targetUid) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Admins cannot delete their own account through this endpoint. Use the regular Delete Account flow in your settings.',
      );
    }

    const db = admin.firestore();
    let firestoreDeleted = false;
    let authDeleted = false;
    let authErr: string | null = null;

    // Phase 1: Firestore user doc. Best-effort — phase 2 must run regardless
    // so an orphan Auth record with a phone provider doesn't get stuck.
    try {
      await db.collection('users').doc(targetUid).delete();
      firestoreDeleted = true;
    } catch (err) {
      console.warn(`adminDeleteUser(${targetUid}): firestore delete failed`, err);
    }

    // Phase 2: the Auth record. THIS is what frees the phone number.
    try {
      await admin.auth().deleteUser(targetUid);
      authDeleted = true;
    } catch (err: any) {
      // 'auth/user-not-found' is success — already gone.
      if (err?.code === 'auth/user-not-found') {
        authDeleted = true;
      } else {
        authErr = err?.message ?? String(err);
      }
    }

    // Phase 3: best-effort cleanup of side data — public profile + push
    // queue subscription markers. Failures here are non-fatal.
    try {
      await db.collection('publicProfiles').doc(targetUid).delete();
    } catch (err) {
      console.warn(`adminDeleteUser(${targetUid}): publicProfiles cleanup`, err);
    }

    if (!authDeleted) {
      throw new functions.https.HttpsError(
        'internal',
        `Auth deletion failed: ${authErr ?? 'unknown error'}`,
      );
    }

    return {
      ok: true,
      firestoreDeleted,
      authDeleted,
    };
  });

export const adminCreateUser = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .https.onCall(async (data: AdminCreateUserPayload, context) => {
    const ok = await isAdminTokenAsync(context.auth?.token);
    if (!ok) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins can create user accounts.',
      );
    }

    const email = String(data?.email ?? '').trim().toLowerCase();
    const password = String(data?.password ?? '');
    const name = String(data?.name ?? '').trim();
    const requestedRole = data?.adminRole ?? null;

    if (!email || !name) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Name and email are required.',
      );
    }
    if (password.length < 8) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Password must be at least 8 characters.',
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Please provide a valid email address.',
      );
    }
    if (
      requestedRole !== null &&
      requestedRole !== 'super' &&
      requestedRole !== 'moderator' &&
      requestedRole !== 'support' &&
      requestedRole !== 'content'
    ) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid admin role.',
      );
    }

    const authUser = await admin.auth().createUser({
      email,
      password,
      displayName: name,
      emailVerified: false,
    });

    const profileDoc: Record<string, any> = {
      uid: authUser.uid,
      name,
      email,
      motherName: name,
      onboardingComplete: false,
      parentGender: 'mother',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (requestedRole) {
      profileDoc.adminRole = requestedRole;
    }

    await admin.firestore().doc(`users/${authUser.uid}`).set(profileDoc, { merge: true });

    return {
      ok: true,
      uid: authUser.uid,
      email,
      adminRole: requestedRole,
    };
  });

// ─── processScheduledPushes ──────────────────────────────────────────────────
//
// Runs every 5 minutes. Scans `scheduled_pushes` for entries whose
// scheduledFor is now-or-past and status === 'scheduled'. For each, it
// promotes the entry into `push_queue` (which immediately fires the
// dispatchPush trigger above) and marks the schedule entry as 'sent'.
//
// We grant a small grace window (60s) so the dispatcher fires entries that
// barely cross the boundary between cron ticks.
//
// Deploy with:
//   firebase deploy --only functions:processScheduledPushes
// Note: the first deploy of a scheduled function asks Firebase to provision
// a Cloud Scheduler job in the project's region. Free tier covers up to 3
// jobs total — we currently use 1.

export const processScheduledPushes = functions.pubsub
  .schedule('every 5 minutes')
  .timeZone('Asia/Kolkata')
  .onRun(async () => {
    const db = admin.firestore();
    const nowMs = Date.now() + 60_000; // 60s lead so we don't skip anything
    const cutoff = admin.firestore.Timestamp.fromMillis(nowMs);

    const snap = await db
      .collection('scheduled_pushes')
      .where('status', '==', 'scheduled')
      .where('scheduledFor', '<=', cutoff)
      .limit(100)
      .get();

    if (snap.empty) {
      return null;
    }

    let promoted = 0;
    for (const doc of snap.docs) {
      const data = doc.data() as any;
      try {
        if (data.kind === 'custom') {
          // Custom-list: fan out one personal push per target uid. Each gets
          // its own push_queue entry so dispatchPush's per-user pref + dead
          // token logic still applies.
          const uids: string[] = Array.isArray(data.targetUids) ? data.targetUids : [];
          for (const targetUid of uids) {
            await db.collection('push_queue').add({
              kind: 'personal',
              toUid: targetUid,
              fromUid: data.createdByUid ?? null,
              title: data.title,
              body: data.body,
              data: data.data ?? {},
              notifType: 'message',
              status: 'pending',
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              scheduledFromId: doc.id,
            });
          }
          await doc.ref.update({
            status: 'sent',
            firedAt: admin.firestore.FieldValue.serverTimestamp(),
            fanOutCount: uids.length,
          });
        } else {
          // Broadcast: 1 doc, dispatchPush expands to all matching tokens.
          await db.collection('push_queue').add({
            kind: 'broadcast',
            audience: data.audience ?? 'all',
            title: data.title,
            body: data.body,
            data: data.data ?? {},
            pushType: data.pushType ?? 'info',
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            scheduledFromId: doc.id,
          });
          await doc.ref.update({
            status: 'sent',
            firedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
        promoted++;
      } catch (err: any) {
        console.error(`processScheduledPushes ${doc.id}:`, err);
        await doc.ref.update({
          status: 'failed',
          error: String(err?.message ?? err),
          firedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }
    console.log(`processScheduledPushes: promoted ${promoted} of ${snap.size} due entries`);
    return null;
  });

// ─── factoryReset (one-shot) ──────────────────────────────────────────────────
// Wipes every user account + per-user data + admin scratch collections,
// preserving only the founder admin emails. Designed to be called ONCE
// before opening closed testing to real users so Vijay sees a clean
// /admin overview.
//
// Auth model: HTTPS endpoint guarded by an X-Reset-Token header that
// must match the FACTORY_RESET_TOKEN env var. Set the env via:
//   firebase functions:config:set factoryreset.token="<random>"
//   firebase deploy --only functions:factoryReset
// Then call:
//   curl -X POST -H "X-Reset-Token: <random>" \
//        https://us-central1-maa-mitra-7kird8.cloudfunctions.net/factoryReset
//
// SAFE TO LEAVE DEPLOYED — without the secret the endpoint refuses every
// request. Remove from index.ts after the cleanup if you prefer.
const KEEP_EMAILS = new Set([
  'rocking.vsr@gmail.com',
  'divyashekhawat44@yahoo.in',
]);

const SHARED_COLLECTIONS_TO_WIPE = [
  'push_queue',
  'admin_audit',
  'scheduled_pushes',
  'testerFeedback',
  'feedback',
  'supportTickets',
  'follows',
  'followRequests',
  'blocks',
  'communityPosts',
  'community_posts',
  'community',
  'conversations',
  'push_notifications',
];

const PER_USER_SUBTREES = ['moods', 'saved_answers', 'chats', 'notifications'];

async function deleteCollectionRecursive(
  db: admin.firestore.Firestore,
  collectionPath: string,
  batchSize = 200,
): Promise<number> {
  let total = 0;
  while (true) {
    const snap = await db.collection(collectionPath).limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    if (snap.size < batchSize) break;
  }
  return total;
}

async function deleteDocPathRecursive(
  db: admin.firestore.Firestore,
  docPath: string,
): Promise<void> {
  const docRef = db.doc(docPath);
  const subs = await docRef.listCollections();
  for (const sub of subs) {
    let snap = await sub.limit(200).get();
    while (!snap.empty) {
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      snap = await sub.limit(200).get();
    }
  }
  await docRef.delete().catch(() => {});
}

async function performFactoryReset(): Promise<Record<string, any>> {
  const db = admin.firestore();
  const auth = admin.auth();
  const summary: Record<string, any> = {
    keptEmails: [...KEEP_EMAILS],
    deletedUsers: 0,
    deletedAuthRecords: 0,
    perCollectionDeleted: {} as Record<string, number>,
  };
  return await runFactoryResetCore(db, auth, summary);
}

async function runFactoryResetCore(
  db: admin.firestore.Firestore,
  auth: admin.auth.Auth,
  summary: Record<string, any>,
): Promise<Record<string, any>> {
  // Phase moved into shared helper so the HTTPS-token endpoint and the
  // admin-callable endpoint exercise identical logic.
  await runFactoryResetInner(db, auth, summary);
  summary.ok = true;
  return summary;
}

export const factoryReset = functions
  .runWith({ memory: '512MB', timeoutSeconds: 540, secrets: ['FACTORY_RESET_TOKEN'] })
  .https.onRequest(async (req, res) => {
    const token = req.get('x-reset-token');
    const expected = process.env.FACTORY_RESET_TOKEN;
    if (!expected || token !== expected) {
      res.status(403).json({ ok: false, error: 'forbidden' });
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'method-not-allowed' });
      return;
    }
    try {
      const summary = await performFactoryReset();
      res.json(summary);
    } catch (err: any) {
      console.error('factoryReset failed:', err);
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

// Admin-callable variant: same destructive operation but auth is the
// caller's super-admin token instead of a static secret. Wired to the
// /admin "Factory reset" button. Requires an explicit confirm string in
// the payload so accidental clicks can't trigger it from a console.
export const adminFactoryReset = functions
  .runWith({ memory: '512MB', timeoutSeconds: 540 })
  .https.onCall(async (data: { confirm?: string }, context) => {
    const ok = await isAdminTokenAsync(context.auth?.token);
    if (!ok) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins can run factory reset.',
      );
    }
    if (data?.confirm !== 'WIPE-ALL-USERS') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Confirm string mismatch — payload must be { confirm: "WIPE-ALL-USERS" }.',
      );
    }
    return await performFactoryReset();
  });

// Inner cleanup body — kept as a separate function so both endpoints
// share the same sequence (auth wipe → orphan firestore wipe → shared
// scratch collections → storage).
async function runFactoryResetInner(
  db: admin.firestore.Firestore,
  auth: admin.auth.Auth,
  summary: Record<string, any>,
): Promise<void> {
    {
      // Resolve admin UIDs up front — storage paths key by uid, not email.
      const keepUids = new Set<string>();
      for (const email of KEEP_EMAILS) {
        try {
          const u = await auth.getUserByEmail(email);
          keepUids.add(u.uid);
        } catch (err) {
          console.warn(`factoryReset: keep email ${email} not found in Auth`, err);
        }
      }

      // 1. Walk all auth users; delete the ones not in the keep list.
      let nextPageToken: string | undefined;
      do {
        const page = await auth.listUsers(1000, nextPageToken);
        for (const u of page.users) {
          const email = (u.email || '').toLowerCase();
          if (KEEP_EMAILS.has(email)) continue;
          await deleteDocPathRecursive(db, `users/${u.uid}`);
          await deleteDocPathRecursive(db, `publicProfiles/${u.uid}`);
          for (const sub of PER_USER_SUBTREES) {
            await deleteDocPathRecursive(db, `${sub}/${u.uid}`);
          }
          try {
            await auth.deleteUser(u.uid);
            summary.deletedAuthRecords++;
          } catch (err) {
            console.warn(`factoryReset auth delete failed for ${u.uid}:`, err);
          }
          summary.deletedUsers++;
        }
        nextPageToken = page.pageToken;
      } while (nextPageToken);

      // 2. Walk Firestore users collection too — covers orphaned Firestore
      //    docs whose Auth records are already gone.
      const orphanSnap = await db.collection('users').get();
      for (const doc of orphanSnap.docs) {
        const email = (doc.data()?.email || '').toLowerCase();
        if (KEEP_EMAILS.has(email)) continue;
        await deleteDocPathRecursive(db, `users/${doc.id}`);
        await deleteDocPathRecursive(db, `publicProfiles/${doc.id}`);
        for (const sub of PER_USER_SUBTREES) {
          await deleteDocPathRecursive(db, `${sub}/${doc.id}`);
        }
      }

      // 3. Wipe shared "scratch" collections so admin counters reset to zero.
      for (const col of SHARED_COLLECTIONS_TO_WIPE) {
        const n = await deleteCollectionRecursive(db, col);
        if (n > 0) summary.perCollectionDeleted[col] = n;
      }

      // 4. Storage cleanup — remove orphaned avatars, kid avatars, post
      //    images, and DM attachments owned by deleted users. Path
      //    schemes:
      //      avatars/{uid}.<ext>
      //      kid-avatars/{uid}/{kidId}.<ext>
      //      posts/{uid}/{ts}.<ext>
      //      dm-images/{convId}/{uid}_{ts}.<ext>
      const bucket = admin.storage().bucket();
      let storageDeleted = 0;
      const wipePrefix = async (
        prefix: string,
        uidExtractor: (name: string) => string,
      ) => {
        const [files] = await bucket.getFiles({ prefix });
        for (const file of files) {
          const uid = uidExtractor(file.name);
          if (!uid || keepUids.has(uid)) continue;
          await file.delete().catch((err) => {
            console.warn(`factoryReset: failed to delete ${file.name}`, err);
          });
          storageDeleted++;
        }
      };
      await wipePrefix('avatars/', (name) =>
        name.replace(/^avatars\//, '').split('.')[0],
      );
      await wipePrefix('kid-avatars/', (name) =>
        name.split('/')[1] || '',
      );
      await wipePrefix('posts/', (name) => name.split('/')[1] || '');
      await wipePrefix('dm-images/', (name) => {
        const last = name.split('/').pop() || '';
        return last.split('_')[0] || '';
      });
      summary.storageDeleted = storageDeleted;
    }
}

async function pruneDeadTokens(
  db: admin.firestore.Firestore,
  deadTokens: string[],
): Promise<void> {
  const chunks: string[][] = [];
  for (let i = 0; i < deadTokens.length; i += 10) chunks.push(deadTokens.slice(i, i + 10));
  for (const chunk of chunks) {
    const snap = await db
      .collection('users')
      .where('fcmTokens', 'array-contains-any', chunk)
      .get();
    const batch = db.batch();
    snap.forEach((doc) => {
      batch.update(doc.ref, {
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...chunk),
      });
    });
    await batch.commit();
  }
}

// ─── synthesizeSpeech ─────────────────────────────────────────────────────────
// Reads any chat reply aloud in the user's preferred Indian language.
// Brain stays Claude — this only converts Claude's *text* output into MP3.
//
// Voice mapping picks a warm female Neural2 voice per locale where one
// exists, falling back to Standard for languages Google hasn't shipped
// Neural2 for yet. Adjust LANG_VOICE if you want a male voice or a
// different Neural2 letter (-A through -F).
//
// Output is base64 MP3, returned via the callable response so we don't
// have to manage cleanup of any storage objects.

const LANG_VOICE: Record<string, { languageCode: string; name: string }> = {
  // Indian English — warm, slightly slower than US English voices.
  'en-IN':  { languageCode: 'en-IN', name: 'en-IN-Neural2-A' },
  'hi-IN':  { languageCode: 'hi-IN', name: 'hi-IN-Neural2-A' },
  'bn-IN':  { languageCode: 'bn-IN', name: 'bn-IN-Standard-A' },
  'ta-IN':  { languageCode: 'ta-IN', name: 'ta-IN-Standard-C' },
  'te-IN':  { languageCode: 'te-IN', name: 'te-IN-Standard-A' },
  'mr-IN':  { languageCode: 'mr-IN', name: 'mr-IN-Standard-A' },
  'ml-IN':  { languageCode: 'ml-IN', name: 'ml-IN-Standard-A' },
  'kn-IN':  { languageCode: 'kn-IN', name: 'kn-IN-Standard-A' },
  'gu-IN':  { languageCode: 'gu-IN', name: 'gu-IN-Standard-A' },
  'pa-IN':  { languageCode: 'pa-IN', name: 'pa-IN-Standard-A' },
  'ur-IN':  { languageCode: 'ur-IN', name: 'ur-IN-Standard-A' },
  // Fallbacks for plain BCP-47 short codes the client may send.
  'en':     { languageCode: 'en-IN', name: 'en-IN-Neural2-A' },
  'hi':     { languageCode: 'hi-IN', name: 'hi-IN-Neural2-A' },
};

const TTS_MAX_CHARS = 1200;

export const synthesizeSpeech = functions
  .runWith({ memory: '256MB', timeoutSeconds: 30 })
  .https.onCall(async (data: { text?: string; lang?: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Sign in to use voice playback.',
      );
    }
    const text = String(data?.text ?? '').trim();
    const lang = String(data?.lang ?? 'en-IN').trim();
    if (!text) {
      throw new functions.https.HttpsError('invalid-argument', 'No text to speak.');
    }
    if (text.length > TTS_MAX_CHARS) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Text exceeds the ${TTS_MAX_CHARS}-char limit; trim before sending.`,
      );
    }
    const voice = LANG_VOICE[lang] ?? LANG_VOICE['en-IN'];

    const client = new textToSpeech.TextToSpeechClient();
    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice: { languageCode: voice.languageCode, name: voice.name },
      audioConfig: {
        audioEncoding: 'MP3',
        // Slight rate slowdown — motherly tone, not news anchor.
        speakingRate: 0.96,
        pitch: 0,
        sampleRateHertz: 24000,
      },
    });

    const audioContent = response.audioContent;
    if (!audioContent) {
      throw new functions.https.HttpsError('internal', 'TTS returned empty audio.');
    }
    const base64 = Buffer.isBuffer(audioContent)
      ? audioContent.toString('base64')
      : Buffer.from(audioContent).toString('base64');

    return {
      ok: true,
      mimeType: 'audio/mpeg',
      base64,
      voice: voice.name,
      bytes: base64.length,
    };
  });

// ──────────────────────────────────────────────────────────────────────────────
// Wave 3 — Counter-integrity & cascade triggers
//
// Before these triggers existed, every denormalized counter on community
// content was maintained client-side. That worked when nothing went wrong,
// but every network failure, every concurrent write, and every aborted
// mutation drifted the counters until a manual repair sweep ran. These
// triggers are the source of truth: clients send their own writes, the
// server reconciles. The corresponding Firestore rules (firestore.rules
// lines 169-187) cap client-side commentCount writes to ±1 so the
// trigger gets the final word without a tug-of-war.
// ──────────────────────────────────────────────────────────────────────────────

const db = admin.firestore();

/** When a comment is added, atomically bump the parent post's commentCount
 *  and refresh its lastComment denormalisation. The transaction reads the
 *  parent at write time so concurrent comment adds don't lose updates. */
export const onCommentCreate = functions.firestore
  .document('communityPosts/{postId}/comments/{commentId}')
  .onCreate(async (snap, context) => {
    const { postId, commentId } = context.params as { postId: string; commentId: string };
    const data = snap.data() ?? {};
    const postRef = db.doc(`communityPosts/${postId}`);
    try {
      await db.runTransaction(async (tx) => {
        const postSnap = await tx.get(postRef);
        if (!postSnap.exists) return;
        const post = postSnap.data() ?? {};
        // Trust the trigger over the client. We bump from the current
        // server value (not from the client's increment) so any drift
        // from concurrent client writes is corrected on this hop.
        const nextCount = (post.commentCount ?? 0) + 1;
        tx.update(postRef, {
          commentCount: nextCount,
          lastComment: {
            id: commentId,
            authorUid: data.authorUid ?? '',
            authorName: data.authorName ?? '',
            authorInitial: data.authorInitial ?? '',
            authorPhotoUrl: data.authorPhotoUrl ?? '',
            text: data.text ?? '',
          },
          lastCommentAt: data.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
        });
      });
    } catch (err) {
      console.warn(`onCommentCreate(${postId}/${commentId}) failed`, err);
    }
  });

/** When a comment is deleted, decrement the parent post's commentCount
 *  and refresh lastComment to whatever the new latest is (or clear it if
 *  the post has zero comments left). */
export const onCommentDelete = functions.firestore
  .document('communityPosts/{postId}/comments/{commentId}')
  .onDelete(async (snap, context) => {
    const { postId, commentId } = context.params as { postId: string; commentId: string };
    const postRef = db.doc(`communityPosts/${postId}`);
    try {
      // Read latest remaining comment OUTSIDE the transaction (orderBy
      // limit queries aren't allowed inside transactions). The race
      // window is small — if a new comment is created between this
      // read and the transaction commit, the next onCommentCreate /
      // onCommentDelete invocation will reconcile.
      const latestSnap = await db
        .collection(`communityPosts/${postId}/comments`)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
      const latest = latestSnap.docs[0];
      await db.runTransaction(async (tx) => {
        const postSnap = await tx.get(postRef);
        if (!postSnap.exists) return;
        const post = postSnap.data() ?? {};
        const nextCount = Math.max(0, (post.commentCount ?? 1) - 1);
        const updates: Record<string, any> = { commentCount: nextCount };
        if (post.lastComment?.id === commentId) {
          if (latest) {
            const ld = latest.data();
            updates.lastComment = {
              id: latest.id,
              authorUid: ld.authorUid ?? '',
              authorName: ld.authorName ?? '',
              authorInitial: ld.authorInitial ?? '',
              authorPhotoUrl: ld.authorPhotoUrl ?? '',
              text: ld.text ?? '',
            };
            updates.lastCommentAt = ld.createdAt ?? admin.firestore.FieldValue.serverTimestamp();
          } else {
            updates.lastComment = admin.firestore.FieldValue.delete();
            updates.lastCommentAt = admin.firestore.FieldValue.delete();
          }
        }
        tx.update(postRef, updates);
      });
    } catch (err) {
      console.warn(`onCommentDelete(${postId}/${commentId}) failed`, err);
    }
  });

/** When a post is deleted, sweep its comments subcollection (the client
 *  also tries this but rules can deny that path; the trigger runs with
 *  admin privileges) and decrement the author's postsCount. The image
 *  blob is cleaned client-side because Storage trigger access requires
 *  a separate function deployment that we don't run yet. */
export const onPostDelete = functions.firestore
  .document('communityPosts/{postId}')
  .onDelete(async (snap, context) => {
    const { postId } = context.params as { postId: string };
    const data = snap.data() ?? {};
    const authorUid = data.authorUid ?? '';
    try {
      // 1) Cascade comments (admin SDK bypasses rules so this is the
      //    authoritative sweep — client cascade is best-effort).
      const comments = await db.collection(`communityPosts/${postId}/comments`).get();
      if (!comments.empty) {
        const batch = db.batch();
        comments.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (err) {
      console.warn(`onPostDelete(${postId}) comment sweep failed`, err);
    }
    if (authorUid) {
      try {
        await db.doc(`publicProfiles/${authorUid}`).set(
          { uid: authorUid, postsCount: admin.firestore.FieldValue.increment(-1) },
          { merge: true },
        );
      } catch (err) {
        console.warn(`onPostDelete(${postId}) postsCount decrement failed`, err);
      }
    }
  });

/** Bootstrap a publicProfile when a follow doc lands and the followee has
 *  none yet (the first-follower-of-new-user race), then bump the counters
 *  on both ends. Runs server-side so concurrent follows don't both create
 *  the doc with overlapping merges. */
export const onFollowCreate = functions.firestore
  .document('follows/{followId}')
  .onCreate(async (snap) => {
    const data = snap.data() ?? {};
    const fromUid = data.fromUid;
    const toUid = data.toUid;
    if (!fromUid || !toUid || fromUid === toUid) return;
    try {
      const batch = db.batch();
      batch.set(
        db.doc(`publicProfiles/${toUid}`),
        { uid: toUid, followersCount: admin.firestore.FieldValue.increment(1) },
        { merge: true },
      );
      batch.set(
        db.doc(`publicProfiles/${fromUid}`),
        { uid: fromUid, followingCount: admin.firestore.FieldValue.increment(1) },
        { merge: true },
      );
      await batch.commit();
    } catch (err) {
      console.warn(`onFollowCreate(${fromUid}->${toUid}) failed`, err);
    }
  });

/** Decrement counters when a follow is removed. Idempotent on the trigger
 *  itself (Cloud Functions retries) because the increment is bounded
 *  by the doc lifecycle: each delete fires onDelete exactly once. */
export const onFollowDelete = functions.firestore
  .document('follows/{followId}')
  .onDelete(async (snap) => {
    const data = snap.data() ?? {};
    const fromUid = data.fromUid;
    const toUid = data.toUid;
    if (!fromUid || !toUid) return;
    try {
      const batch = db.batch();
      batch.set(
        db.doc(`publicProfiles/${toUid}`),
        { uid: toUid, followersCount: admin.firestore.FieldValue.increment(-1) },
        { merge: true },
      );
      batch.set(
        db.doc(`publicProfiles/${fromUid}`),
        { uid: fromUid, followingCount: admin.firestore.FieldValue.increment(-1) },
        { merge: true },
      );
      await batch.commit();
    } catch (err) {
      console.warn(`onFollowDelete(${fromUid}->${toUid}) failed`, err);
    }
  });

/** Bootstrap publicProfile + notifPrefs defaults the moment a new user's
 *  Firebase Auth record is created. Eliminates the "first follower fails
 *  because the followee has no publicProfile yet" race and stops every
 *  client from racing to syncPublicProfile() on first run. */
export const onUserCreated = functions.auth.user().onCreate(async (user) => {
  const uid = user.uid;
  if (!uid) return;
  try {
    await db.doc(`publicProfiles/${uid}`).set(
      {
        uid,
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } catch (err) {
    console.warn(`onUserCreated(${uid}) bootstrap failed`, err);
  }
});

/** Daily-ish counter-drift repair: walks the publicProfiles collection
 *  and re-counts followers/following/posts for every profile. Cheap
 *  enough at our scale (<1000 profiles) to run nightly without
 *  partitioning; revisit if the user count grows by a magnitude. */
export const repairCommunityCounters = functions.pubsub
  .schedule('every day 03:00')
  .timeZone('Asia/Kolkata')
  .onRun(async () => {
    try {
      const profiles = await db.collection('publicProfiles').get();
      let repaired = 0;
      for (const profile of profiles.docs) {
        const uid = profile.id;
        try {
          const [followers, following, posts] = await Promise.all([
            db.collection('follows').where('toUid', '==', uid).get(),
            db.collection('follows').where('fromUid', '==', uid).get(),
            db.collection('communityPosts').where('authorUid', '==', uid).get(),
          ]);
          const data = profile.data() ?? {};
          if (
            data.followersCount !== followers.size ||
            data.followingCount !== following.size ||
            data.postsCount !== posts.size
          ) {
            await profile.ref.update({
              followersCount: followers.size,
              followingCount: following.size,
              postsCount: posts.size,
              countersRepairedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            repaired++;
          }
        } catch (err) {
          console.warn(`repairCommunityCounters(${uid}) failed`, err);
        }
      }
      console.log(`repairCommunityCounters: walked ${profiles.size}, repaired ${repaired}`);
    } catch (err) {
      console.error('repairCommunityCounters fatal', err);
    }
  });
