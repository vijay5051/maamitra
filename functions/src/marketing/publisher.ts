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
// FB Page support (M4c): fb_comment threads + outbound replies + feed
// posting all work via the System User token in META_FB_PAGE_ACCESS_TOKEN
// (derived to a real Page Access Token at runtime by getFbPagePat).
// fb_message (Messenger DMs) still deferred — needs pages_messaging
// scope which requires a separate App Review pass.

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

import { getIntegrationConfig } from '../lib/integrationConfig';

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

// Derives IG Graph token: prefer EAA-style Page token (works on
// graph.facebook.com IG endpoints); fall back to IG access token.
function igGraphToken(fbPageAccessToken: string, igAccessToken: string): string {
  return (fbPageAccessToken && fbPageAccessToken.startsWith('EAA'))
    ? fbPageAccessToken
    : igAccessToken;
}

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

      const publisherCfg = await getIntegrationConfig();
      if (!publisherCfg.meta.igUserId || !igGraphToken(publisherCfg.meta.fbPageAccessToken, publisherCfg.meta.igAccessToken)) {
        await snap.ref.update({ outboundStatus: 'failed', outboundError: 'IG credentials missing — configure them in the Integration Hub (Instagram User ID + access token)' });
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
        } else if (thread.channel === 'fb_comment') {
          if (!publisherCfg.meta.fbPageId || !publisherCfg.meta.fbPageAccessToken) throw new Error('FB Page credentials not configured — set them in the Integration Hub');
          const recent = await db.collection(`marketing_inbox/${threadId}/messages`)
            .where('direction', '==', 'inbound')
            .orderBy('sentAt', 'desc')
            .limit(1)
            .get();
          const externalId = recent.docs[0]?.data()?.externalId;
          if (!externalId) throw new Error('no inbound FB comment found to reply to');
          await replyToFbComment(String(externalId), text);
        } else if (thread.channel === 'fb_message') {
          throw new Error('FB Messenger DMs need pages_messaging scope (deferred — IG DMs cover most engagement)');
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
  const cfg = await getIntegrationConfig();
  const token = igGraphToken(cfg.meta.fbPageAccessToken, cfg.meta.igAccessToken);
  const url = `${GRAPH_BASE}/${cfg.meta.igUserId}/messages?access_token=${encodeURIComponent(token)}`;
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
  const cfg = await getIntegrationConfig();
  const token = igGraphToken(cfg.meta.fbPageAccessToken, cfg.meta.igAccessToken);
  const url = `${GRAPH_BASE}/${commentId}/replies?access_token=${encodeURIComponent(token)}`;
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

// META_FB_PAGE_ACCESS_TOKEN in our env is actually a **System User** token
// (debug_token reports type=SYSTEM_USER, /me returns the System User identity).
// New Pages Experience publish/comment endpoints reject System User tokens
// with "User access token is not supported. A Page access token is required
// for this call for the new Pages experience." We have to derive a real Page
// Access Token from the System User token via /me/accounts.
//
// The derived PAT is permanent (System User tokens never expire and the
// derivation has no TTL), so a cold-start memo is fine. Single in-flight
// promise prevents duplicate /me/accounts calls under concurrent invokes.
// Cache keyed by fbPageId:last8ofToken — auto-invalidated when credentials change.
let _patCache: { key: string; pat: string } | null = null;
export async function getFbPagePat(): Promise<string> {
  const cfg = await getIntegrationConfig();
  const cacheKey = `${cfg.meta.fbPageId}:${cfg.meta.fbPageAccessToken.slice(-8)}`;
  if (_patCache?.key === cacheKey) return _patCache.pat;
  _patCache = null;

  const url = `${GRAPH_BASE}/me/accounts?fields=id,access_token&access_token=${encodeURIComponent(cfg.meta.fbPageAccessToken)}`;
  const r = await fetch(url);
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as GraphErrorBody;
    throw new Error(`derive-page-token-failed: Graph ${r.status}: ${body?.error?.message ?? 'unknown'}`);
  }
  const json = await r.json() as { data?: Array<{ id?: string; access_token?: string }> };
  const match = (json.data ?? []).find((p) => p.id === cfg.meta.fbPageId);
  if (!match?.access_token) {
    throw new Error(`Page ${cfg.meta.fbPageId} not in /me/accounts response. Confirm the System User has Page asset access with MANAGE / CREATE_CONTENT tasks in Business Manager.`);
  }
  _patCache = { key: cacheKey, pat: match.access_token };
  return _patCache.pat;
}

