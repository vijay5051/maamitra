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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyLibraryAiCron = exports.archiveLibraryItem = exports.generateProductsNow = exports.generateBooksNow = exports.syncArticleSocialDraft = exports.syncPublishedArticleToMarketingDraft = exports.sendArticleToMarketingDraft = exports.retryArticleImage = exports.processPendingArticleImage = exports.generateArticleNow = exports.updateIntegrationConfig = exports.checkIntegrationHealth = exports.probeMarketingHealthNow = exports.probeMarketingHealth = exports.composeStudioLogo = exports.uploadStudioImage = exports.editStudioImage = exports.generateTemplatePrefill = exports.createStudioDraft = exports.generateStudioVariants = exports.boostMarketingDraft = exports.renderUgcAsDraft = exports.generateWeeklyInsightDigest = exports.pollMarketingAccountInsights = exports.pollMarketingInsights = exports.publishMarketingDraftNow = exports.scheduledMarketingPublisher = exports.metaInboxReplyPublisher = exports.classifyInboxThread = exports.generateInboxReplies = exports.metaWebhookReceiver = exports.generateAheadDrafts = exports.dailyMarketingDraftCron = exports.generateMarketingDraft = exports.scoreMarketingDraft = exports.renderMarketingTemplate = exports.repairCommunityCounters = exports.onUserCreated = exports.onFollowDelete = exports.onFollowCreate = exports.onPostDelete = exports.onCommentDelete = exports.onCommentCreate = exports.synthesizeSpeech = exports.adminFactoryReset = exports.factoryReset = exports.processScheduledPushes = exports.adminCreateUser = exports.adminDeleteUser = exports.dispatchPush = void 0;
exports.expireStaleLibrary = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const text_to_speech_1 = __importDefault(require("@google-cloud/text-to-speech"));
const integrations_1 = require("./integrations");
const library_1 = require("./library");
const marketing_1 = require("./marketing");
admin.initializeApp();
// Allow undefined fields in setDoc/update payloads to be silently dropped
// rather than throwing "Cannot use 'undefined' as a Firestore value".
// Without this, dispatchPush failed every time a recipient's
// skippedReason was undefined (the common "successfully sent" case),
// so admin notifications never recorded a delivery report.
admin.firestore().settings({ ignoreUndefinedProperties: true });
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
    const reportRef = snap.ref.collection('delivery_report');
    try {
        const recipients = await resolveRecipients(db, job);
        const activeRecipients = recipients.filter((r) => r.tokens.length > 0);
        const skippedRecipients = recipients.filter((r) => r.tokens.length === 0);
        const tokenOwners = activeRecipients.flatMap((r) => r.tokens.map((token) => ({
            token,
            uid: r.uid,
            email: r.email,
            name: r.name,
        })));
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
        const deadTokens = new Set();
        let successCount = 0;
        let failureCount = 0;
        const perRecipient = new Map();
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
                if (!rec)
                    return;
                if (r.success) {
                    rec.successCount += 1;
                    return;
                }
                rec.failureCount += 1;
                const code = r.error?.code ?? '';
                if (code)
                    rec.errorCodes[code] = (rec.errorCodes[code] ?? 0) + 1;
                if (code === 'messaging/registration-token-not-registered' ||
                    code === 'messaging/invalid-registration-token') {
                    deadTokens.add(batch[idx]);
                    rec.deadTokens += 1;
                }
            });
        }
        if (deadTokens.size > 0) {
            await pruneDeadTokens(db, [...deadTokens]);
        }
        const deliveryRows = [...perRecipient.values()].map((rec) => ({
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
    const recipients = await resolveRecipients(db, job);
    return recipients.flatMap((r) => r.tokens);
}
async function resolveRecipients(db, job) {
    if (job.kind === 'personal') {
        if (!job.toUid)
            return [];
        const doc = await db.doc(`users/${job.toUid}`).get();
        const data = doc.data();
        if (!data)
            return [];
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
        const prefs = { ...DEFAULT_PREFS, ...(data.notifPrefs || {}) };
        const prefKey = personalPrefKey(job.notifType);
        if (prefKey && !prefs[prefKey]) {
            return [{ uid: job.toUid, email, name, tokens: [], skippedReason: `pref-off:${prefKey}` }];
        }
        const tokens = data.fcmTokens;
        const cleaned = Array.isArray(tokens) ? tokens.filter((t) => typeof t === 'string' && t.length > 0) : [];
        return [{ uid: job.toUid, email, name, tokens: cleaned, skippedReason: cleaned.length === 0 ? 'no-tokens' : undefined }];
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
            ? arr.filter((t) => typeof t === 'string' && t.length > 0)
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
async function writeDeliveryReport(reportRef, rows) {
    if (rows.length === 0)
        return;
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
async function deleteCollectionRecursive(db, collectionPath, batchSize = 200) {
    let total = 0;
    while (true) {
        const snap = await db.collection(collectionPath).limit(batchSize).get();
        if (snap.empty)
            break;
        const batch = db.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        total += snap.size;
        if (snap.size < batchSize)
            break;
    }
    return total;
}
async function deleteDocPathRecursive(db, docPath) {
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
    await docRef.delete().catch(() => { });
}
async function performFactoryReset() {
    const db = admin.firestore();
    const auth = admin.auth();
    const summary = {
        keptEmails: [...KEEP_EMAILS],
        deletedUsers: 0,
        deletedAuthRecords: 0,
        perCollectionDeleted: {},
    };
    return await runFactoryResetCore(db, auth, summary);
}
async function runFactoryResetCore(db, auth, summary) {
    // Phase moved into shared helper so the HTTPS-token endpoint and the
    // admin-callable endpoint exercise identical logic.
    await runFactoryResetInner(db, auth, summary);
    summary.ok = true;
    return summary;
}
exports.factoryReset = functions
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
    }
    catch (err) {
        console.error('factoryReset failed:', err);
        res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
});
// Admin-callable variant: same destructive operation but auth is the
// caller's super-admin token instead of a static secret. Wired to the
// /admin "Factory reset" button. Requires an explicit confirm string in
// the payload so accidental clicks can't trigger it from a console.
exports.adminFactoryReset = functions
    .runWith({ memory: '512MB', timeoutSeconds: 540 })
    .https.onCall(async (data, context) => {
    const ok = await isAdminTokenAsync(context.auth?.token);
    if (!ok) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can run factory reset.');
    }
    if (data?.confirm !== 'WIPE-ALL-USERS') {
        throw new functions.https.HttpsError('failed-precondition', 'Confirm string mismatch — payload must be { confirm: "WIPE-ALL-USERS" }.');
    }
    return await performFactoryReset();
});
// Inner cleanup body — kept as a separate function so both endpoints
// share the same sequence (auth wipe → orphan firestore wipe → shared
// scratch collections → storage).
async function runFactoryResetInner(db, auth, summary) {
    {
        // Resolve admin UIDs up front — storage paths key by uid, not email.
        const keepUids = new Set();
        for (const email of KEEP_EMAILS) {
            try {
                const u = await auth.getUserByEmail(email);
                keepUids.add(u.uid);
            }
            catch (err) {
                console.warn(`factoryReset: keep email ${email} not found in Auth`, err);
            }
        }
        // 1. Walk all auth users; delete the ones not in the keep list.
        let nextPageToken;
        do {
            const page = await auth.listUsers(1000, nextPageToken);
            for (const u of page.users) {
                const email = (u.email || '').toLowerCase();
                if (KEEP_EMAILS.has(email))
                    continue;
                await deleteDocPathRecursive(db, `users/${u.uid}`);
                await deleteDocPathRecursive(db, `publicProfiles/${u.uid}`);
                for (const sub of PER_USER_SUBTREES) {
                    await deleteDocPathRecursive(db, `${sub}/${u.uid}`);
                }
                try {
                    await auth.deleteUser(u.uid);
                    summary.deletedAuthRecords++;
                }
                catch (err) {
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
            if (KEEP_EMAILS.has(email))
                continue;
            await deleteDocPathRecursive(db, `users/${doc.id}`);
            await deleteDocPathRecursive(db, `publicProfiles/${doc.id}`);
            for (const sub of PER_USER_SUBTREES) {
                await deleteDocPathRecursive(db, `${sub}/${doc.id}`);
            }
        }
        // 3. Wipe shared "scratch" collections so admin counters reset to zero.
        for (const col of SHARED_COLLECTIONS_TO_WIPE) {
            const n = await deleteCollectionRecursive(db, col);
            if (n > 0)
                summary.perCollectionDeleted[col] = n;
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
        const wipePrefix = async (prefix, uidExtractor) => {
            const [files] = await bucket.getFiles({ prefix });
            for (const file of files) {
                const uid = uidExtractor(file.name);
                if (!uid || keepUids.has(uid))
                    continue;
                await file.delete().catch((err) => {
                    console.warn(`factoryReset: failed to delete ${file.name}`, err);
                });
                storageDeleted++;
            }
        };
        await wipePrefix('avatars/', (name) => name.replace(/^avatars\//, '').split('.')[0]);
        await wipePrefix('kid-avatars/', (name) => name.split('/')[1] || '');
        await wipePrefix('posts/', (name) => name.split('/')[1] || '');
        await wipePrefix('dm-images/', (name) => {
            const last = name.split('/').pop() || '';
            return last.split('_')[0] || '';
        });
        summary.storageDeleted = storageDeleted;
    }
}
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
const LANG_VOICE = {
    // Indian English — warm, slightly slower than US English voices.
    'en-IN': { languageCode: 'en-IN', name: 'en-IN-Neural2-A' },
    'hi-IN': { languageCode: 'hi-IN', name: 'hi-IN-Neural2-A' },
    'bn-IN': { languageCode: 'bn-IN', name: 'bn-IN-Standard-A' },
    'ta-IN': { languageCode: 'ta-IN', name: 'ta-IN-Standard-C' },
    'te-IN': { languageCode: 'te-IN', name: 'te-IN-Standard-A' },
    'mr-IN': { languageCode: 'mr-IN', name: 'mr-IN-Standard-A' },
    'ml-IN': { languageCode: 'ml-IN', name: 'ml-IN-Standard-A' },
    'kn-IN': { languageCode: 'kn-IN', name: 'kn-IN-Standard-A' },
    'gu-IN': { languageCode: 'gu-IN', name: 'gu-IN-Standard-A' },
    'pa-IN': { languageCode: 'pa-IN', name: 'pa-IN-Standard-A' },
    'ur-IN': { languageCode: 'ur-IN', name: 'ur-IN-Standard-A' },
    // Fallbacks for plain BCP-47 short codes the client may send.
    'en': { languageCode: 'en-IN', name: 'en-IN-Neural2-A' },
    'hi': { languageCode: 'hi-IN', name: 'hi-IN-Neural2-A' },
};
const TTS_MAX_CHARS = 1200;
exports.synthesizeSpeech = functions
    .runWith({ memory: '256MB', timeoutSeconds: 30 })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Sign in to use voice playback.');
    }
    const text = String(data?.text ?? '').trim();
    const lang = String(data?.lang ?? 'en-IN').trim();
    if (!text) {
        throw new functions.https.HttpsError('invalid-argument', 'No text to speak.');
    }
    if (text.length > TTS_MAX_CHARS) {
        throw new functions.https.HttpsError('invalid-argument', `Text exceeds the ${TTS_MAX_CHARS}-char limit; trim before sending.`);
    }
    const voice = LANG_VOICE[lang] ?? LANG_VOICE['en-IN'];
    const client = new text_to_speech_1.default.TextToSpeechClient();
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
exports.onCommentCreate = functions.firestore
    .document('communityPosts/{postId}/comments/{commentId}')
    .onCreate(async (snap, context) => {
    const { postId, commentId } = context.params;
    const data = snap.data() ?? {};
    const postRef = db.doc(`communityPosts/${postId}`);
    try {
        await db.runTransaction(async (tx) => {
            const postSnap = await tx.get(postRef);
            if (!postSnap.exists)
                return;
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
    }
    catch (err) {
        console.warn(`onCommentCreate(${postId}/${commentId}) failed`, err);
    }
});
/** When a comment is deleted, decrement the parent post's commentCount
 *  and refresh lastComment to whatever the new latest is (or clear it if
 *  the post has zero comments left). */
exports.onCommentDelete = functions.firestore
    .document('communityPosts/{postId}/comments/{commentId}')
    .onDelete(async (snap, context) => {
    const { postId, commentId } = context.params;
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
            if (!postSnap.exists)
                return;
            const post = postSnap.data() ?? {};
            const nextCount = Math.max(0, (post.commentCount ?? 1) - 1);
            const updates = { commentCount: nextCount };
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
                }
                else {
                    updates.lastComment = admin.firestore.FieldValue.delete();
                    updates.lastCommentAt = admin.firestore.FieldValue.delete();
                }
            }
            tx.update(postRef, updates);
        });
    }
    catch (err) {
        console.warn(`onCommentDelete(${postId}/${commentId}) failed`, err);
    }
});
/** When a post is deleted, sweep its comments subcollection (the client
 *  also tries this but rules can deny that path; the trigger runs with
 *  admin privileges) and decrement the author's postsCount. The image
 *  blob is cleaned client-side because Storage trigger access requires
 *  a separate function deployment that we don't run yet. */
exports.onPostDelete = functions.firestore
    .document('communityPosts/{postId}')
    .onDelete(async (snap, context) => {
    const { postId } = context.params;
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
    }
    catch (err) {
        console.warn(`onPostDelete(${postId}) comment sweep failed`, err);
    }
    if (authorUid) {
        try {
            await db.doc(`publicProfiles/${authorUid}`).set({ uid: authorUid, postsCount: admin.firestore.FieldValue.increment(-1) }, { merge: true });
        }
        catch (err) {
            console.warn(`onPostDelete(${postId}) postsCount decrement failed`, err);
        }
    }
});
/** Bootstrap a publicProfile when a follow doc lands and the followee has
 *  none yet (the first-follower-of-new-user race), then bump the counters
 *  on both ends. Runs server-side so concurrent follows don't both create
 *  the doc with overlapping merges. */
exports.onFollowCreate = functions.firestore
    .document('follows/{followId}')
    .onCreate(async (snap) => {
    const data = snap.data() ?? {};
    const fromUid = data.fromUid;
    const toUid = data.toUid;
    if (!fromUid || !toUid || fromUid === toUid)
        return;
    try {
        const batch = db.batch();
        batch.set(db.doc(`publicProfiles/${toUid}`), { uid: toUid, followersCount: admin.firestore.FieldValue.increment(1) }, { merge: true });
        batch.set(db.doc(`publicProfiles/${fromUid}`), { uid: fromUid, followingCount: admin.firestore.FieldValue.increment(1) }, { merge: true });
        await batch.commit();
    }
    catch (err) {
        console.warn(`onFollowCreate(${fromUid}->${toUid}) failed`, err);
    }
});
/** Decrement counters when a follow is removed. Idempotent on the trigger
 *  itself (Cloud Functions retries) because the increment is bounded
 *  by the doc lifecycle: each delete fires onDelete exactly once. */
exports.onFollowDelete = functions.firestore
    .document('follows/{followId}')
    .onDelete(async (snap) => {
    const data = snap.data() ?? {};
    const fromUid = data.fromUid;
    const toUid = data.toUid;
    if (!fromUid || !toUid)
        return;
    try {
        const batch = db.batch();
        batch.set(db.doc(`publicProfiles/${toUid}`), { uid: toUid, followersCount: admin.firestore.FieldValue.increment(-1) }, { merge: true });
        batch.set(db.doc(`publicProfiles/${fromUid}`), { uid: fromUid, followingCount: admin.firestore.FieldValue.increment(-1) }, { merge: true });
        await batch.commit();
    }
    catch (err) {
        console.warn(`onFollowDelete(${fromUid}->${toUid}) failed`, err);
    }
});
/** Bootstrap publicProfile + notifPrefs defaults the moment a new user's
 *  Firebase Auth record is created. Eliminates the "first follower fails
 *  because the followee has no publicProfile yet" race and stops every
 *  client from racing to syncPublicProfile() on first run. */
exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
    const uid = user.uid;
    if (!uid)
        return;
    try {
        await db.doc(`publicProfiles/${uid}`).set({
            uid,
            followersCount: 0,
            followingCount: 0,
            postsCount: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    catch (err) {
        console.warn(`onUserCreated(${uid}) bootstrap failed`, err);
    }
});
/** Daily-ish counter-drift repair: walks the publicProfiles collection
 *  and re-counts followers/following/posts for every profile. Cheap
 *  enough at our scale (<1000 profiles) to run nightly without
 *  partitioning; revisit if the user count grows by a magnitude. */
exports.repairCommunityCounters = functions.pubsub
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
                if (data.followersCount !== followers.size ||
                    data.followingCount !== following.size ||
                    data.postsCount !== posts.size) {
                    await profile.ref.update({
                        followersCount: followers.size,
                        followingCount: following.size,
                        postsCount: posts.size,
                        countersRepairedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                    repaired++;
                }
            }
            catch (err) {
                console.warn(`repairCommunityCounters(${uid}) failed`, err);
            }
        }
        console.log(`repairCommunityCounters: walked ${profiles.size}, repaired ${repaired}`);
    }
    catch (err) {
        console.error('repairCommunityCounters fatal', err);
    }
});
// ── Marketing automation (Phase 2) ──────────────────────────────────────────
// Renders branded post images via Satori. Reads brand kit from Firestore,
// optionally fetches a stock photo from Pexels or generates an AI background
// via FLUX, returns the public Storage URL.
//
// Deploy:
//   firebase deploy --only functions:renderMarketingTemplate
//
// Required secrets:
//   firebase functions:secrets:set PEXELS_API_KEY
//   firebase functions:secrets:set REPLICATE_API_TOKEN
exports.renderMarketingTemplate = (0, marketing_1.buildRenderMarketingTemplate)(ADMIN_EMAILS);
// Compliance screen on every caption draft. Reads rules from
// marketing_brand/main; pure regex, no LLM. Pairs with the M1 strategy
// editor at /admin/marketing/strategy.
exports.scoreMarketingDraft = (0, marketing_1.buildScoreMarketingDraft)(ADMIN_EMAILS);
// M2 — content engine. Manual "Generate now" trigger + daily cron.
// generateMarketingDraft uses OpenAI gpt-4o-mini for caption JSON, picks an
// AI image (default Imagen) with Pexels fallback, renders the matching
// template, and writes a marketing_drafts row with status=pending_review.
exports.generateMarketingDraft = (0, marketing_1.buildGenerateMarketingDraft)(ADMIN_EMAILS);
// Daily 6am IST cron — opt-in via marketing_brand/main.cronEnabled=true.
// Same generation flow, runs as service account. Automatically skips if a
// per-date skip override is set in cronOverrides, or if a draft already
// exists for today (i.e. admin pre-generated via generateAheadDrafts).
exports.dailyMarketingDraftCron = (0, marketing_1.buildDailyMarketingDraftCron)();
// Scheduler Layer 3 — admin-callable to pre-generate drafts for the next
// N days (default 7). Each future date gets a pending_review draft in
// the normal queue. The cron skips any date that already has one.
exports.generateAheadDrafts = (0, marketing_1.buildGenerateAheadDrafts)(ADMIN_EMAILS);
// M4 — engagement / unified inbox.
//
// metaWebhookReceiver is a public HTTPS endpoint (no auth — Meta is the
// caller). Signature verification via META_APP_SECRET; GET handshake via
// META_WEBHOOK_VERIFY_TOKEN. Both must be set in functions/.env before
// Meta can subscribe.
//
// generateInboxReplies + classifyInboxThread are admin-callables that
// reuse the same OPENAI_API_KEY as the M2 caption generator.
exports.metaWebhookReceiver = (0, marketing_1.buildMetaWebhookReceiver)();
exports.generateInboxReplies = (0, marketing_1.buildGenerateInboxReplies)(ADMIN_EMAILS);
exports.classifyInboxThread = (0, marketing_1.buildClassifyInboxThread)(ADMIN_EMAILS);
// M4b — outbound reply publisher. Firestore trigger on new outbound
// messages with outboundStatus='pending_send'. Sends via IG Graph API
// (DMs + comment replies); FB Page deferred to M4c. Skips synthetic
// test threads.
exports.metaInboxReplyPublisher = (0, marketing_1.buildMetaInboxReplyPublisher)();
// M3b — scheduled draft auto-publish.
// scheduledMarketingPublisher: pubsub every 5 min, picks up drafts where
// status='scheduled' AND scheduledAt<=now, posts to IG, marks 'posted'.
// publishMarketingDraftNow: same flow but admin-callable for "Publish
// now" button on the slide-over.
exports.scheduledMarketingPublisher = (0, marketing_1.buildScheduledMarketingPublisher)();
exports.publishMarketingDraftNow = (0, marketing_1.buildPublishMarketingDraftNow)(ADMIN_EMAILS);
// M5 — analytics + feedback loop.
//
// pollMarketingInsights: every 6h cron pulls per-post Insights for posted
// drafts in the last 30d.
// pollMarketingAccountInsights: daily 03:00 IST snapshot of follower
// count + reach.
// generateWeeklyInsightDigest: Mondays 08:00 IST LLM commentary on the
// week's posts + 3 actionable recommendations.
exports.pollMarketingInsights = (0, marketing_1.buildPollMarketingInsights)();
exports.pollMarketingAccountInsights = (0, marketing_1.buildPollMarketingAccountInsights)();
exports.generateWeeklyInsightDigest = (0, marketing_1.buildGenerateWeeklyInsightDigest)();
// M6 — UGC + boost.
//
// renderUgcAsDraft: admin callable. Approved UGC submission → realStoryCard
// render → marketing_drafts/{id} with status='approved' so admin can
// publish through the existing M3 path.
// boostMarketingDraft: admin callable. Posted draft + budget + duration
// → Marketing API Campaign + AdSet + Creative + Ad. Records boost on
// the draft for ROI tracking. Requires META_AD_ACCOUNT_ID +
// META_FB_PAGE_ID + ads_management scope on the IG access token.
exports.renderUgcAsDraft = (0, marketing_1.buildRenderUgcAsDraft)(ADMIN_EMAILS);
exports.boostMarketingDraft = (0, marketing_1.buildBoostMarketingDraft)(ADMIN_EMAILS);
// Studio v2 (Phase 2) — image-gen canvas backend.
// generateStudioVariants: admin callable. Prompt + brand style profile →
// 4 parallel variants from Imagen (default) or FLUX. Uploads to Storage.
// createStudioDraft: admin callable. Picked variant + (optional) caption →
// marketing_drafts row, lands in M2's pending_review queue. Synthesizes
// caption via gpt-4o-mini if admin didn't write one.
exports.generateStudioVariants = (0, marketing_1.buildGenerateStudioVariants)(ADMIN_EMAILS);
exports.createStudioDraft = (0, marketing_1.buildCreateStudioDraft)(ADMIN_EMAILS);
exports.generateTemplatePrefill = (0, marketing_1.buildGenerateTemplatePrefill)(ADMIN_EMAILS);
// Studio v2 Phase 3 — text-edit a picked variant via gpt-image-1 edits API.
// Downloads from Storage, sends to OpenAI with brand-style guard, uploads
// the new image, returns the new URL. Caller (the canvas) replaces the
// picked variant with this one.
exports.editStudioImage = (0, marketing_1.buildEditStudioImage)(ADMIN_EMAILS);
// Studio v2 Phase 4 — upload-your-own (no AI cost). Admin sends a base64
// data URL; we decode + validate + store under marketing/studio/uploads/
// and return the public URL so the rest of the Studio flow treats it like
// any AI-generated variant.
exports.uploadStudioImage = (0, marketing_1.buildUploadStudioImage)(ADMIN_EMAILS);
// Studio v2 Phase 4 — logo overlay (no API cost). Composites the brand
// logo onto a picked Studio image via Satori + Resvg at one of the four
// corners. Returns a new Storage URL/path for the composed PNG.
exports.composeStudioLogo = (0, marketing_1.buildComposeStudioLogo)(ADMIN_EMAILS);
// Connection health probe — refreshes marketing_health/main with live IG +
// FB token validity. Hourly cron keeps the admin shell's IG/FB dots honest;
// the callable backs the "Re-check now" button in Settings.
exports.probeMarketingHealth = (0, marketing_1.buildProbeMarketingHealth)();
exports.probeMarketingHealthNow = (0, marketing_1.buildProbeMarketingHealthNow)(ADMIN_EMAILS);
// Integration Hub — admin-callable health check + config updater.
// checkIntegrationHealth probes every external API (OpenAI, Gemini,
// Replicate, Pexels, Meta IG, Meta FB, Anthropic Worker) and returns
// live per-service status. updateIntegrationConfig merges a patch object
// into app_settings/integrations and invalidates the in-process cache so
// functions pick up new keys within 5 minutes.
exports.checkIntegrationHealth = (0, integrations_1.buildCheckIntegrationHealth)(ADMIN_EMAILS);
exports.updateIntegrationConfig = (0, integrations_1.buildUpdateIntegrationConfig)(ADMIN_EMAILS);
// ── Library AI (autopilot for Articles · Books · Products) ─────────────────
// Mirrors the marketing automation pattern but writes into the existing
// `articles` / `books` / `products` Firestore collections so the live
// Library tab reads them through the same code path as manual content.
//
// Settings: app_settings/libraryAi (admin-editable from /admin/library-ai).
// Daily cron: 06:30 IST — checks each kind's frequency and fires perRun
// generations on its scheduled days.
// Expiry cron: 03:00 IST — flips `published` AI items past expiresAt to
// `archived` so admins never have to babysit stale content.
//
// Required keys (set in /admin/integrations):
//   OPENAI_API_KEY        — gpt-4o-mini for body / curation prompts
//   GEMINI_API_KEY        — Imagen for hero images / product thumbnails
//   PEXELS_API_KEY        — fallback stock photos
//   (REPLICATE_API_TOKEN  — optional, for FLUX hero images)
exports.generateArticleNow = (0, library_1.buildGenerateArticleNow)(ADMIN_EMAILS);
exports.processPendingArticleImage = (0, library_1.buildProcessPendingArticleImage)();
exports.retryArticleImage = (0, library_1.buildRetryArticleImage)(ADMIN_EMAILS);
exports.sendArticleToMarketingDraft = (0, library_1.buildSendArticleToMarketingDraft)(ADMIN_EMAILS);
exports.syncPublishedArticleToMarketingDraft = (0, library_1.buildSyncPublishedArticleToMarketingDraft)();
exports.syncArticleSocialDraft = (0, library_1.buildSyncArticleSocialDraft)();
exports.generateBooksNow = (0, library_1.buildGenerateBooksNow)(ADMIN_EMAILS);
exports.generateProductsNow = (0, library_1.buildGenerateProductsNow)(ADMIN_EMAILS);
exports.archiveLibraryItem = (0, library_1.buildArchiveLibraryItem)(ADMIN_EMAILS);
exports.dailyLibraryAiCron = (0, library_1.buildDailyLibraryAiCron)();
exports.expireStaleLibrary = (0, library_1.buildExpireStaleLibrary)();
