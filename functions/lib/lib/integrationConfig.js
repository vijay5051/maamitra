"use strict";
// Shared integration config reader for all Cloud Functions.
//
// Priority: Firestore `app_settings/integrations` → process.env fallback.
// Cached in-process for 5 minutes so every invocation doesn't do a Firestore
// read — the cache is invalidated automatically when the TTL expires, meaning
// a key rotated via the admin panel takes effect within 5 minutes.
//
// All consumers (imageSources.ts, publisher.ts, health.ts, etc.) should call
// getIntegrationConfig() inside their request handlers — never at module level,
// since module-level reads happen once at cold-start and miss Firestore updates.
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
exports.invalidateIntegrationConfigCache = invalidateIntegrationConfigCache;
exports.getIntegrationConfig = getIntegrationConfig;
const admin = __importStar(require("firebase-admin"));
let _cache = null;
let _cacheAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;
function invalidateIntegrationConfigCache() {
    _cache = null;
    _cacheAt = 0;
}
async function getIntegrationConfig() {
    const now = Date.now();
    if (_cache && now - _cacheAt < CACHE_TTL_MS)
        return _cache;
    let firestoreData = {};
    try {
        const snap = await admin.firestore().doc('app_settings/integrations').get();
        if (snap.exists)
            firestoreData = snap.data() ?? {};
    }
    catch (e) {
        console.warn('[integrationConfig] Firestore read failed, using env fallback:', e);
    }
    const cfg = buildConfig(firestoreData);
    _cache = cfg;
    _cacheAt = now;
    return cfg;
}
function str(firestoreVal, envVal) {
    if (typeof firestoreVal === 'string' && firestoreVal.trim())
        return firestoreVal.trim();
    return envVal?.trim() ?? '';
}
function buildConfig(d) {
    const m = d.meta ?? {};
    return {
        openai: {
            apiKey: str(d.openai?.apiKey, process.env.OPENAI_API_KEY),
            defaultModel: str(d.openai?.defaultModel, 'gpt-image-1'),
        },
        replicate: {
            apiToken: str(d.replicate?.apiToken, process.env.REPLICATE_API_TOKEN),
            loraModel: str(d.replicate?.loraModel, process.env.REPLICATE_LORA_MODEL),
            loraTrigger: str(d.replicate?.loraTrigger, process.env.REPLICATE_LORA_TRIGGER) || 'MAAMITRASTYLE',
        },
        gemini: {
            apiKey: str(d.gemini?.apiKey, process.env.GEMINI_API_KEY),
            imagenModel: str(d.gemini?.imagenModel, process.env.GEMINI_IMAGEN_MODEL) || 'imagen-4.0-generate-001',
        },
        pexels: {
            apiKey: str(d.pexels?.apiKey, process.env.PEXELS_API_KEY),
        },
        anthropic: {
            workerUrl: str(d.anthropic?.workerUrl, process.env.EXPO_PUBLIC_CLAUDE_WORKER_URL),
        },
        meta: {
            igUserId: str(m.igUserId, process.env.META_IG_USER_ID),
            igAccessToken: str(m.igAccessToken, process.env.META_IG_ACCESS_TOKEN),
            fbPageId: str(m.fbPageId, process.env.META_FB_PAGE_ID),
            fbPageAccessToken: str(m.fbPageAccessToken, process.env.META_FB_PAGE_ACCESS_TOKEN),
            appSecret: str(m.appSecret, process.env.META_APP_SECRET),
            webhookVerifyToken: str(m.webhookVerifyToken, process.env.META_WEBHOOK_VERIFY_TOKEN),
            adAccountId: str(m.adAccountId, process.env.META_AD_ACCOUNT_ID),
        },
        factoryResetToken: str(d.factoryResetToken, process.env.FACTORY_RESET_TOKEN),
    };
}
