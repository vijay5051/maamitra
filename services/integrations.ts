// Integration Hub client service.
//
// Reads and writes the app_settings/integrations Firestore doc (Firestore-first
// config pattern), and calls the checkIntegrationHealth / updateIntegrationConfig
// Cloud Functions. All writes are restricted to admin-only by Firestore rules
// and the Cloud Function gate.

import { doc, getDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';

import { app, db } from './firebase';
import { logAdminAction } from './audit';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MetaIntegrationConfig {
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
  meta: MetaIntegrationConfig;
}

export const EMPTY_CONFIG: IntegrationConfig = {
  openai: { apiKey: '', defaultModel: 'gpt-4o-mini' },
  replicate: { apiToken: '' },
  gemini: { apiKey: '' },
  pexels: { apiKey: '' },
  anthropic: { workerUrl: '' },
  meta: {
    igUserId: '',
    igAccessToken: '',
    fbPageId: '',
    fbPageAccessToken: '',
    appSecret: '',
    webhookVerifyToken: '',
    adAccountId: '',
  },
};

export interface ServiceResult {
  ok: boolean;
  latencyMs: number;
  detail: string | null;
  error: string | null;
}

export interface HealthCheckResults {
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

// ── Read ──────────────────────────────────────────────────────────────────────

export async function fetchIntegrationConfig(): Promise<IntegrationConfig> {
  if (!db) return EMPTY_CONFIG;
  try {
    const snap = await getDoc(doc(db, 'app_settings/integrations'));
    if (!snap.exists()) return EMPTY_CONFIG;
    return mergeWithDefaults(snap.data() ?? {});
  } catch {
    return EMPTY_CONFIG;
  }
}

export function subscribeIntegrationConfig(cb: (cfg: IntegrationConfig) => void): Unsubscribe {
  if (!db) {
    cb(EMPTY_CONFIG);
    return () => {};
  }
  return onSnapshot(doc(db, 'app_settings/integrations'), (snap) => {
    cb(snap.exists() ? mergeWithDefaults(snap.data() ?? {}) : EMPTY_CONFIG);
  }, () => cb(EMPTY_CONFIG));
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function saveIntegrationConfig(
  actor: { uid: string; email: string | null | undefined },
  patch: Partial<IntegrationConfig>,
): Promise<void> {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const fn = httpsCallable<{ patch: Partial<IntegrationConfig> }, { ok: boolean; error?: string }>(
    getFunctions(app ?? undefined),
    'updateIntegrationConfig',
  );
  const result = await fn({ patch });
  if (!result.data.ok) throw new Error(result.data.error ?? 'Update failed');
  await logAdminAction(actor, 'integration.update', { label: Object.keys(patch).join(', ') }, {}).catch(() => {});
}

// ── Health check ──────────────────────────────────────────────────────────────

export async function checkIntegrationHealth(): Promise<HealthCheckResults> {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const fn = httpsCallable<void, { ok: true; checkedAt: string; results: HealthCheckResults['results'] }>(
    getFunctions(app ?? undefined),
    'checkIntegrationHealth',
  );
  const result = await fn();
  return { checkedAt: result.data.checkedAt, results: result.data.results };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mergeWithDefaults(d: Record<string, any>): IntegrationConfig {
  const m = d.meta ?? {};
  return {
    openai: {
      apiKey: str(d.openai?.apiKey),
      defaultModel: str(d.openai?.defaultModel, 'gpt-4o-mini'),
    },
    replicate: { apiToken: str(d.replicate?.apiToken) },
    gemini: { apiKey: str(d.gemini?.apiKey) },
    pexels: { apiKey: str(d.pexels?.apiKey) },
    anthropic: { workerUrl: str(d.anthropic?.workerUrl) },
    meta: {
      igUserId:           str(m.igUserId),
      igAccessToken:      str(m.igAccessToken),
      fbPageId:           str(m.fbPageId),
      fbPageAccessToken:  str(m.fbPageAccessToken),
      appSecret:          str(m.appSecret),
      webhookVerifyToken: str(m.webhookVerifyToken),
      adAccountId:        str(m.adAccountId),
    },
  };
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}
