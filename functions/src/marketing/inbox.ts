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

import * as crypto from 'crypto';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

import { getIntegrationConfig } from '../lib/integrationConfig';

async function getInboxVars() {
  const cfg = await getIntegrationConfig();
  return {
    META_APP_SECRET: cfg.meta.appSecret,
    META_WEBHOOK_VERIFY_TOKEN: cfg.meta.webhookVerifyToken,
    OPENAI_API_KEY: cfg.openai.apiKey,
  };
}

// ── Caller auth (callable functions only) ─────────────────────────────────

async function callerIsMarketingAdmin(
  token: admin.auth.DecodedIdToken | undefined,
  allowList: ReadonlySet<string>,
): Promise<boolean> {
  if (!token) return false;
  if (token.admin === true) return true;
  if (token.email_verified === true && token.email && allowList.has(token.email.toLowerCase())) return true;
  if (!token.uid) return false;
  try {
    const snap = await admin.firestore().doc(`users/${token.uid}`).get();
    const role = snap.exists ? (snap.data() as any)?.adminRole : null;
    return role === 'super' || role === 'content';
  } catch {
    return false;
  }
}

// ── metaWebhookReceiver ───────────────────────────────────────────────────

export function buildMetaWebhookReceiver() {
  return functions
    .runWith({ memory: '256MB', timeoutSeconds: 30 })
    .https.onRequest(async (req, res) => {
      const { META_WEBHOOK_VERIFY_TOKEN, META_APP_SECRET } = await getInboxVars();
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
        console.warn('[metaWebhookReceiver] meta.appSecret not set, skipping signature check');
      } else {
        const rb = req.rawBody as Buffer | undefined;
        const verify = verifySignatureDiag(rb, sig, META_APP_SECRET);
        if (!verify.ok) {
          // Heavy diagnostic — full sigs + body hash + small body hex window
          // so we can post-hoc compute alternate HMAC variants if the secret
          // value or encoding is suspect.
          const bodyHash = rb ? crypto.createHash('sha256').update(rb).digest('hex') : null;
          const bodyB64 = rb && rb.length <= 4096 ? rb.toString('base64') : null; // small bodies only
          console.warn(
            '[metaWebhookReceiver] signature verification failed:',
            JSON.stringify({
              reason: verify.reason,
              headerSig256Full: sig,
              headerSig1Full: req.headers['x-hub-signature'] ?? null,
              expectedPrefix: verify.expectedPrefix ?? null,
              actualPrefix: verify.actualPrefix ?? null,
              rawBodyType: typeof rb,
              rawBodyLen: rb?.length ?? null,
              rawBodySha256: bodyHash,
              rawBodyBase64: bodyB64,
              bodyKeys: Object.keys(req.body ?? {}),
              bodyObject: (req.body as MetaWebhookBody)?.object ?? null,
              entryIds: ((req.body as MetaWebhookBody)?.entry ?? []).map((e) => e.id ?? null),
              secretLen: META_APP_SECRET.length,
              secretFirst2: META_APP_SECRET.slice(0, 2),
              secretLast2: META_APP_SECRET.slice(-2),
            }),
          );
          // Permissive mode: META_WEBHOOK_PERMISSIVE=1 in env makes us still
          // ingest the events (so the inbox keeps flowing) while we debug
          // the signature path. Default off — production behaviour stays
          // strict-reject on signature mismatch.
          if (process.env.META_WEBHOOK_PERMISSIVE === '1') {
            console.warn('[metaWebhookReceiver] permissive mode ON — ingesting despite signature mismatch');
          } else {
            res.status(403).send('signature mismatch');
            return;
          }
        }
      }

      try {
        await ingestEvents(req.body ?? {});
      } catch (e: any) {
        console.error('[metaWebhookReceiver] ingest failed', e);
        // Still 200 so Meta doesn't retry forever; we have the data in logs.
      }
      res.status(200).send('OK');
    });
}

interface VerifyDiag {
  ok: boolean;
  reason?: string;
  expectedPrefix?: string;
  actualPrefix?: string;
}

