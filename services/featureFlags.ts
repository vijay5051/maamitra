// Runtime feature flags + visibility controls.
//
// One Firestore doc — `app_config/runtime` — drives every gateable surface
// in the live app. The admin panel writes it from /admin/visibility; every
// client subscribes via onSnapshot. Result: an admin can hide Community,
// throttle chat, enable maintenance mode, or force an OTA update without
// shipping code.
//
// Schema (mirrored in firestore.rules with strict shape validation):
//   features.<name>.enabled        — global on/off
//   features.<name>.rolloutPct     — 0–100 cohort %, sticky per-uid hash
//   features.<name>.audience       — 'all' | 'beta' | 'admins'
//   maintenance.{enabled,title,message,allowReadOnly}
//   forceUpdate.{enabled,minBuildNumber,title,message}
//   moderation.{requireApproval,autoHideKeywords,blockedTopics}
//
// Defaults: every feature enabled, rolloutPct=100, audience='all', no
// maintenance, no force-update. The doc may be absent — callers MUST
// behave as if the defaults are in effect when it is.

import {
  doc,
  DocumentReference,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Unsubscribe,
} from 'firebase/firestore';

import { db } from './firebase';
import { logAdminAction, AdminAction } from './audit';

// ─── Types ────────────────────────────────────────────────────────────────
export type FeatureKey =
  | 'community'
  | 'chat'
  | 'wellness'
  | 'messaging'
  | 'health.vaccines'
  | 'health.growth'
  | 'health.food'
  | 'health.sleep'
  | 'content.books'
  | 'content.articles'
  | 'content.products'
  | 'content.schemes'
  | 'content.yoga';

export type FeatureAudience = 'all' | 'beta' | 'admins';

export interface FeatureConfig {
  enabled: boolean;
  rolloutPct: number;          // 0–100
  audience: FeatureAudience;
  /** Per-day cap for 'chat' feature only; ignored elsewhere. */
  throttleMsgsPerDay?: number;
}

export interface MaintenanceConfig {
  enabled: boolean;
  title: string;
  message: string;
  /** When true, app loads but read-only (no posts, comments, messages). */
  allowReadOnly: boolean;
}

export interface ForceUpdateConfig {
  enabled: boolean;
  /** Numeric build number (Android versionCode / iOS CFBundleVersion). */
  minBuildNumber: number;
  title: string;
  message: string;
}

export interface ModerationConfig {
  /** When true, new posts land in pending queue instead of going live. */
  requireApproval: boolean;
  autoHideKeywords: string[];
  blockedTopics: string[];
}

export interface RuntimeConfig {
  features: Record<FeatureKey, FeatureConfig>;
  maintenance: MaintenanceConfig;
  forceUpdate: ForceUpdateConfig;
  moderation: ModerationConfig;
  updatedAt?: any;
  updatedBy?: string;
}

// ─── Defaults ─────────────────────────────────────────────────────────────
const DEFAULT_FEATURE: FeatureConfig = {
  enabled: true,
  rolloutPct: 100,
  audience: 'all',
};

export const FEATURE_KEYS: FeatureKey[] = [
  'community', 'chat', 'wellness', 'messaging',
  'health.vaccines', 'health.growth', 'health.food', 'health.sleep',
  'content.books', 'content.articles', 'content.products', 'content.schemes', 'content.yoga',
];

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  'community': 'Community feed',
  'chat': 'AI chat',
  'wellness': 'Wellness tab',
  'messaging': 'Direct messaging',
  'health.vaccines': 'Vaccines tracker',
  'health.growth': 'Growth tracker',
  'health.food': 'Food tracker',
  'health.sleep': 'Sleep tracker',
  'content.books': 'Books library',
  'content.articles': 'Articles library',
  'content.products': 'Products library',
  'content.schemes': 'Govt. schemes',
  'content.yoga': 'Yoga library',
};

export const FEATURE_GROUPS: { label: string; keys: FeatureKey[] }[] = [
  { label: 'Top-level tabs', keys: ['community', 'chat', 'wellness', 'messaging'] },
  { label: 'Health tracking', keys: ['health.vaccines', 'health.growth', 'health.food', 'health.sleep'] },
  { label: 'Content library', keys: ['content.books', 'content.articles', 'content.products', 'content.schemes', 'content.yoga'] },
];

