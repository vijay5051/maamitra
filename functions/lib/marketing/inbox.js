"use strict";
// Inbox functions (M4).
//
// metaWebhookReceiver  — public HTTPS endpoint Meta pings on
//                        comments/DMs/mentions. GET handshake +
//                        POST event ingestion with HMAC-SHA256
//                        signature verification.
//
// generateInboxReplies — admin-callable. OpenAI gpt-4o-mini gives
//                        3 distinct draft replies in brand voice.
//
// classifyInboxThread  — admin-callable. OpenAI gpt-4o-mini tags
//                        the thread's sentiment + intent + urgency.
//                        Updates marketing_inbox/{threadId}.
//
// Note: until Meta App Review approves the webhook subscription,
// Meta won't actually fire to this endpoint. The endpoint and
// signature verification still work — you can test it manually
// with curl + a known signing key (see HANDOFF for setup).
//
// Required env vars (functions/.env):
//   META_APP_SECRET           — Meta app secret for HMAC verification
//   META_WEBHOOK_VERIFY_TOKEN — admin-chosen string echoed in dashboard
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
exports.buildMetaWebhookReceiver = buildMetaWebhookReceiver;
exports.buildGenerateInboxReplies = buildGenerateInboxReplies;
exports.buildClassifyInboxThread = buildClassifyInboxThread;
const crypto = __importStar(require("crypto"));
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const META_APP_SECRET = process.env.META_APP_SECRET ?? '';
const META_WEBHOOK_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
// ── Caller auth (callable functions only) ─────────────────────────────────
async function callerIsMarketingAdmin(token, allowList) {
    if (!token)
        return false;
    if (token.admin === true)
        return true;
    if (token.email_verified === true && token.email && allowList.has(token.email.toLowerCase()))
        return true;
    if (!token.uid)
        return false;
    try {
        const snap = await admin.firestore().doc(`users/${token.uid}`).get();
        const role = snap.exists ? snap.data()?.adminRole : null;
        return role === 'super' || role === 'content';
    }
    catch {
        return false;
    }
}
// ── metaWebhookReceiver ───────────────────────────────────────────────────
function buildMetaWebhookReceiver() {
    return functions
        .runWith({ memory: '256MB', timeoutSeconds: 30 })
        .https.onRequest(async (req, res) => {
        // GET = subscription handshake. Meta sends ?hub.mode=subscribe&
        // hub.verify_token=...&hub.challenge=... — we echo the challenge
        // only if the token matches what we configured.
        if (req.method === 'GET') {
            const mode = req.query['hub.mode'];
            const token = req.query['hub.verify_token'];
            const challenge = req.query['hub.challenge'];
            if (!META_WEBHOOK_VERIFY_TOKEN) {
                res.status(503).send('webhook not configured');
                return;
            }
            if (mode === 'subscribe' && token === META_WEBHOOK_VERIFY_TOKEN) {
                res.status(200).send(String(challenge ?? ''));
                return;
            }
            res.status(403).send('verify_token mismatch');
            return;
        }
        if (req.method !== 'POST') {
            res.status(405).send('method not allowed');
            return;
        }
        // Signature verification — Meta signs the raw body with the App Secret
        // using HMAC-SHA256, sent as `X-Hub-Signature-256: sha256=<hex>`.
        const sig = String(req.headers['x-hub-signature-256'] ?? '');
        if (!META_APP_SECRET) {
            // Webhook isn't fully configured — accept but log. Returning 200
            // matters because Meta retries on non-200.
            console.warn('[metaWebhookReceiver] META_APP_SECRET not set, skipping signature check');
        }
        else if (!verifySignature(req.rawBody, sig, META_APP_SECRET)) {
            console.warn('[metaWebhookReceiver] signature verification failed');
            res.status(403).send('signature mismatch');
            return;
        }
        try {
            await ingestEvents(req.body ?? {});
        }
        catch (e) {
            console.error('[metaWebhookReceiver] ingest failed', e);
            // Still 200 so Meta doesn't retry forever; we have the data in logs.
        }
        res.status(200).send('OK');
    });
}
function verifySignature(rawBody, headerSig, secret) {
    if (!rawBody || !headerSig.startsWith('sha256='))
        return false;
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const actual = headerSig.slice('sha256='.length);
    // timingSafeEqual requires equal-length buffers.
    if (expected.length !== actual.length)
        return false;
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
}
async function ingestEvents(body) {
    if (!body.entry)
        return;
    const db = admin.firestore();
    for (const entry of body.entry) {
        // ── Instagram + FB comments (delivered as `changes`) ───────────────────
        for (const change of entry.changes ?? []) {
            if (change.field === 'comments' || change.field === 'feed') {
                const v = change.value ?? {};
                const channel = body.object === 'instagram' ? 'ig_comment' : 'fb_comment';
                const externalId = String(v?.id ?? `${entry.id}_${Date.now()}`);
                const authorId = String(v?.from?.id ?? v?.from?.username ?? 'unknown');
                const authorName = String(v?.from?.username ?? v?.from?.name ?? 'Unknown');
                const text = String(v?.text ?? v?.message ?? '');
                if (!text)
                    continue;
                await upsertThreadAndMessage(db, {
                    channel,
                    authorId,
                    authorName,
                    externalEventId: externalId,
                    text,
                    // Try to link to a draft if Meta gave us the post ID we created.
                    parentObjectId: typeof v?.media?.id === 'string' ? v.media.id : null,
                });
            }
        }
        // ── Messenger / IG DMs (delivered as `messaging`) ──────────────────────
        for (const m of entry.messaging ?? []) {
            const text = String(m?.message?.text ?? '');
            if (!text)
                continue;
            const channel = body.object === 'instagram' ? 'ig_dm' : 'fb_message';
            const senderId = String(m?.sender?.id ?? 'unknown');
            const externalId = String(m?.message?.mid ?? `${senderId}_${m?.timestamp ?? Date.now()}`);
            await upsertThreadAndMessage(db, {
                channel,
                authorId: senderId,
                authorName: senderId,
                externalEventId: externalId,
                text,
                parentObjectId: null,
            });
        }
    }
}
async function upsertThreadAndMessage(db, input) {
    // Threading: comments thread on (channel, authorId, parentObjectId);
    // DMs thread on (channel, authorId).
    const threadKey = input.parentObjectId
        ? `${input.channel}_${input.authorId}_${input.parentObjectId}`
        : `${input.channel}_${input.authorId}`;
    // Use a deterministic doc id so re-deliveries don't double-thread.
    const threadId = crypto.createHash('sha1').update(threadKey).digest('hex').slice(0, 20);
    const threadRef = db.collection('marketing_inbox').doc(threadId);
    const messageRef = threadRef.collection('messages').doc(input.externalEventId);
    // Idempotency — if this Meta event ID already exists, bail.
    const existingMessage = await messageRef.get();
    if (existingMessage.exists)
        return;
    await messageRef.set({
        direction: 'inbound',
        text: input.text,
        attachments: [],
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        sentBy: null,
        fromSuggestion: false,
        externalId: input.externalEventId,
    });
    await threadRef.set({
        channel: input.channel,
        status: 'unread',
        sentiment: 'neutral',
        intent: 'other',
        urgency: 'low',
        authorName: input.authorName,
        authorExternalId: input.authorId,
        preview: input.text.slice(0, 120),
        unreadCount: admin.firestore.FieldValue.increment(1),
        lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
        draftId: input.parentObjectId,
        isSynthetic: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
}
function buildGenerateInboxReplies(allowList) {
    return functions
        .runWith({ memory: '256MB', timeoutSeconds: 60 })
        .https.onCall(async (data, context) => {
        if (!(await callerIsMarketingAdmin(context.auth?.token, allowList))) {
            throw new functions.https.HttpsError('permission-denied', 'Admin only.');
        }
        if (!OPENAI_API_KEY)
            return { ok: false, code: 'missing-key', message: 'OPENAI_API_KEY not set in functions/.env.' };
        const threadId = typeof data?.threadId === 'string' ? data.threadId : '';
        if (!threadId)
            return { ok: false, code: 'missing-thread', message: 'threadId required.' };
        const db = admin.firestore();
        const threadSnap = await db.doc(`marketing_inbox/${threadId}`).get();
        if (!threadSnap.exists)
            return { ok: false, code: 'no-thread', message: 'Thread not found.' };
        const thread = threadSnap.data();
        const msgsSnap = await db.collection(`marketing_inbox/${threadId}/messages`).orderBy('sentAt', 'desc').limit(8).get();
        const messages = msgsSnap.docs.map((d) => d.data()).reverse();
        const brand = await loadBrandSnapshot();
        const transcript = messages
            .map((m) => `${m.direction === 'inbound' ? thread.authorName : 'us'}: ${m.text ?? ''}`)
            .join('\n');
        const localeInstruction = brand.bilingual === 'english_only'
            ? 'Reply in English only.'
            : brand.bilingual === 'hinglish'
                ? 'Reply in natural Hinglish (English with comfortable Hindi words mixed in, Latin script).'
                : 'Reply in English with occasional Devanagari accent words for emphasis.';
        const system = [
            `You are the social-channel responder for ${brand.brandName}, an Indian motherhood platform.`,
            `Brand voice: ${brand.voiceAttributes.join(', ') || 'warm, honest, judgement-free'}.`,
            `Avoid these words/phrases (medical / over-claim risk): ${brand.forbidden.join(', ') || 'none'}.`,
            localeInstruction,
            'Rules:',
            '- Address moms warmly. Acknowledge feelings before answering.',
            '- For health questions: NEVER give specific medical advice. Suggest seeing a paediatrician + share general info.',
            '- Keep replies short — 2-4 sentences max for DMs/comments.',
            '- For complaints: apologise sincerely, offer concrete next step.',
            '- For praise: thank genuinely, no hard-sell.',
            '- For spam: do not reply (return empty array).',
            'Output STRICT JSON only — no prose outside the JSON.',
        ].join('\n');
        const user = [
            `Channel: ${thread.channel}`,
            `Sentiment: ${thread.sentiment ?? 'neutral'} · intent: ${thread.intent ?? 'other'} · urgency: ${thread.urgency ?? 'low'}`,
            `Author: ${thread.authorName}`,
            '',
            'Conversation so far (oldest → newest):',
            transcript,
            '',
            'Generate THREE distinct draft replies. Different tones:',
            '1. warm — emphasises empathy + connection',
            '2. informative — leads with practical info',
            '3. concise — under 200 chars, conversational',
            '',
            'Return JSON:',
            '{ "suggestions": [ { "tone": "warm", "text": "..." }, { "tone": "informative", "text": "..." }, { "tone": "concise", "text": "..." } ] }',
        ].join('\n');
        try {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: system },
                        { role: 'user', content: user },
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.6,
                    max_tokens: 500,
                }),
            });
            if (!res.ok) {
                return { ok: false, code: 'openai-error', message: `${res.status}: ${await res.text()}` };
            }
            const data = (await res.json());
            const raw = data?.choices?.[0]?.message?.content ?? '';
            const parsed = JSON.parse(raw);
            const suggestions = Array.isArray(parsed?.suggestions)
                ? parsed.suggestions
                    .map((s) => ({
                    tone: typeof s?.tone === 'string' ? s.tone.slice(0, 24) : '',
                    text: typeof s?.text === 'string' ? s.text.trim().slice(0, 1200) : '',
                }))
                    .filter((s) => s.text)
                    .slice(0, 5)
                : [];
            return { ok: true, suggestions };
        }
        catch (e) {
            return { ok: false, code: 'failed', message: e?.message ?? String(e) };
        }
    });
}
function buildClassifyInboxThread(allowList) {
    return functions
        .runWith({ memory: '256MB', timeoutSeconds: 30 })
        .https.onCall(async (data, context) => {
        if (!(await callerIsMarketingAdmin(context.auth?.token, allowList))) {
            throw new functions.https.HttpsError('permission-denied', 'Admin only.');
        }
        if (!OPENAI_API_KEY)
            return { ok: false, code: 'missing-key', message: 'OPENAI_API_KEY not set in functions/.env.' };
        const threadId = typeof data?.threadId === 'string' ? data.threadId : '';
        if (!threadId)
            return { ok: false, code: 'missing-thread', message: 'threadId required.' };
        const db = admin.firestore();
        const threadRef = db.doc(`marketing_inbox/${threadId}`);
        const threadSnap = await threadRef.get();
        if (!threadSnap.exists)
            return { ok: false, code: 'no-thread', message: 'Thread not found.' };
        const msgsSnap = await db.collection(`marketing_inbox/${threadId}/messages`).orderBy('sentAt', 'desc').limit(5).get();
        const messages = msgsSnap.docs.map((d) => d.data()).reverse();
        if (messages.length === 0)
            return { ok: false, code: 'empty', message: 'No messages to classify.' };
        const transcript = messages
            .map((m) => `${m.direction === 'inbound' ? 'user' : 'us'}: ${m.text ?? ''}`)
            .join('\n');
        const system = [
            'You classify a social-media inbox thread for an Indian motherhood platform.',
            'Output STRICT JSON only.',
        ].join('\n');
        const user = [
            'Conversation:',
            transcript,
            '',
            'Classify with three labels:',
            '- sentiment: one of "positive" | "question" | "complaint" | "neutral" | "spam"',
            '- intent:    one of "greeting" | "question_general" | "question_medical" | "praise" | "complaint" | "lead" | "spam" | "other"',
            '- urgency:   one of "low" | "medium" | "high". HIGH if message hints at: baby in distress, medical emergency, self-harm, abuse, app data loss, public complaint amplification.',
            '',
            'Return JSON:',
            '{ "sentiment": "...", "intent": "...", "urgency": "..." }',
        ].join('\n');
        try {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: system },
                        { role: 'user', content: user },
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.1,
                    max_tokens: 100,
                }),
            });
            if (!res.ok)
                return { ok: false, code: 'openai-error', message: `${res.status}: ${await res.text()}` };
            const out = (await res.json());
            const parsed = JSON.parse(out?.choices?.[0]?.message?.content ?? '{}');
            const sentiment = ['positive', 'question', 'complaint', 'neutral', 'spam'].includes(parsed?.sentiment) ? parsed.sentiment : 'neutral';
            const intent = ['greeting', 'question_general', 'question_medical', 'praise', 'complaint', 'lead', 'spam', 'other'].includes(parsed?.intent) ? parsed.intent : 'other';
            const urgency = ['low', 'medium', 'high'].includes(parsed?.urgency) ? parsed.urgency : 'low';
            await threadRef.update({ sentiment, intent, urgency });
            return { ok: true, sentiment, intent, urgency };
        }
        catch (e) {
            return { ok: false, code: 'failed', message: e?.message ?? String(e) };
        }
    });
}
async function loadBrandSnapshot() {
    const snap = await admin.firestore().doc('marketing_brand/main').get();
    const d = snap.exists ? snap.data() : {};
    const arr = (v) => Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
    return {
        brandName: typeof d?.brandName === 'string' ? d.brandName : 'MaaMitra',
        voiceAttributes: arr(d?.voice?.attributes),
        forbidden: arr(d?.compliance?.medicalForbiddenWords).slice(0, 30),
        bilingual: typeof d?.voice?.bilingual === 'string' ? d.voice.bilingual : 'hinglish',
    };
}
