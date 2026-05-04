// Marketing connection-health probe.
//
// Two surfaces, one probe core:
//   probeMarketingHealth     — pubsub every 1 hour. Refreshes
//                              marketing_health/main with live IG + FB
//                              token validity so the admin UI never lies
//                              about connection state.
//   probeMarketingHealthNow  — admin-only callable. Same probe core, fired
//                              by the "Re-check now" button in the
//                              Marketing Settings page.
//
// Probes are intentionally cheap — one Graph node fetch per channel — so
// hourly polling is well under any rate-limit ceiling. Errors are mapped
// to plain-English messages (`friendlyError()` on the client only handles
// our codes; this file owns the upstream mapping).

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

import { getFbPagePat } from './publisher';
import { getIntegrationConfig } from '../lib/integrationConfig';

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

async function getHealthVars() {
  const cfg = await getIntegrationConfig();
  const fbPAT = cfg.meta.fbPageAccessToken;
  return {
    META_IG_USER_ID: cfg.meta.igUserId,
    META_FB_PAGE_ID: cfg.meta.fbPageId,
    META_FB_PAGE_ACCESS_TOKEN: fbPAT,
    IG_GRAPH_TOKEN: (fbPAT && fbPAT.startsWith('EAA')) ? fbPAT : cfg.meta.igAccessToken,
    FB_CONFIGURED: !!cfg.meta.fbPageId && !!fbPAT,
  };
}

interface ChannelProbeResult {
  ok: boolean;
  checkedAt: admin.firestore.FieldValue;
  handle: string | null;
  externalId: string | null;
  error: string | null;
  errorCode: string | null;
}

interface GraphErrorBody {
  error?: { message?: string; code?: number; type?: string; error_subcode?: number };
}

async function callerIsMarketingAdmin(token: admin.auth.DecodedIdToken | undefined, allowList: ReadonlySet<string>): Promise<boolean> {
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

function noTokenResult(): ChannelProbeResult {
  return {
    ok: false,
    checkedAt: admin.firestore.FieldValue.serverTimestamp(),
    handle: null,
    externalId: null,
    error: 'No access token configured. Set the Meta env vars in functions/.env and redeploy.',
    errorCode: 'no-token',
  };
}

async function probeIg(): Promise<ChannelProbeResult> {
  const { IG_GRAPH_TOKEN, META_IG_USER_ID } = await getHealthVars();
  if (!IG_GRAPH_TOKEN || !META_IG_USER_ID) return noTokenResult();
  try {
    const url = `${GRAPH_BASE}/${META_IG_USER_ID}?fields=id,username&access_token=${encodeURIComponent(IG_GRAPH_TOKEN)}`;
    const res = await fetch(url);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as GraphErrorBody;
      const code = body?.error?.code != null ? String(body.error.code) : `http-${res.status}`;
      const msg = body?.error?.message ?? `Instagram Graph returned ${res.status}.`;
      return {
        ok: false,
        checkedAt: admin.firestore.FieldValue.serverTimestamp(),
        handle: null,
        externalId: META_IG_USER_ID,
        error: friendlyMetaMessage(msg, code),
        errorCode: code,
      };
    }
    const json = (await res.json()) as { id?: string; username?: string };
    return {
      ok: true,
      checkedAt: admin.firestore.FieldValue.serverTimestamp(),
      handle: json?.username ? `@${json.username}` : null,
      externalId: json?.id ?? META_IG_USER_ID,
      error: null,
      errorCode: null,
    };
  } catch (e: any) {
    return {
      ok: false,
      checkedAt: admin.firestore.FieldValue.serverTimestamp(),
      handle: null,
      externalId: META_IG_USER_ID,
      error: `Couldn't reach Instagram (${e?.message ?? 'network error'}).`,
      errorCode: 'fetch-failed',
    };
  }
}