function verifySignatureDiag(rawBody: Buffer | undefined, headerSig: string, secret: string): VerifyDiag {
  if (!rawBody) return { ok: false, reason: 'rawBody-undefined' };
  if (!Buffer.isBuffer(rawBody)) return { ok: false, reason: `rawBody-not-buffer (got ${typeof rawBody})` };
  if (!headerSig) return { ok: false, reason: 'no-header-sig' };
  if (!headerSig.startsWith('sha256=')) return { ok: false, reason: 'header-sig-bad-prefix' };
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const actual = headerSig.slice('sha256='.length);
  if (expected.length !== actual.length) {
    return {
      ok: false,
      reason: `length-mismatch (expected ${expected.length}, got ${actual.length})`,
      expectedPrefix: expected.slice(0, 8),
      actualPrefix: actual.slice(0, 8),
    };
  }
  const matches = crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
  if (!matches) {
    return {
      ok: false,
      reason: 'hash-mismatch',
      expectedPrefix: expected.slice(0, 8),
      actualPrefix: actual.slice(0, 8),
    };
  }
  return { ok: true };
}

interface MetaEntryChange {
  field?: string;
  value?: any;
}

interface MetaMessagingItem {
  sender?: { id?: string };
  recipient?: { id?: string };
  message?: { mid?: string; text?: string };
  timestamp?: number;
}

interface MetaEntry {
  id?: string;
  changes?: MetaEntryChange[];   // IG comments + FB page comments come here
  messaging?: MetaMessagingItem[]; // Messenger DMs
  time?: number;
}

interface MetaWebhookBody {
  object?: 'instagram' | 'page' | 'user' | string;
  entry?: MetaEntry[];
}