export function defaultRuntimeConfig(): RuntimeConfig {
  const features: Record<FeatureKey, FeatureConfig> = {} as any;
  for (const k of FEATURE_KEYS) features[k] = { ...DEFAULT_FEATURE };
  return {
    features,
    maintenance: { enabled: false, title: 'We\'ll be right back', message: 'MaaMitra is undergoing a quick maintenance — we\'ll be back in a few minutes.', allowReadOnly: false },
    forceUpdate: { enabled: false, minBuildNumber: 0, title: 'Update required', message: 'Please update MaaMitra to continue.' },
    moderation: { requireApproval: false, autoHideKeywords: [], blockedTopics: [] },
  };
}

/** Merge a partial Firestore doc onto the defaults so missing keys never crash. */
export function normaliseRuntimeConfig(raw: any): RuntimeConfig {
  const def = defaultRuntimeConfig();
  if (!raw || typeof raw !== 'object') return def;
  const out: RuntimeConfig = { ...def };
  if (raw.features && typeof raw.features === 'object') {
    for (const k of FEATURE_KEYS) {
      const v = raw.features[k];
      if (v && typeof v === 'object') {
        out.features[k] = {
          enabled: typeof v.enabled === 'boolean' ? v.enabled : DEFAULT_FEATURE.enabled,
          rolloutPct: typeof v.rolloutPct === 'number' ? Math.max(0, Math.min(100, v.rolloutPct)) : 100,
          audience: (['all', 'beta', 'admins'] as const).includes(v.audience) ? v.audience : 'all',
          throttleMsgsPerDay: typeof v.throttleMsgsPerDay === 'number' ? v.throttleMsgsPerDay : undefined,
        };
      }
    }
  }
  if (raw.maintenance && typeof raw.maintenance === 'object') {
    out.maintenance = {
      enabled: !!raw.maintenance.enabled,
      title: typeof raw.maintenance.title === 'string' ? raw.maintenance.title : def.maintenance.title,
      message: typeof raw.maintenance.message === 'string' ? raw.maintenance.message : def.maintenance.message,
      allowReadOnly: !!raw.maintenance.allowReadOnly,
    };
  }
  if (raw.forceUpdate && typeof raw.forceUpdate === 'object') {
    out.forceUpdate = {
      enabled: !!raw.forceUpdate.enabled,
      minBuildNumber: typeof raw.forceUpdate.minBuildNumber === 'number' ? raw.forceUpdate.minBuildNumber : 0,
      title: typeof raw.forceUpdate.title === 'string' ? raw.forceUpdate.title : def.forceUpdate.title,
      message: typeof raw.forceUpdate.message === 'string' ? raw.forceUpdate.message : def.forceUpdate.message,
    };
  }
  if (raw.moderation && typeof raw.moderation === 'object') {
    out.moderation = {
      requireApproval: !!raw.moderation.requireApproval,
      autoHideKeywords: Array.isArray(raw.moderation.autoHideKeywords)
        ? raw.moderation.autoHideKeywords.filter((s: any) => typeof s === 'string').slice(0, 200)
        : [],
      blockedTopics: Array.isArray(raw.moderation.blockedTopics)
        ? raw.moderation.blockedTopics.filter((s: any) => typeof s === 'string').slice(0, 100)
        : [],
    };
  }
  return out;
}

// ─── Per-uid sticky rollout ───────────────────────────────────────────────
// FNV-1a 32-bit. Stable across platforms — same uid always falls in the
// same 0-99 bucket, so a 25% rollout shows to 25% of users consistently.
function hashUid(uid: string, salt: string): number {
  const s = salt + ':' + uid;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h % 100;
}

export interface FlagEvalContext {
  uid?: string | null;
  isAdmin?: boolean;
  isBetaTester?: boolean;
}

/** Whether a feature is on for a given user. Pure function — no IO. */
export function isFeatureEnabled(
  cfg: RuntimeConfig,
  key: FeatureKey,
  ctx: FlagEvalContext,
): boolean {
  const f = cfg.features[key] ?? DEFAULT_FEATURE;
  if (!f.enabled) return false;
  // Audience gate
  if (f.audience === 'admins' && !ctx.isAdmin) return false;
  if (f.audience === 'beta' && !ctx.isBetaTester && !ctx.isAdmin) return false;
  // Rollout %
  if (f.rolloutPct >= 100) return true;
  if (f.rolloutPct <= 0) return ctx.isAdmin === true;
  if (!ctx.uid) return false; // anonymous users opt out of partial rollouts
  return hashUid(ctx.uid, key) < f.rolloutPct;
}

