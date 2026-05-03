// Marketing publisher (M3b + M4b).
//
// M4b — outbound inbox replies:
//   metaInboxReplyPublisher (Firestore trigger). Watches new outbound
//   messages with outboundStatus='pending_send'. Sends via IG Graph API
//   and flips status to 'sent' or 'failed'.
//
// M3b — scheduled draft auto-publish:
//   scheduledMarketingPublisher (pubsub, every 5 min). Finds drafts
//   where status='scheduled' AND scheduledAt<=now() and posts to IG.
//
//   publishMarketingDraftNow (admin callable). Same publish path but
//   fires immediately — used by "Publish now" button on slide-over.
//
// All paths skip synthetic threads/drafts (isSynthetic=true) — those
// are admin-injected test data.
//
// FB Page (channels fb_message + fb_comment, plus FB feed posts) is
// deferred to M4c — needs a separate Page access token + Page ID.
// IG-only path covers ~95% of the use case.

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

const META_IG_USER_ID = process.env.META_IG_USER_ID ?? '';
const META_IG_ACCESS_TOKEN = process.env.META_IG_ACCESS_TOKEN ?? '';
const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

interface GraphErrorBody {
  error?: { message?: string; type?: string; code?: number };
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

// ── Inbox outbound publisher ──────────────────────────────────────────────

export function buildMetaInboxReplyPublisher() {
  return functions
    .runWith({ memory: '256MB', timeoutSeconds: 30 })
    .firestore.document('marketing_inbox/{threadId}/messages/{messageId}')
    .onCreate(async (snap, context) => {
      const data = snap.data() as Record<string, any>;
      if (data?.direction !== 'outbound') return null;
      if (data?.outboundStatus !== 'pending_send') return null;

      const threadId = context.params.threadId;
      const messageId = context.params.messageId;
      const text = String(data?.text ?? '');

      const db = admin.firestore();
      const threadSnap = await db.doc(`marketing_inbox/${threadId}`).get();
      if (!threadSnap.exists) {
        await snap.ref.update({ outboundStatus: 'failed', outboundError: 'thread not found' });
        return null;
      }
      const thread = threadSnap.data() as Record<string, any>;

      // Skip synthetic threads — they're admin test data, not real Meta
      // conversations. Mark as 'sent' so the UI stops nagging.
      if (thread?.isSynthetic === true) {
        await snap.ref.update({ outboundStatus: 'sent', outboundError: null });
        return null;
      }

      if (!META_IG_USER_ID || !META_IG_ACCESS_TOKEN) {
        await snap.ref.update({ outboundStatus: 'failed', outboundError: 'IG credentials missing in functions/.env' });
        return null;
      }

      try {
        if (thread.channel === 'ig_dm') {
          await sendIgDirectMessage(String(thread.authorExternalId ?? ''), text);
        } else if (thread.channel === 'ig_comment') {
          // Reply to the most recent inbound comment (using its Meta event id).
          const recent = await db.collection(`marketing_inbox/${threadId}/messages`)
            .where('direction', '==', 'inbound')
            .orderBy('sentAt', 'desc')
            .limit(1)
            .get();
          const externalId = recent.docs[0]?.data()?.externalId;
          if (!externalId) throw new Error('no inbound comment found to reply to');
          await replyToIgComment(String(externalId), text);
        } else if (thread.channel === 'fb_message' || thread.channel === 'fb_comment') {
          throw new Error('FB Page channel deferred to M4c — needs Page access token');
        } else {
          throw new Error(`unsupported channel: ${thread.channel}`);
        }
        await snap.ref.update({ outboundStatus: 'sent', outboundError: null });
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        console.warn(`[metaInboxReplyPublisher] thread=${threadId} message=${messageId} failed:`, msg);
        await snap.ref.update({ outboundStatus: 'failed', outboundError: msg.slice(0, 400) });
      }
      return null;
    });
}

async function sendIgDirectMessage(recipientId: string, text: string): Promise<void> {
  if (!recipientId) throw new Error('empty recipient id');
  const url = `${GRAPH_BASE}/${META_IG_USER_ID}/messages?access_token=${encodeURIComponent(META_IG_ACCESS_TOKEN)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as GraphErrorBody;
    throw new Error(`Graph ${res.status}: ${body?.error?.message ?? 'unknown'}`);
  }
}

async function replyToIgComment(commentId: string, text: string): Promise<void> {
  if (!commentId) throw new Error('empty comment id');
  const url = `${GRAPH_BASE}/${commentId}/replies?access_token=${encodeURIComponent(META_IG_ACCESS_TOKEN)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as GraphErrorBody;
    throw new Error(`Graph ${res.status}: ${body?.error?.message ?? 'unknown'}`);
  }
}

// ── Scheduled draft publisher ──────────────────────────────────────────────

interface PublishOk { ok: true; mediaId: string; postId: string; permalink: string | null }
interface PublishErr { ok: false; code: string; message: string }
type PublishResult = PublishOk | PublishErr;

async function publishDraftToInstagram(draftId: string, draftData: Record<string, any>): Promise<PublishResult> {
  const imageUrl = draftData?.assets?.[0]?.url;
  const caption = String(draftData?.caption ?? '');
  if (!imageUrl) return { ok: false, code: 'no-asset', message: 'Draft has no image asset.' };
  if (!caption) return { ok: false, code: 'no-caption', message: 'Draft has no caption.' };
  if (!META_IG_USER_ID || !META_IG_ACCESS_TOKEN) {
    return { ok: false, code: 'no-credentials', message: 'META_IG_USER_ID / META_IG_ACCESS_TOKEN not set in functions/.env.' };
  }

  // Step 1 — create the media container.
  const params = new URLSearchParams({
    image_url: imageUrl,
    caption,
    access_token: META_IG_ACCESS_TOKEN,
  });
  const createRes = await fetch(`${GRAPH_BASE}/${META_IG_USER_ID}/media`, {
    method: 'POST',
    body: params,
  });
  if (!createRes.ok) {
    const body = (await createRes.json().catch(() => ({}))) as GraphErrorBody;
    return { ok: false, code: 'media-create-failed', message: body?.error?.message ?? `Graph ${createRes.status}` };
  }
  const create = await createRes.json() as { id?: string };
  const mediaId = create?.id;
  if (!mediaId) return { ok: false, code: 'no-media-id', message: 'Container creation returned no id.' };

  // Step 2 — publish.
  const publishParams = new URLSearchParams({ creation_id: mediaId, access_token: META_IG_ACCESS_TOKEN });
  const pubRes = await fetch(`${GRAPH_BASE}/${META_IG_USER_ID}/media_publish`, {
    method: 'POST',
    body: publishParams,
  });
  if (!pubRes.ok) {
    const body = (await pubRes.json().catch(() => ({}))) as GraphErrorBody;
    return { ok: false, code: 'publish-failed', message: body?.error?.message ?? `Graph ${pubRes.status}` };
  }
  const pub = await pubRes.json() as { id?: string };
  const postId = pub?.id;
  if (!postId) return { ok: false, code: 'no-post-id', message: 'Publish returned no id.' };

  // Step 3 — best-effort permalink fetch.
  let permalink: string | null = null;
  try {
    const linkRes = await fetch(`${GRAPH_BASE}/${postId}?fields=permalink&access_token=${encodeURIComponent(META_IG_ACCESS_TOKEN)}`);
    if (linkRes.ok) {
      const link = await linkRes.json() as { permalink?: string };
      permalink = typeof link?.permalink === 'string' ? link.permalink : null;
    }
  } catch {
    // Not fatal — we have the post; permalink is just nice-to-have.
  }

  return { ok: true, mediaId, postId, permalink };
}

async function processDueDraft(draftId: string, draftData: Record<string, any>, actorEmail: string | null): Promise<PublishResult> {
  const draftRef = admin.firestore().doc(`marketing_drafts/${draftId}`);
  const result = await publishDraftToInstagram(draftId, draftData);
  if (result.ok) {
    await draftRef.update({
      status: 'posted',
      postedAt: admin.firestore.FieldValue.serverTimestamp(),
      postPermalinks: { instagram: result.permalink ?? '' },
      publishError: null,
      ...(actorEmail ? { publishedBy: actorEmail } : {}),
    });
  } else {
    await draftRef.update({
      status: 'failed',
      publishError: `${result.code}: ${result.message}`,
    });
  }
  return result;
}

// ── Pubsub cron — every 5 min ──────────────────────────────────────────────

export function buildScheduledMarketingPublisher() {
  return functions
    .runWith({ memory: '512MB', timeoutSeconds: 300 })
    .pubsub.schedule('every 5 minutes')
    .onRun(async () => {
      const db = admin.firestore();

      // Crisis-pause + cron-toggle — same gate as M2 daily cron.
      const brandSnap = await db.doc('marketing_brand/main').get();
      const brand = (brandSnap.exists ? brandSnap.data() : {}) as any;
      if (brand?.crisisPaused === true) {
        console.log('[scheduledMarketingPublisher] crisis pause active — skipping cycle');
        return null;
      }

      const nowIso = new Date().toISOString();
      const due = await db
        .collection('marketing_drafts')
        .where('status', '==', 'scheduled')
        .where('scheduledAt', '<=', nowIso)
        .limit(20)
        .get();

      if (due.empty) {
        console.log('[scheduledMarketingPublisher] no due drafts');
        return null;
      }

      console.log(`[scheduledMarketingPublisher] processing ${due.size} drafts`);
      for (const docSnap of due.docs) {
        const data = docSnap.data() as Record<string, any>;
        // Synthetic / test guard — never auto-publish.
        if (data?.isSynthetic === true) continue;
        try {
          const r = await processDueDraft(docSnap.id, data, null);
          console.log(`[scheduledMarketingPublisher] draft=${docSnap.id} → ${r.ok ? 'posted' : `failed: ${r.message}`}`);
        } catch (e: any) {
          console.error(`[scheduledMarketingPublisher] draft=${docSnap.id} threw`, e);
          await db.doc(`marketing_drafts/${docSnap.id}`).update({
            status: 'failed',
            publishError: `unhandled: ${e?.message ?? String(e)}`.slice(0, 400),
          });
        }
      }
      return null;
    });
}

// ── Manual publish-now (callable) ─────────────────────────────────────────

interface PublishNowInput { draftId?: unknown }
type PublishNowResult =
  | { ok: true; postId: string; permalink: string | null }
  | { ok: false; code: string; message: string };

export function buildPublishMarketingDraftNow(allowList: ReadonlySet<string>) {
  return functions
    .runWith({ memory: '512MB', timeoutSeconds: 60 })
    .https.onCall(async (data: PublishNowInput, context): Promise<PublishNowResult> => {
      if (!(await callerIsMarketingAdmin(context.auth?.token, allowList))) {
        throw new functions.https.HttpsError('permission-denied', 'Admin only.');
      }
      const draftId = typeof data?.draftId === 'string' ? data.draftId : '';
      if (!draftId) return { ok: false, code: 'missing-draft', message: 'draftId required.' };

      const db = admin.firestore();
      const draftSnap = await db.doc(`marketing_drafts/${draftId}`).get();
      if (!draftSnap.exists) return { ok: false, code: 'no-draft', message: 'Draft not found.' };
      const draftData = draftSnap.data() as Record<string, any>;
      if (draftData?.status !== 'scheduled' && draftData?.status !== 'approved') {
        return { ok: false, code: 'wrong-status', message: `Draft status is ${draftData?.status} — only scheduled or approved drafts can be published.` };
      }

      const actorEmail = context.auth?.token?.email ?? null;
      const result = await processDueDraft(draftId, draftData, actorEmail);
      return result.ok
        ? { ok: true, postId: result.postId, permalink: result.permalink }
        : { ok: false, code: result.code, message: result.message };
    });
}