async function ingestEvents(body: MetaWebhookBody): Promise<void> {
  if (!body.entry) return;
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
        if (!text) continue;
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
      if (!text) continue;
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

interface UpsertInput {
  channel: 'ig_comment' | 'ig_dm' | 'fb_comment' | 'fb_message';
  authorId: string;
  authorName: string;
  externalEventId: string;
  text: string;
  parentObjectId: string | null;
}

async function upsertThreadAndMessage(
  db: admin.firestore.Firestore,
  input: UpsertInput,
): Promise<void> {
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
  if (existingMessage.exists) return;

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

// ── generateInboxReplies (callable) ────────────────────────────────────────

interface SuggestInput { threadId?: unknown }
interface SuggestionItem { tone: string; text: string }
type SuggestResult =
  | { ok: true; suggestions: SuggestionItem[] }
  | { ok: false; code: string; message: string };

export function buildGenerateInboxReplies(allowList: ReadonlySet<string>) {
  return functions
    .runWith({ memory: '256MB', timeoutSeconds: 60 })
    .https.onCall(async (data: SuggestInput, context): Promise<SuggestResult> => {
      if (!(await callerIsMarketingAdmin(context.auth?.token, allowList))) {
        throw new functions.https.HttpsError('permission-denied', 'Admin only.');
      }
      const { OPENAI_API_KEY } = await getInboxVars();
      if (!OPENAI_API_KEY) return { ok: false, code: 'missing-key', message: 'OpenAI API key not configured — set it in the Integration Hub.' };
      const threadId = typeof data?.threadId === 'string' ? data.threadId : '';
      if (!threadId) return { ok: false, code: 'missing-thread', message: 'threadId required.' };

      const db = admin.firestore();
      const threadSnap = await db.doc(`marketing_inbox/${threadId}`).get();
      if (!threadSnap.exists) return { ok: false, code: 'no-thread', message: 'Thread not found.' };
      const thread = threadSnap.data() as any;

      const msgsSnap = await db.collection(`marketing_inbox/${threadId}/messages`).orderBy('sentAt', 'desc').limit(8).get();
      const messages = msgsSnap.docs.map((d) => d.data() as any).reverse();

      const brand = await loadBrandSnapshot();

      const transcript = messages
        .map((m) => `${m.direction === 'inbound' ? thread.authorName : 'us'}: ${m.text ?? ''}`)
        .join('\n');

      const localeInstruction =
        brand.bilingual === 'english_only'
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
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const raw = data?.choices?.[0]?.message?.content ?? '';
        const parsed = JSON.parse(raw);
        const suggestions: SuggestionItem[] = Array.isArray(parsed?.suggestions)
          ? parsed.suggestions
              .map((s: any) => ({
                tone: typeof s?.tone === 'string' ? s.tone.slice(0, 24) : '',
                text: typeof s?.text === 'string' ? s.text.trim().slice(0, 1200) : '',
              }))
              .filter((s: SuggestionItem) => s.text)
              .slice(0, 5)
          : [];
        return { ok: true, suggestions };
      } catch (e: any) {
        return { ok: false, code: 'failed', message: e?.message ?? String(e) };
      }
    });
}

// ── classifyInboxThread (callable) ─────────────────────────────────────────

interface ClassifyInput { threadId?: unknown }
type ClassifyResult =
  | { ok: true; sentiment: string; intent: string; urgency: string }
  | { ok: false; code: string; message: string };

export function buildClassifyInboxThread(allowList: ReadonlySet<string>) {
  return functions
    .runWith({ memory: '256MB', timeoutSeconds: 30 })
    .https.onCall(async (data: ClassifyInput, context): Promise<ClassifyResult> => {
      if (!(await callerIsMarketingAdmin(context.auth?.token, allowList))) {
        throw new functions.https.HttpsError('permission-denied', 'Admin only.');
      }
      const { OPENAI_API_KEY } = await getInboxVars();
      if (!OPENAI_API_KEY) return { ok: false, code: 'missing-key', message: 'OpenAI API key not configured — set it in the Integration Hub.' };
      const threadId = typeof data?.threadId === 'string' ? data.threadId : '';
      if (!threadId) return { ok: false, code: 'missing-thread', message: 'threadId required.' };

      const db = admin.firestore();
      const threadRef = db.doc(`marketing_inbox/${threadId}`);
      const threadSnap = await threadRef.get();
      if (!threadSnap.exists) return { ok: false, code: 'no-thread', message: 'Thread not found.' };
      const msgsSnap = await db.collection(`marketing_inbox/${threadId}/messages`).orderBy('sentAt', 'desc').limit(5).get();
      const messages = msgsSnap.docs.map((d) => d.data() as any).reverse();
      if (messages.length === 0) return { ok: false, code: 'empty', message: 'No messages to classify.' };
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
        if (!res.ok) return { ok: false, code: 'openai-error', message: `${res.status}: ${await res.text()}` };
        const out = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const parsed = JSON.parse(out?.choices?.[0]?.message?.content ?? '{}');
        const sentiment = ['positive', 'question', 'complaint', 'neutral', 'spam'].includes(parsed?.sentiment) ? parsed.sentiment : 'neutral';
        const intent = ['greeting', 'question_general', 'question_medical', 'praise', 'complaint', 'lead', 'spam', 'other'].includes(parsed?.intent) ? parsed.intent : 'other';
        const urgency = ['low', 'medium', 'high'].includes(parsed?.urgency) ? parsed.urgency : 'low';
        await threadRef.update({ sentiment, intent, urgency });
        return { ok: true, sentiment, intent, urgency };
      } catch (e: any) {
        return { ok: false, code: 'failed', message: e?.message ?? String(e) };
      }
    });
}

// ── Brand snapshot helper ──────────────────────────────────────────────────

interface BrandSnap {
  brandName: string;
  voiceAttributes: string[];
  forbidden: string[];
  bilingual: string;
}

async function loadBrandSnapshot(): Promise<BrandSnap> {
  const snap = await admin.firestore().doc('marketing_brand/main').get();
  const d: any = snap.exists ? snap.data() : {};
  const arr = (v: unknown): string[] => Array.isArray(v) ? v.filter((x: unknown): x is string => typeof x === 'string') : [];
  return {
    brandName: typeof d?.brandName === 'string' ? d.brandName : 'MaaMitra',
    voiceAttributes: arr(d?.voice?.attributes),
    forbidden: arr(d?.compliance?.medicalForbiddenWords).slice(0, 30),
    bilingual: typeof d?.voice?.bilingual === 'string' ? d.voice.bilingual : 'hinglish',
  };
}
