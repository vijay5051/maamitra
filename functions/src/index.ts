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

admin.initializeApp();

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

    try {
      const tokens = await resolveTokens(db, job);
      if (tokens.length === 0) {
        await snap.ref.update({
          status: 'skipped',
          reason: 'no-tokens-or-prefs-off',
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
      }

      const deadTokens: string[] = [];
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < tokens.length; i += MAX_BATCH) {
        const batch = tokens.slice(i, i + MAX_BATCH);
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
          if (r.success) return;
          const code = r.error?.code ?? '';
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            deadTokens.push(batch[idx]);
          }
        });
      }

      if (deadTokens.length > 0) {
        await pruneDeadTokens(db, deadTokens);
      }

      await snap.ref.update({
        status: failureCount > 0 && successCount === 0 ? 'failed' : 'sent',
        successCount,
        failureCount,
        deadTokens: deadTokens.length,
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
  if (job.kind === 'personal') {
    if (!job.toUid) return [];
    const doc = await db.doc(`users/${job.toUid}`).get();
    const data = doc.data();
    if (!data || data.pushEnabled === false) return [];

    // Per-topic gate. Map the in-app notification type to a pref key;
    // if the pref is false we return no tokens → silent skip.
    const prefs: NotifPrefs = { ...DEFAULT_PREFS, ...(data.notifPrefs || {}) };
    const prefKey = personalPrefKey(job.notifType);
    if (prefKey && !prefs[prefKey]) return [];

    const tokens = data.fcmTokens;
    return Array.isArray(tokens) ? tokens.filter((t: any) => typeof t === 'string' && t.length > 0) : [];
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
  const out: string[] = [];
  snap.forEach((doc) => {
    const d = doc.data();
    // Respect announcements opt-out. Missing prefs default to true.
    const wantsAnnouncements = d.notifPrefs?.announcements !== false;
    if (!wantsAnnouncements) return;
    const arr = d.fcmTokens;
    if (Array.isArray(arr)) {
      for (const t of arr) {
        if (typeof t === 'string' && t.length > 0) out.push(t);
      }
    }
  });
  return out;
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
