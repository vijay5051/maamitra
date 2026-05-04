// Integration health checker (admin callable).
//
// checkIntegrationHealth — probes every external API the app uses and
// returns a per-service ok/error map. Used by the Integration Hub page in
// the admin panel to show live connection status without the admin having
// to check each provider dashboard manually.
//
// Probes are intentionally lightweight — one cheap authenticated request per
// service — so the function stays well within its 30s timeout even when
// all services are slow.

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

import { getIntegrationConfig, invalidateIntegrationConfigCache } from './lib/integrationConfig';

async function callerIsAdmin(
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

interface ServiceResult {
  ok: boolean;
  latencyMs: number;
  detail: string | null;
  error: string | null;
}

async function probe(fn: () => Promise<string | null>): Promise<ServiceResult> {
  const t0 = Date.now();
  try {
    const detail = await fn();
    return { ok: true, latencyMs: Date.now() - t0, detail, error: null };
  } catch (e: any) {
    return { ok: false, latencyMs: Date.now() - t0, detail: null, error: truncate(e?.message ?? String(e)) };
  }
}

function truncate(s: string, max = 200): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

async function probeOpenAI(apiKey: string): Promise<string | null> {
  if (!apiKey) throw new Error('API key not configured.');
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as any;
    throw new Error(`HTTP ${res.status}: ${body?.error?.message ?? res.statusText}`);
  }
  const json = await res.json() as { data?: Array<{ id: string }> };
  const count = json?.data?.length ?? 0;
  return `Connected — ${count} models visible`;
}

async function probeGemini(apiKey: string): Promise<string | null> {
  if (!apiKey) throw new Error('API key not configured.');
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=5`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as any;
    throw new Error(`HTTP ${res.status}: ${body?.error?.message ?? res.statusText}`);
  }
  const json = await res.json() as { models?: any[] };
  const count = json?.models?.length ?? 0;
  return `Connected — ${count}+ models visible`;
}

async function probeReplicate(apiToken: string): Promise<string | null> {
  if (!apiToken) throw new Error('API token not configured.');
  const res = await fetch('https://api.replicate.com/v1/account', {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as any;
    throw new Error(`HTTP ${res.status}: ${body?.detail ?? res.statusText}`);
  }
  const json = await res.json() as { username?: string; type?: string };
  return `Connected — ${json?.username ?? 'account'} (${json?.type ?? 'user'})`;
}

async function probePexels(apiKey: string): Promise<string | null> {
  if (!apiKey) throw new Error('API key not configured.');
  const res = await fetch('https://api.pexels.com/v1/search?query=baby&per_page=1', {
    headers: { Authorization: apiKey },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  const json = await res.json() as { total_results?: number };
  return `Connected — ${json?.total_results?.toLocaleString() ?? '?'} results for "baby"`;
}

async function probeMetaIG(igUserId: string, token: string): Promise<string | null> {
  if (!igUserId || !token) throw new Error('IG User ID or access token not configured.');
  const url = `https://graph.facebook.com/v21.0/${igUserId}?fields=id,username&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as any;
    throw new Error(`${body?.error?.message ?? `HTTP ${res.status}`}`);
  }
  const json = await res.json() as { username?: string; id?: string };
  return `Connected — @${json?.username ?? json?.id}`;
}

async function probeMetaFB(fbPageId: string, pat: string): Promise<string | null> {
  if (!fbPageId || !pat) throw new Error('FB Page ID or access token not configured.');
  const url = `https://graph.facebook.com/v21.0/${fbPageId}?fields=id,name&access_token=${encodeURIComponent(pat)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as any;
    throw new Error(`${body?.error?.message ?? `HTTP ${res.status}`}`);
  }
  const json = await res.json() as { name?: string; id?: string };
  return `Connected — ${json?.name ?? json?.id}`;
}

async function probeAnthropicWorker(workerUrl: string): Promise<string | null> {
  if (!workerUrl) throw new Error('Cloudflare Worker URL not configured.');
  const res = await fetch(`${workerUrl.replace(/\/$/, '')}/health`, {
    method: 'GET',
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);
  if (!res) throw new Error('Worker did not respond within 5s.');
  if (res.ok) return 'Worker reachable';
  throw new Error(`HTTP ${res.status}`);
}

interface CheckHealthResponse {
  ok: true;
  checkedAt: string;
  results: {
    openai: ServiceResult;
    gemini: ServiceResult;
    replicate: ServiceResult;
    pexels: ServiceResult;
    ig: ServiceResult;
    fb: ServiceResult;
    anthropicWorker: ServiceResult;
  };
}

interface UpdateConfigInput {
  patch?: Record<string, any>;
}
interface UpdateConfigResponse {
  ok: boolean;
  error?: string;
}

export function buildCheckIntegrationHealth(allowList: ReadonlySet<string>) {
  return functions
    .runWith({ memory: '256MB', timeoutSeconds: 60 })
    .https.onCall(async (_data: unknown, context: functions.https.CallableContext): Promise<CheckHealthResponse> => {
      if (!(await callerIsAdmin(context.auth?.token, allowList))) {
        throw new functions.https.HttpsError('permission-denied', 'Admins only.');
      }

      const cfg = await getIntegrationConfig();
      const igToken = (cfg.meta.fbPageAccessToken?.startsWith('EAA') ? cfg.meta.fbPageAccessToken : cfg.meta.igAccessToken) ?? '';

      const [openai, gemini, replicate, pexels, ig, fb, anthropicWorker] = await Promise.all([
        probe(() => probeOpenAI(cfg.openai.apiKey)),
        probe(() => probeGemini(cfg.gemini.apiKey)),
        probe(() => probeReplicate(cfg.replicate.apiToken)),
        probe(() => probePexels(cfg.pexels.apiKey)),
        probe(() => probeMetaIG(cfg.meta.igUserId, igToken)),
        probe(() => probeMetaFB(cfg.meta.fbPageId, cfg.meta.fbPageAccessToken || igToken)),
        probe(() => probeAnthropicWorker(cfg.anthropic.workerUrl)),
      ]);

      return {
        ok: true,
        checkedAt: new Date().toISOString(),
        results: { openai, gemini, replicate, pexels, ig, fb, anthropicWorker },
      };
    });
}

export function buildUpdateIntegrationConfig(allowList: ReadonlySet<string>) {
  return functions
    .runWith({ memory: '256MB', timeoutSeconds: 30 })
    .https.onCall(async (data: UpdateConfigInput, context: functions.https.CallableContext): Promise<UpdateConfigResponse> => {
      if (!(await callerIsAdmin(context.auth?.token, allowList))) {
        throw new functions.https.HttpsError('permission-denied', 'Admins only.');
      }
      const patch = data?.patch;
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        return { ok: false, error: 'patch must be an object.' };
      }
      try {
        await admin.firestore().doc('app_settings/integrations').set(sanitizePatch(patch), { merge: true });
        invalidateIntegrationConfigCache();
        const actor = context.auth?.token?.email ?? context.auth?.uid ?? 'unknown';
        console.log(`[updateIntegrationConfig] patch applied by ${actor}: ${Object.keys(patch).join(', ')}`);
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e?.message ?? String(e) };
      }
    });
}

function sanitizePatch(raw: Record<string, any>): Record<string, any> {
  const allowed = new Set(['openai', 'replicate', 'gemini', 'pexels', 'anthropic', 'meta']);
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!allowed.has(k)) continue;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      out[k] = v;
    }
  }
  return out;
}
