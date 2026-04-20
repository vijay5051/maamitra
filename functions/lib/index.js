"use strict";
/**
 * MaaMitra — push dispatcher Cloud Function
 *
 * Subscribes to `push_queue/{jobId}` writes. For each job:
 *   - personal: read target uid's fcmTokens from users/{uid}, send to each.
 *   - broadcast: query users matching the audience filter, send in batches.
 *
 * Cleans up dead tokens (FCM returns `messaging/registration-token-not-registered`)
 * by removing them from the user's array so future sends skip them.
 *
 * Deploy:
 *   firebase deploy --only functions:dispatchPush
 *
 * Required: this function uses the admin SDK which comes pre-authenticated
 * with the project's service account when deployed to Cloud Functions.
 * Nothing to configure.
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
exports.dispatchPush = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const MAX_BATCH = 500; // FCM sendEachForMulticast limit
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
                reason: 'no-tokens',
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return;
        }
        // FCM sendEachForMulticast tops out at 500 tokens per call.
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
        // Prune dead tokens from whichever user owns them.
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
async function resolveTokens(db, job) {
    if (job.kind === 'personal') {
        if (!job.toUid)
            return [];
        const doc = await db.doc(`users/${job.toUid}`).get();
        const data = doc.data();
        if (!data || data.pushEnabled === false)
            return [];
        const tokens = data.fcmTokens;
        return Array.isArray(tokens) ? tokens.filter((t) => typeof t === 'string' && t.length > 0) : [];
    }
    // Broadcast — query users matching the audience.
    let q = db.collection('users').where('pushEnabled', '==', true);
    if (job.audience === 'pregnant') {
        q = q.where('profile.stage', '==', 'pregnant');
    }
    // Newborn / toddler filters can be done client-side after fetch —
    // Firestore can't easily filter on computed "age of any kid" without
    // denormalised fields. We fall back to 'all' for those two buckets
    // until a per-kid age field is added to the user doc.
    const snap = await q.get();
    const out = [];
    snap.forEach((doc) => {
        const d = doc.data();
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
/**
 * Data must be a flat string→string map for FCM. Stringify anything
 * we accidentally left as non-strings.
 */
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
async function pruneDeadTokens(db, deadTokens) {
    // Find users holding any of the dead tokens and arrayRemove them.
    // Firestore `array-contains-any` caps at 10 values per query, so chunk.
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