// ─── Firestore I/O ────────────────────────────────────────────────────────
const RUNTIME_DOC_PATH = 'app_config/runtime';

function runtimeDocRef(): DocumentReference | null {
  if (!db) return null;
  return doc(db, RUNTIME_DOC_PATH);
}

export async function fetchRuntimeConfig(): Promise<RuntimeConfig> {
  const ref = runtimeDocRef();
  if (!ref) return defaultRuntimeConfig();
  try {
    const snap = await getDoc(ref);
    return normaliseRuntimeConfig(snap.exists() ? snap.data() : null);
  } catch (e) {
    return defaultRuntimeConfig();
  }
}

export function subscribeRuntimeConfig(
  cb: (cfg: RuntimeConfig) => void,
): Unsubscribe {
  const ref = runtimeDocRef();
  if (!ref) {
    // No Firestore yet — emit defaults synchronously and return a no-op unsub.
    cb(defaultRuntimeConfig());
    return () => {};
  }
  return onSnapshot(
    ref,
    (snap) => cb(normaliseRuntimeConfig(snap.exists() ? snap.data() : null)),
    () => cb(defaultRuntimeConfig()),
  );
}

// ─── Admin writes ─────────────────────────────────────────────────────────
// All writes log to admin_audit. Caller passes the actor uid + email.

export interface UpdateActor {
  uid: string;
  email: string | null | undefined;
}

async function writeRuntimeConfig(
  patch: Partial<RuntimeConfig>,
  actor: UpdateActor,
  auditAction: AdminAction,
  auditMeta: Record<string, any>,
): Promise<void> {
  const ref = runtimeDocRef();
  if (!ref) throw new Error('Firestore not ready');
  await setDoc(
    ref,
    {
      ...patch,
      updatedAt: serverTimestamp(),
      updatedBy: actor.email ?? actor.uid,
    },
    { merge: true },
  );
  // logAdminAction is best-effort and already swallows its own errors.
  await logAdminAction(actor, auditAction, { label: 'app_config/runtime' }, auditMeta);
}

export async function setFeatureFlag(
  key: FeatureKey,
  patch: Partial<FeatureConfig>,
  actor: UpdateActor,
  reason?: string,
): Promise<void> {
  // Use dot-notation merge so we don't blow away sibling features.
  const update: any = {};
  for (const [k, v] of Object.entries(patch)) {
    update[`features.${key}.${k}`] = v;
  }
  const ref = runtimeDocRef();
  if (!ref) throw new Error('Firestore not ready');
  await setDoc(
    ref,
    { ...update, updatedAt: serverTimestamp(), updatedBy: actor.email ?? actor.uid },
    { merge: true },
  );
  await logAdminAction(actor, 'flag.toggle', { label: key }, { key, patch, reason: reason ?? null });
}

export async function setMaintenance(
  patch: Partial<MaintenanceConfig>,
  actor: UpdateActor,
): Promise<void> {
  await writeRuntimeConfig(
    { maintenance: { ...defaultRuntimeConfig().maintenance, ...patch } as MaintenanceConfig },
    actor,
    patch.enabled ? 'maintenance.enable' : 'maintenance.disable',
    { patch },
  );
}

export async function setForceUpdate(
  patch: Partial<ForceUpdateConfig>,
  actor: UpdateActor,
): Promise<void> {
  await writeRuntimeConfig(
    { forceUpdate: { ...defaultRuntimeConfig().forceUpdate, ...patch } as ForceUpdateConfig },
    actor,
    'force_update.set',
    { patch },
  );
}

export async function setModeration(
  patch: Partial<ModerationConfig>,
  actor: UpdateActor,
): Promise<void> {
  await writeRuntimeConfig(
    { moderation: { ...defaultRuntimeConfig().moderation, ...patch } as ModerationConfig },
    actor,
    'settings.update',
    { area: 'moderation', patch },
  );
}
