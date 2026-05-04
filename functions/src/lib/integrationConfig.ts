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

import * as admin from 'firebase-admin';

export interface MetaConfig {
  igUserId: string;
  igAccessToken: string;
  fbPageId: string;
  fbPageAccessToken: string;
  appSecret: string;
  webhookVerifyToken: string;
  adAccountId: string;
}

export interface IntegrationConfig {
  openai: { apiKey: string; defaultModel: string };
  replicate: { apiToken: string };
  gemini: { apiKey: string };
  pexels: { apiKey: string };
  anthropic: { workerUrl: string };
  meta: MetaConfig;
  factoryResetToken: string;
}

let _cache: IntegrationConfig | null = null;
let _cacheAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export function invalidateIntegrationConfigCache(): void {
  _cache = null;
  _cacheAt = 0;
}

export async function getIntegrationConfig(): Promise<IntegrationConfig> {
  const now = Date.now();
  if (_cache && now - _cacheAt < CACHE_TTL_MS) return _cache;

  let firestoreData: Record<string, any> = {};
  try {
    const snap = await admin.firestore().doc('app_settings/integrations').get();
    if (snap.exists) firestoreData = snap.data() ?? {};
  } catch (e) {
    console.warn('[integrationConfig] Firestore read failed, using env fallback:', e);
  }

  const cfg = buildConfig(firestoreData);
  _cache = cfg;
  _cacheAt = now;
  return cfg;
}

function str(firestoreVal: unknown, envVal: string | undefined): string {
  if (typeof firestoreVal === 'string' && firestoreVal.trim()) return firestoreVal.trim();
  return envVal?.trim() ?? '';
}

function buildConfig(d: Record<string, any>): IntegrationConfig {
  const m = d.meta ?? {};
  return {
    openai: {
      apiKey:       str(d.openai?.apiKey,       process.env.OPENAI_API_KEY),
      defaultModel: str(d.openai?.defaultModel,  'gpt-image-1'),
    },
    replicate: {
      apiToken: str(d.replicate?.apiToken, process.env.REPLICATE_API_TOKEN),
    },
    gemini: {
      apiKey: str(d.gemini?.apiKey, process.env.GEMINI_API_KEY),
    },
    pexels: {
      apiKey: str(d.pexels?.apiKey, process.env.PEXELS_API_KEY),
    },
    anthropic: {
      workerUrl: str(d.anthropic?.workerUrl, process.env.EXPO_PUBLIC_CLAUDE_WORKER_URL),
    },
    meta: {
      igUserId:           str(m.igUserId,           process.env.META_IG_USER_ID),
      igAccessToken:      str(m.igAccessToken,       process.env.META_IG_ACCESS_TOKEN),
      fbPageId:           str(m.fbPageId,            process.env.META_FB_PAGE_ID),
      fbPageAccessToken:  str(m.fbPageAccessToken,   process.env.META_FB_PAGE_ACCESS_TOKEN),
      appSecret:          str(m.appSecret,           process.env.META_APP_SECRET),
      webhookVerifyToken: str(m.webhookVerifyToken,  process.env.META_WEBHOOK_VERIFY_TOKEN),
      adAccountId:        str(m.adAccountId,         process.env.META_AD_ACCOUNT_ID),
    },
    factoryResetToken: str(d.factoryResetToken, process.env.FACTORY_RESET_TOKEN),
  };
}
