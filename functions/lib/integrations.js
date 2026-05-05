"use strict";
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
exports.buildCheckIntegrationHealth = buildCheckIntegrationHealth;
exports.buildUpdateIntegrationConfig = buildUpdateIntegrationConfig;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const integrationConfig_1 = require("./lib/integrationConfig");
async function callerIsAdmin(token, allowList) {
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
async function probe(fn) {
    const t0 = Date.now();
    try {
        const detail = await fn();
        return { ok: true, latencyMs: Date.now() - t0, detail, error: null };
    }
    catch (e) {
        return { ok: false, latencyMs: Date.now() - t0, detail: null, error: truncate(e?.message ?? String(e)) };
    }
}
function truncate(s, max = 200) {
    return s.length > max ? s.slice(0, max) + '…' : s;
}
async function probeOpenAI(apiKey) {
    if (!apiKey)
        throw new Error('API key not configured.');
    const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`HTTP ${res.status}: ${body?.error?.message ?? res.statusText}`);
    }
    const json = await res.json();
    const count = json?.data?.length ?? 0;
    return `Connected — ${count} models visible`;
}
async function probeGemini(apiKey) {
    if (!apiKey)
        throw new Error('API key not configured.');
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=5`;
    const res = await fetch(url);
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`HTTP ${res.status}: ${body?.error?.message ?? res.statusText}`);
    }
    const json = await res.json();
    const count = json?.models?.length ?? 0;
    return `Connected — ${count}+ models visible`;
}
async function probeReplicate(apiToken) {
    if (!apiToken)
        throw new Error('API token not configured.');
    const res = await fetch('https://api.replicate.com/v1/account', {
        headers: { Authorization: `Bearer ${apiToken}` },
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`HTTP ${res.status}: ${body?.detail ?? res.statusText}`);
    }
    const json = await res.json();
    return `Connected — ${json?.username ?? 'account'} (${json?.type ?? 'user'})`;
}
async function probePexels(apiKey) {
    if (!apiKey)
        throw new Error('API key not configured.');
    const res = await fetch('https://api.pexels.com/v1/search?query=baby&per_page=1', {
        headers: { Authorization: apiKey },
    });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const json = await res.json();
    return `Connected — ${json?.total_results?.toLocaleString() ?? '?'} results for "baby"`;
}
async function probeMetaIG(igUserId, token) {
    if (!igUserId || !token)
        throw new Error('IG User ID or access token not configured.');
    const url = `https://graph.facebook.com/v21.0/${igUserId}?fields=id,username&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`${body?.error?.message ?? `HTTP ${res.status}`}`);
    }
    const json = await res.json();
    return `Connected — @${json?.username ?? json?.id}`;
}
async function probeMetaFB(fbPageId, pat) {
    if (!fbPageId || !pat)
        throw new Error('FB Page ID or access token not configured.');
    const url = `https://graph.facebook.com/v21.0/${fbPageId}?fields=id,name&access_token=${encodeURIComponent(pat)}`;
    const res = await fetch(url);
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`${body?.error?.message ?? `HTTP ${res.status}`}`);
    }
    const json = await res.json();
    return `Connected — ${json?.name ?? json?.id}`;
}
async function probeAnthropicWorker(workerUrl) {
    if (!workerUrl)
        throw new Error('Cloudflare Worker URL not configured.');
    const res = await fetch(`${workerUrl.replace(/\/$/, '')}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    if (!res)
        throw new Error('Worker did not respond within 5s.');
    if (res.ok)
        return 'Worker reachable';
    throw new Error(`HTTP ${res.status}`);
}
function buildCheckIntegrationHealth(allowList) {
    return functions
        .runWith({ memory: '256MB', timeoutSeconds: 60 })
        .https.onCall(async (_data, context) => {
        if (!(await callerIsAdmin(context.auth?.token, allowList))) {
            throw new functions.https.HttpsError('permission-denied', 'Admins only.');
        }
        const cfg = await (0, integrationConfig_1.getIntegrationConfig)();
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
function buildUpdateIntegrationConfig(allowList) {
    return functions
        .runWith({ memory: '256MB', timeoutSeconds: 30 })
        .https.onCall(async (data, context) => {
        if (!(await callerIsAdmin(context.auth?.token, allowList))) {
            throw new functions.https.HttpsError('permission-denied', 'Admins only.');
        }
        const patch = data?.patch;
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
            return { ok: false, error: 'patch must be an object.' };
        }
        try {
            await admin.firestore().doc('app_settings/integrations').set(sanitizePatch(patch), { merge: true });
            (0, integrationConfig_1.invalidateIntegrationConfigCache)();
            const actor = context.auth?.token?.email ?? context.auth?.uid ?? 'unknown';
            console.log(`[updateIntegrationConfig] patch applied by ${actor}: ${Object.keys(patch).join(', ')}`);
            return { ok: true };
        }
        catch (e) {
            return { ok: false, error: e?.message ?? String(e) };
        }
    });
}
function sanitizePatch(raw) {
    const allowed = new Set(['openai', 'replicate', 'gemini', 'pexels', 'anthropic', 'meta', 'notes']);
    const out = {};
    for (const [k, v] of Object.entries(raw)) {
        if (!allowed.has(k))
            continue;
        if (k === 'notes' && typeof v === 'object' && v !== null && !Array.isArray(v)) {
            const sanitizedNotes = {};
            for (const [nk, nv] of Object.entries(v)) {
                if (typeof nv === 'string')
                    sanitizedNotes[nk] = nv;
            }
            out['notes'] = sanitizedNotes;
        }
        else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
            out[k] = v;
        }
    }
    return out;
}
