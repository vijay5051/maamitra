"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.processScheduledPushes = exports.adminCreateUser = exports.adminDeleteUser = exports.dispatchPush = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const DEFAULT_PREFS = {
    reactions: true,
    comments: true,
    dms: true,
    follows: true,
    announcements: true,
};
const MAX_BATCH = 500;
exports.dispatchPush = functions.firestore
    .document('push_queue/{jobId}')
    .onCreate(async (snap, context) => {
    const job = snap.data();
    const jobId = context.params.jobId;
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
        const deadTokens = [];
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
                if (r.success)
                    return;
                const code = r.error?.code ?? '';
                if (code === 'messaging/registration-token-not-registered' ||
                    code === 'messaging/invalid-registration-token') {
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
    }
    catch (err) {
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
async function resolveTokens(db, job) {
    if (job.kind === 'personal') {
        if (!job.toUid)
            return [];
        const doc = await db.doc(`users/${job.toUid}`).get();
        const data = doc.data();
        if (!data || data.pushEnabled === false)
            return [];
        // Per-topic gate. Map the in-app notification type to a pref key;
        // if the pref is false we return no tokens → silent skip.
        const prefs = { ...DEFAULT_PREFS, ...(data.notifPrefs || {}) };
        const prefKey = personalPrefKey(job.notifType);
        if (prefKey && !prefs[prefKey])
            return [];
        const tokens = data.fcmTokens;
        return Array.isArray(tokens) ? tokens.filter((t) => typeof t === 'string' && t.length > 0) : [];
    }
    // ── broadcast ──────────────────────────────────────────────────
    // 'all' audience: everyone with push on AND announcements not
    // explicitly off. We use two queries per filter (can't combine
    // !=-equivalent with other filters easily) — simpler path: pull
    // pushEnabled users and filter announcements in-memory.
    const q = job.audience && job.audience !== 'all'
        ? db.collection('users')
            .where('pushEnabled', '==', true)
            .where('audienceBuckets', 'array-contains', job.audience)
        : db.collection('users').where('pushEnabled', '==', true);
    const snap = await q.get();
    const out = [];
    snap.forEach((doc) => {
        const d = doc.data();
        // Respect announcements opt-out. Missing prefs default to true.
        const wantsAnnouncements = d.notifPrefs?.announcements !== false;
        if (!wantsAnnouncements)
            return;
        const arr = d.fcmTokens;
        if (Array.isArray(arr)) {
            for (const t of arr) {
                if (typeof t === 'string' && t.length > 0)
                    out.push(t);
            }
        }
    });
    return out;
}
/** Map a personal-push in-app type to its matching pref key. */
function personalPrefKey(type) {
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
function sanitiseData(data) {
    if (!data)
        return undefined;
    const out = {};
    for (const [k, v] of Object.entries(data)) {
        if (v === null || v === undefined)
            continue;
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
const ADMIN_EMAILS = new Set([
    'admin@maamitra.app',
    'vijay@maamitra.app',
    'rocking.vsr@gmail.com',
    'demo@maamitra.app',
]);
async function isAdminTokenAsync(token) {
    if (!token)
        return false;
    if (token.admin === true)
        return true;
    if (token.email_verified === true && token.email && ADMIN_EMAILS.has(token.email.toLowerCase())) {
        return true;
    }
    // Fallback: stored role on the user doc (matches firestore.rules helper).
    if (!token.uid)
        return false;
    try {
        const snap = await admin.firestore().doc(`users/${token.uid}`).get();
        const role = snap.exists ? snap.data()?.adminRole : null;
        return role === 'super' || role === 'moderator' || role === 'support' || role === 'content';
    }
    catch {
        return false;
    }
}
function isAdminToken(token) {
    if (!token)
        return false;
    if (token.admin === true)
        return true;
    if (token.email_verified === true && token.email && ADMIN_EMAILS.has(token.email.toLowerCase())) {
        return true;
    }
    return false;
}
exports.adminDeleteUser = functions
    .runWith({ memory: '256MB', timeoutSeconds: 60 })
    .https.onCall(async (data, context) => {
    const ok = await isAdminTokenAsync(context.auth?.token);
    if (!ok) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can delete user accounts.');
    }
    const targetUid = data?.uid;
    if (!targetUid || typeof targetUid !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'A target user uid is required.');
    }
    const callerUid = context.auth?.uid;
    if (callerUid && callerUid === targetUid) {
        throw new functions.https.HttpsError('failed-precondition', 'Admins cannot delete their own account through this endpoint. Use the regular Delete Account flow in your settings.');
    }
    const db = admin.firestore();
    let firestoreDeleted = false;
    let authDeleted = false;
    let authErr = null;
    // Phase 1: Firestore user doc. Best-effort — phase 2 must run regardless
    // so an orphan Auth record with a phone provider doesn't get stuck.
    try {
        await db.collection('users').doc(targetUid).delete();
        firestoreDeleted = true;
    }
    catch (err) {
        console.warn(`adminDeleteUser(${targetUid}): firestore delete failed`, err);
    }
    // Phase 2: the Auth record. THIS is what frees the phone number.
    try {
        await admin.auth().deleteUser(targetUid);
        authDeleted = true;
    }
    catch (err) {
        // 'auth/user-not-found' is success — already gone.
        if (err?.code === 'auth/user-not-found') {
            authDeleted = true;
        }
        else {
            authErr = err?.message ?? String(err);
        }
    }
    // Phase 3: best-effort cleanup of side data — public profile + push
    // queue subscription markers. Failures here are non-fatal.
    try {
        await db.collection('publicProfiles').doc(targetUid).delete();
    }
    catch (err) {
        console.warn(`adminDeleteUser(${targetUid}): publicProfiles cleanup`, err);
    }
    if (!authDeleted) {
        throw new functions.https.HttpsError('internal', `Auth deletion failed: ${authErr ?? 'unknown error'}`);
    }
    return {
        ok: true,
        firestoreDeleted,
        authDeleted,
    };
});
exports.adminCreateUser = functions
    .runWith({ memory: '256MB', timeoutSeconds: 60 })
    .https.onCall(async (data, context) => {
    const ok = await isAdminTokenAsync(context.auth?.token);
    if (!ok) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can create user accounts.');
    }
    const email = String(data?.email ?? '').trim().toLowerCase();
    const password = String(data?.password ?? '');
    const name = String(data?.name ?? '').trim();
    const requestedRole = data?.adminRole ?? null;
    if (!email || !name) {
        throw new functions.https.HttpsError('invalid-argument', 'Name and email are required.');
    }
    if (password.length < 8) {
        throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 8 characters.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new functions.https.HttpsError('invalid-argument', 'Please provide a valid email address.');
    }
    if (requestedRole !== null &&
        requestedRole !== 'super' &&
        requestedRole !== 'moderator' &&
        requestedRole !== 'support' &&
        requestedRole !== 'content') {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid admin role.');
    }
    const authUser = await admin.auth().createUser({
        email,
        password,
        displayName: name,
        emailVerified: false,
    });
    const profileDoc = {
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
exports.processScheduledPushes = functions.pubsub
    .schedule('every 5 minutes')
    .timeZone('Asia/Kolkata')
    .onRun(async () => {
    const db = admin.firestore();
    const nowMs = Date.now() + 60000; // 60s lead so we don't skip anything
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
        const data = doc.data();
        try {
            if (data.kind === 'custom') {
                // Custom-list: fan out one personal push per target uid. Each gets
                // its own push_queue entry so dispatchPush's per-user pref + dead
                // token logic still applies.
                const uids = Array.isArray(data.targetUids) ? data.targetUids : [];
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
            }
            else {
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
        }
        catch (err) {
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
async function pruneDeadTokens(db, deadTokens) {
    const chunks = [];
    for (let i = 0; i < deadTokens.length; i += 10)
        chunks.push(deadTokens.slice(i, i + 10));
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