// FB comment reply — the Graph endpoint is /{comment-id}/comments (creates
// a child comment under the parent). Requires a Page Access Token (not the
// System User token).
async function replyToFbComment(commentId: string, text: string): Promise<void> {
  if (!commentId) throw new Error('empty comment id');
  const pat = await getFbPagePat();
  const url = `${GRAPH_BASE}/${commentId}/comments?access_token=${encodeURIComponent(pat)}`;
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

// FB Page feed publish — POST to /{page-id}/photos with a public image_url
// + caption. Requires a Page Access Token (the System User token in
// META_FB_PAGE_ACCESS_TOKEN can't publish on its own under new Pages).
async function publishDraftToFacebook(draftData: Record<string, any>): Promise<{ ok: true; postId: string; permalink: string | null } | { ok: false; code: string; message: string }> {
  const cfg = await getIntegrationConfig();
  if (!cfg.meta.fbPageId || !cfg.meta.fbPageAccessToken) {
    return { ok: false, code: 'no-fb-credentials', message: 'FB Page ID / Access Token not configured — set them in the Integration Hub.' };
  }
  const imageUrl = draftData?.assets?.[0]?.url;
  const caption = String(draftData?.caption ?? '');
  if (!imageUrl) return { ok: false, code: 'no-asset', message: 'Draft has no image asset.' };
  if (!caption) return { ok: false, code: 'no-caption', message: 'Draft has no caption.' };

  let pat: string;
  try {
    pat = await getFbPagePat();
  } catch (e: any) {
    return { ok: false, code: 'no-page-token', message: e?.message ?? String(e) };
  }

  const params = new URLSearchParams({
    url: imageUrl,
    caption,
    access_token: pat,
  });
  const res = await fetch(`${GRAPH_BASE}/${cfg.meta.fbPageId}/photos`, {
    method: 'POST',
    body: params,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as GraphErrorBody;
    return { ok: false, code: 'fb-publish-failed', message: body?.error?.message ?? `Graph ${res.status}` };
  }
  const data = await res.json() as { id?: string; post_id?: string };
  // FB returns { id: photo_id, post_id: page_post_id } — we want post_id for permalink purposes.
  const postId = data?.post_id ?? data?.id;
  if (!postId) return { ok: false, code: 'no-post-id', message: 'FB photo upload returned no id.' };
  // Permalink: simplest reliable form is /{page-id}/posts/{numeric-suffix}.
  // post_id format is "{pageId}_{numericId}" — we use the page-numeric form.
  const numericSuffix = postId.includes('_') ? postId.split('_').pop() : postId;
  const permalink = `https://www.facebook.com/${cfg.meta.fbPageId}/posts/${numericSuffix}`;
  return { ok: true, postId, permalink };
}

// ── Scheduled draft publisher ──────────────────────────────────────────────

interface PublishOk { ok: true; mediaId: string; postId: string; permalink: string | null }
interface PublishErr { ok: false; code: string; message: string }
type PublishResult = PublishOk | PublishErr;

async function publishDraftToInstagram(draftId: string, draftData: Record<string, any>): Promise<PublishResult> {
  const assets = Array.isArray(draftData?.assets) ? (draftData.assets as Array<{ url?: string }>) : [];
  const caption = String(draftData?.caption ?? '');
  const isCarousel = draftData?.kind === 'carousel' || assets.length > 1;

  if (assets.length === 0 || !assets[0]?.url) return { ok: false, code: 'no-asset', message: 'Draft has no image asset.' };
  if (!caption) return { ok: false, code: 'no-caption', message: 'Draft has no caption.' };
  const cfg = await getIntegrationConfig();
  const igToken = igGraphToken(cfg.meta.fbPageAccessToken, cfg.meta.igAccessToken);
  if (!cfg.meta.igUserId || !igToken) {
    return { ok: false, code: 'no-credentials', message: 'Instagram credentials not configured — set them in the Integration Hub.' };
  }
  void draftId;

  if (isCarousel) {
    return publishCarouselToInstagram(assets.map((a) => String(a?.url ?? '')).filter(Boolean), caption);
  }

  const imageUrl = assets[0].url;
  // Step 1 — create the media container.
  const params = new URLSearchParams({
    image_url: imageUrl,
    caption,
    access_token: igToken,
  });
  const createRes = await fetch(`${GRAPH_BASE}/${cfg.meta.igUserId}/media`, {
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

  // Step 1.5 — wait for IG to finish processing the container.
  // Calling /media_publish before status_code === 'FINISHED' returns
  // "Media ID is not available" (code 9007). Per Meta's recommendation
  // we poll up to 60s with ~3s gaps.
  const statusUrl = `${GRAPH_BASE}/${mediaId}?fields=status_code,status&access_token=${encodeURIComponent(igToken)}`;
  const deadline = Date.now() + 60_000;
  let lastStatus: string | null = null;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const sRes = await fetch(statusUrl);
    if (!sRes.ok) {
      const body = (await sRes.json().catch(() => ({}))) as GraphErrorBody;
      return { ok: false, code: 'status-poll-failed', message: body?.error?.message ?? `Graph ${sRes.status}` };
    }
    const sJson = await sRes.json() as { status_code?: string; status?: string };
    lastStatus = sJson?.status_code ?? null;
    if (lastStatus === 'FINISHED') break;
    if (lastStatus === 'ERROR' || lastStatus === 'EXPIRED') {
      return { ok: false, code: 'container-error', message: `IG container ${lastStatus}: ${sJson?.status ?? 'no detail'}` };
    }
    // IN_PROGRESS / PUBLISHED — keep polling.
  }
  if (lastStatus !== 'FINISHED') {
    return { ok: false, code: 'container-timeout', message: `Container still ${lastStatus ?? 'unknown'} after 60s — try Publish again.` };
  }

  // Step 2 — publish.
  const publishParams = new URLSearchParams({ creation_id: mediaId, access_token: igToken });
  const pubRes = await fetch(`${GRAPH_BASE}/${cfg.meta.igUserId}/media_publish`, {
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
    const linkRes = await fetch(`${GRAPH_BASE}/${postId}?fields=permalink&access_token=${encodeURIComponent(igToken)}`);
    if (linkRes.ok) {
      const link = await linkRes.json() as { permalink?: string };
      permalink = typeof link?.permalink === 'string' ? link.permalink : null;
    }
  } catch {
    // Not fatal — we have the post; permalink is just nice-to-have.
  }

  return { ok: true, mediaId, postId, permalink };
}

// ── IG Carousel publish (Phase 4 item 1) ──────────────────────────────────
// Three-stage flow per Meta:
//   1. For each slide URL, POST /{ig-user-id}/media with image_url +
//      is_carousel_item=true → child container id.
//   2. Wait for every child to reach FINISHED status.
//   3. POST /{ig-user-id}/media with media_type=CAROUSEL +
//      children=child_ids + caption → parent container id, wait for it
//      to reach FINISHED, then POST /media_publish with creation_id=parent.
async function publishCarouselToInstagram(slideUrls: string[], caption: string): Promise<PublishResult> {
  if (slideUrls.length < 2 || slideUrls.length > 10) {
    return { ok: false, code: 'bad-carousel-count', message: `Carousel needs 2–10 slides, got ${slideUrls.length}.` };
  }

  // Step 1 — create one child container per slide (parallel).
  const childResults = await Promise.all(slideUrls.map(async (url, idx) => {
    const params = new URLSearchParams({
      image_url: url,
      is_carousel_item: 'true',
      access_token: IG_GRAPH_TOKEN,
    });
    const res = await fetch(`${GRAPH_BASE}/${META_IG_USER_ID}/media`, { method: 'POST', body: params });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as GraphErrorBody;
      return { ok: false as const, idx, message: body?.error?.message ?? `Graph ${res.status}` };
    }
    const j = await res.json() as { id?: string };
    if (!j?.id) return { ok: false as const, idx, message: 'Container creation returned no id.' };
    return { ok: true as const, idx, id: j.id };
  }));

  const failed = childResults.find((r) => !r.ok);
  if (failed && failed.ok === false) {
    return { ok: false, code: 'carousel-child-create-failed', message: `Slide ${failed.idx + 1}: ${failed.message}` };
  }
  const childIds = childResults.map((r) => (r.ok ? r.id : '')).filter(Boolean);

  // Step 2 — wait for every child to finish processing.
  const deadline = Date.now() + 60_000;
  for (const cid of childIds) {
    const statusUrl = `${GRAPH_BASE}/${cid}?fields=status_code,status&access_token=${encodeURIComponent(IG_GRAPH_TOKEN)}`;
    let lastStatus: string | null = null;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      const sRes = await fetch(statusUrl);
      if (!sRes.ok) {
        const body = (await sRes.json().catch(() => ({}))) as GraphErrorBody;
        return { ok: false, code: 'carousel-child-status-failed', message: body?.error?.message ?? `Graph ${sRes.status}` };
      }
      const sJson = await sRes.json() as { status_code?: string; status?: string };
      lastStatus = sJson?.status_code ?? null;
      if (lastStatus === 'FINISHED') break;
      if (lastStatus === 'ERROR' || lastStatus === 'EXPIRED') {
        return { ok: false, code: 'carousel-child-error', message: `Child ${cid} ${lastStatus}: ${sJson?.status ?? 'no detail'}` };
      }
    }
    if (lastStatus !== 'FINISHED') {
      return { ok: false, code: 'carousel-child-timeout', message: `Child ${cid} still ${lastStatus ?? 'unknown'} after 60s.` };
    }
  }

  // Step 3 — create parent CAROUSEL container.
  const parentParams = new URLSearchParams({
    media_type: 'CAROUSEL',
    children: childIds.join(','),
    caption,
    access_token: IG_GRAPH_TOKEN,
  });
  const parentRes = await fetch(`${GRAPH_BASE}/${META_IG_USER_ID}/media`, { method: 'POST', body: parentParams });
  if (!parentRes.ok) {
    const body = (await parentRes.json().catch(() => ({}))) as GraphErrorBody;
    return { ok: false, code: 'carousel-parent-create-failed', message: body?.error?.message ?? `Graph ${parentRes.status}` };
  }
  const parentJson = await parentRes.json() as { id?: string };
  const parentId = parentJson?.id;
  if (!parentId) return { ok: false, code: 'no-parent-id', message: 'Parent container returned no id.' };

  // Wait for parent FINISHED then publish.
  const parentStatusUrl = `${GRAPH_BASE}/${parentId}?fields=status_code,status&access_token=${encodeURIComponent(IG_GRAPH_TOKEN)}`;
  let parentStatus: string | null = null;
  const parentDeadline = Date.now() + 60_000;
  while (Date.now() < parentDeadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const sRes = await fetch(parentStatusUrl);
    if (!sRes.ok) break;
    const sJson = await sRes.json() as { status_code?: string };
    parentStatus = sJson?.status_code ?? null;
    if (parentStatus === 'FINISHED') break;
    if (parentStatus === 'ERROR' || parentStatus === 'EXPIRED') {
      return { ok: false, code: 'carousel-parent-error', message: `Parent ${parentStatus}` };
    }
  }
  if (parentStatus !== 'FINISHED') {
    return { ok: false, code: 'carousel-parent-timeout', message: `Parent still ${parentStatus ?? 'unknown'} after 60s.` };
  }

  const pubParams = new URLSearchParams({ creation_id: parentId, access_token: IG_GRAPH_TOKEN });
  const pubRes = await fetch(`${GRAPH_BASE}/${META_IG_USER_ID}/media_publish`, { method: 'POST', body: pubParams });
  if (!pubRes.ok) {
    const body = (await pubRes.json().catch(() => ({}))) as GraphErrorBody;
    return { ok: false, code: 'publish-failed', message: body?.error?.message ?? `Graph ${pubRes.status}` };
  }
  const pub = await pubRes.json() as { id?: string };
  const postId = pub?.id;
  if (!postId) return { ok: false, code: 'no-post-id', message: 'Publish returned no id.' };

  // Best-effort permalink fetch.
  let permalink: string | null = null;
  try {
    const linkRes = await fetch(`${GRAPH_BASE}/${postId}?fields=permalink&access_token=${encodeURIComponent(IG_GRAPH_TOKEN)}`);
    if (linkRes.ok) {
      const link = await linkRes.json() as { permalink?: string };
      permalink = typeof link?.permalink === 'string' ? link.permalink : null;
    }
  } catch {/* noop */}

  return { ok: true, mediaId: parentId, postId, permalink };
}

async function processDueDraft(draftId: string, draftData: Record<string, any>, actorEmail: string | null): Promise<PublishResult> {
  const draftRef = admin.firestore().doc(`marketing_drafts/${draftId}`);
  // IG is the primary channel (the system was IG-only originally). FB is
  // best-effort: if FB creds missing or FB publish fails, the draft still
  // reaches "posted" status from IG; the FB error is logged in
  // publishError but doesn't block.
  const igResult = await publishDraftToInstagram(draftId, draftData);
  if (!igResult.ok) {
    await draftRef.update({
      status: 'failed',
      publishError: `IG ${igResult.code}: ${igResult.message}`,
    });
    return igResult;
  }

  const permalinks: Record<string, string> = { instagram: igResult.permalink ?? '' };
  let fbWarning: string | null = null;
  let postFbPostId: string | null = null;
  const _fbCfg = await getIntegrationConfig();
  if (_fbCfg.meta.fbPageId && _fbCfg.meta.fbPageAccessToken) {
    const fbResult = await publishDraftToFacebook(draftData);
    if (fbResult.ok) {
      permalinks.facebook = fbResult.permalink ?? '';
      postFbPostId = fbResult.postId;
    } else {
      fbWarning = `FB ${fbResult.code}: ${fbResult.message}`;
      console.warn(`[processDueDraft] ${draftId} IG ok, FB failed:`, fbWarning);
    }
  }

  await draftRef.update({
    status: 'posted',
    postedAt: admin.firestore.FieldValue.serverTimestamp(),
    postPermalinks: permalinks,
    // Saved so M5's pollMarketingInsights can fetch metrics by media id.
    postIgMediaId: igResult.postId,
    ...(postFbPostId ? { postFbPostId } : {}),
    publishError: fbWarning,
    ...(actorEmail ? { publishedBy: actorEmail } : {}),
  });
  return igResult;
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
    .runWith({ memory: '512MB', timeoutSeconds: 180 })
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
      if (draftData?.status !== 'scheduled' && draftData?.status !== 'approved' && draftData?.status !== 'failed') {
        return { ok: false, code: 'wrong-status', message: `Draft status is ${draftData?.status} — only approved, scheduled, or failed drafts can be published.` };
      }

      const actorEmail = context.auth?.token?.email ?? null;
      const result = await processDueDraft(draftId, draftData, actorEmail);
      return result.ok
        ? { ok: true, postId: result.postId, permalink: result.permalink }
        : { ok: false, code: result.code, message: result.message };
    });
}