async function probeFb(): Promise<ChannelProbeResult> {
  const { FB_CONFIGURED, META_FB_PAGE_ID } = await getHealthVars();
  if (!FB_CONFIGURED) return noTokenResult();
  let pat: string;
  try {
    pat = await getFbPagePat();
  } catch (e: any) {
    return {
      ok: false,
      checkedAt: admin.firestore.FieldValue.serverTimestamp(),
      handle: null,
      externalId: META_FB_PAGE_ID,
      error: 'System User token is missing Page asset access. Re-assign in Business Manager → Users → System Users.',
      errorCode: 'no-page-token',
    };
  }
  try {
    const url = `${GRAPH_BASE}/${META_FB_PAGE_ID}?fields=id,name&access_token=${encodeURIComponent(pat)}`;
    const res = await fetch(url);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as GraphErrorBody;
      const code = body?.error?.code != null ? String(body.error.code) : `http-${res.status}`;
      const msg = body?.error?.message ?? `Facebook Graph returned ${res.status}.`;
      return {
        ok: false,
        checkedAt: admin.firestore.FieldValue.serverTimestamp(),
        handle: null,
        externalId: META_FB_PAGE_ID,
        error: friendlyMetaMessage(msg, code),
        errorCode: code,
      };
    }
    const json = (await res.json()) as { id?: string; name?: string };
    return {
      ok: true,
      checkedAt: admin.firestore.FieldValue.serverTimestamp(),
      handle: json?.name ?? null,
      externalId: json?.id ?? META_FB_PAGE_ID,
      error: null,
      errorCode: null,
    };
  } catch (e: any) {
    return {
      ok: false,
      checkedAt: admin.firestore.FieldValue.serverTimestamp(),
      handle: null,
      externalId: META_FB_PAGE_ID,
      error: `Couldn't reach Facebook (${e?.message ?? 'network error'}).`,
      errorCode: 'fetch-failed',
    };
  }
}

function friendlyMetaMessage(rawMessage: string, code: string): string {
  // Common Meta error codes — mapped to actionable plain-English copy.
  // Anything we don't recognise falls through to the raw upstream message.
  switch (code) {
    case '190':
      return 'Access token expired or revoked. Re-mint and update functions/.env.';
    case '10':
    case '200':
      return 'Token is missing the required permission. Re-check the System User asset assignments.';
    case '4':
    case '17':
    case '32':
      return 'Hit Graph API rate limit. Will recover automatically.';
    default:
      return rawMessage.length > 200 ? rawMessage.slice(0, 200) + '…' : rawMessage;
  }
}

async function runProbeAndWrite(): Promise<{ ig: ChannelProbeResult; fb: ChannelProbeResult }> {
  const [ig, fb] = await Promise.all([probeIg(), probeFb()]);
  await admin.firestore().doc('marketing_health/main').set({
    ig,
    fb,
    lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { ig, fb };
}

export function buildProbeMarketingHealth() {
  return functions
    .runWith({ memory: '256MB', timeoutSeconds: 60 })
    .pubsub.schedule('every 1 hours')
    .onRun(async () => {
      const out = await runProbeAndWrite();
      console.log(`[probeMarketingHealth] ig=${out.ig.ok ? 'ok' : out.ig.errorCode} fb=${out.fb.ok ? 'ok' : out.fb.errorCode}`);
      return null;
    });
}

interface ProbeNowResponse {
  ok: true;
  ig: { ok: boolean; handle: string | null; error: string | null };
  fb: { ok: boolean; handle: string | null; error: string | null };
}

export function buildProbeMarketingHealthNow(allowList: ReadonlySet<string>) {
  return functions
    .runWith({ memory: '256MB', timeoutSeconds: 30 })
    .https.onCall(async (_data, context): Promise<ProbeNowResponse> => {
      if (!(await callerIsMarketingAdmin(context.auth?.token, allowList))) {
        throw new functions.https.HttpsError('permission-denied', 'Admins only.');
      }
      const out = await runProbeAndWrite();
      return {
        ok: true,
        ig: { ok: out.ig.ok, handle: out.ig.handle, error: out.ig.error },
        fb: { ok: out.fb.ok, handle: out.fb.handle, error: out.fb.error },
      };
    });
}
