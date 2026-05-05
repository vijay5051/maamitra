// Marketing automation service.
//
// Phase 1: brand kit CRUD.
// Phase 2: client wrapper for the renderMarketingTemplate Cloud Function.
// Future phases add draft CRUD, scheduled publish, inbox threads, analytics.
//
// All write paths log through services/audit.ts so admin actions are
// traceable in the audit log.

import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, Unsubscribe } from 'firebase/firestore';

import {
  AudiencePersona,
  BrandIllustration,
  BrandKit,
  ChannelHealth,
  ComplianceRules,
  ContentPillar,
  CostCaps,
  CronOverride,
  CronOverrides,
  CulturalEvent,
  DisclaimerRule,
  defaultBrandKit,
  DEFAULT_COMPLIANCE,
  DEFAULT_COST_CAPS,
  DEFAULT_CULTURAL_CALENDAR,
  DEFAULT_FONTS,
  DEFAULT_HASHTAGS,
  DEFAULT_ILLUSTRATIONS,
  DEFAULT_PALETTE,
  DEFAULT_PERSONAS,
  DEFAULT_PILLARS,
  DEFAULT_STYLE_PROFILE,
  DEFAULT_THEME_CALENDAR,
  DEFAULT_VOICE,
  MarketingHealth,
  StyleProfile,
  UNKNOWN_CHANNEL_HEALTH,
  WeekDay,
} from '../lib/marketingTypes';
import { logAdminAction } from './audit';
import { app, db } from './firebase';

const BRAND_PATH = 'marketing_brand/main';

export async function fetchBrandKit(): Promise<BrandKit | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, BRAND_PATH));
    if (!snap.exists()) return null;
    return normaliseBrandKit(snap.data());
  } catch {
    return null;
  }
}

export function subscribeBrandKit(cb: (kit: BrandKit | null) => void): Unsubscribe {
  if (!db) {
    cb(null);
    return () => {};
  }
  return onSnapshot(
    doc(db, BRAND_PATH),
    (snap) => cb(snap.exists() ? normaliseBrandKit(snap.data()) : null),
    () => cb(null),
  );
}

export async function saveBrandKit(
  actor: { uid: string; email: string | null | undefined },
  patch: Partial<Omit<BrandKit, 'updatedAt' | 'updatedBy'>>,
): Promise<void> {
  if (!db) throw new Error('Firestore not ready');

  const sanitised: Record<string, any> = {};
  if (patch.brandName !== undefined) sanitised.brandName = String(patch.brandName).trim().slice(0, 60);
  if (patch.logoUrl !== undefined) sanitised.logoUrl = patch.logoUrl ? String(patch.logoUrl) : null;
  if (patch.palette) sanitised.palette = sanitisePalette(patch.palette);
  if (patch.fonts) sanitised.fonts = sanitiseFonts(patch.fonts);
  if (patch.voice) sanitised.voice = sanitiseVoice(patch.voice);
  if (patch.themeCalendar) sanitised.themeCalendar = sanitiseThemeCalendar(patch.themeCalendar);
  if (patch.hashtags) sanitised.hashtags = sanitiseHashtags(patch.hashtags);
  if (patch.defaultPostTime !== undefined) sanitised.defaultPostTime = sanitiseTime(patch.defaultPostTime);
  if (patch.personas) sanitised.personas = sanitisePersonas(patch.personas);
  if (patch.pillars) sanitised.pillars = sanitisePillars(patch.pillars);
  if (patch.culturalCalendar) sanitised.culturalCalendar = sanitiseCulturalCalendar(patch.culturalCalendar);
  if (patch.compliance) sanitised.compliance = sanitiseCompliance(patch.compliance);
  if (patch.costCaps) sanitised.costCaps = sanitiseCostCaps(patch.costCaps);
  if (patch.illustrations) sanitised.illustrations = sanitiseIllustrations(patch.illustrations);
  if (patch.cronEnabled !== undefined) sanitised.cronEnabled = !!patch.cronEnabled;
  if (patch.crisisPaused !== undefined) sanitised.crisisPaused = !!patch.crisisPaused;
  if (patch.crisisPauseReason !== undefined) {
    sanitised.crisisPauseReason = patch.crisisPauseReason ? String(patch.crisisPauseReason).slice(0, 200) : null;
  }
  if (patch.onboardedAt !== undefined) {
    // Pass an empty string or null to clear it; pass anything else (an ISO
    // string, or `'now' as any`) to stamp serverTimestamp.
    sanitised.onboardedAt = patch.onboardedAt && patch.onboardedAt !== ''
      ? serverTimestamp()
      : null;
  }
  if (patch.styleProfile !== undefined) {
    sanitised.styleProfile = patch.styleProfile ? sanitiseStyleProfile(patch.styleProfile) : null;
  }
  if (patch.styleReferences !== undefined) {
    sanitised.styleReferences = Array.isArray(patch.styleReferences)
      ? patch.styleReferences.filter((r): r is string => typeof r === 'string').slice(0, 12)
      : [];
  }

  sanitised.updatedAt = serverTimestamp();
  sanitised.updatedBy = actor.email ?? actor.uid;

  await setDoc(doc(db, BRAND_PATH), sanitised, { merge: true });
  await logAdminAction(
    actor,
    'marketing.brand.update',
    { docId: 'main', label: sanitised.brandName ?? 'brand kit' },
    { fields: Object.keys(sanitised).filter((k) => k !== 'updatedAt' && k !== 'updatedBy') },
  );
}

// ── Sanitisers ──────────────────────────────────────────────────────────────
// Anything that round-trips through the admin UI gets validated here so a
// malformed paste doesn't corrupt the document.

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
function sanitiseHex(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_RE.test(value) ? value : fallback;
}

function sanitisePalette(p: BrandKit['palette']): BrandKit['palette'] {
  return {
    primary: sanitiseHex(p.primary, DEFAULT_PALETTE.primary),
    background: sanitiseHex(p.background, DEFAULT_PALETTE.background),
    text: sanitiseHex(p.text, DEFAULT_PALETTE.text),
    accent: sanitiseHex(p.accent, DEFAULT_PALETTE.accent),
  };
}

function sanitiseFonts(f: BrandKit['fonts']): BrandKit['fonts'] {
  return {
    heading: typeof f.heading === 'string' ? f.heading.trim().slice(0, 60) || DEFAULT_FONTS.heading : DEFAULT_FONTS.heading,
    body: typeof f.body === 'string' ? f.body.trim().slice(0, 60) || DEFAULT_FONTS.body : DEFAULT_FONTS.body,
  };
}

function sanitiseVoice(v: BrandKit['voice']): BrandKit['voice'] {
  const trimList = (arr: unknown, max: number) =>
    Array.isArray(arr)
      ? arr.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean).slice(0, max)
      : [];
  const bilingual = ['english_only', 'hinglish', 'devanagari_accents'].includes(v.bilingual as string)
    ? v.bilingual
    : DEFAULT_VOICE.bilingual;
  return {
    attributes: trimList(v.attributes, 5),
    avoid: trimList(v.avoid, 20),
    bilingual,
  };
}

function sanitiseThemeCalendar(tc: BrandKit['themeCalendar']): BrandKit['themeCalendar'] {
  const result = { ...DEFAULT_THEME_CALENDAR };
  (Object.keys(DEFAULT_THEME_CALENDAR) as WeekDay[]).forEach((d) => {
    const day = (tc as any)?.[d];
    if (!day) return;
    result[d] = {
      label: typeof day.label === 'string' ? day.label.trim().slice(0, 40) || DEFAULT_THEME_CALENDAR[d].label : DEFAULT_THEME_CALENDAR[d].label,
      prompt: typeof day.prompt === 'string' ? day.prompt.trim().slice(0, 400) || DEFAULT_THEME_CALENDAR[d].prompt : DEFAULT_THEME_CALENDAR[d].prompt,
      enabled: typeof day.enabled === 'boolean' ? day.enabled : DEFAULT_THEME_CALENDAR[d].enabled,
    };
  });
  return result;
}

function sanitiseHashtags(tags: string[]): string[] {
  return tags
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter(Boolean)
    .map((t) => (t.startsWith('#') ? t : `#${t}`))
    .slice(0, 30);
}

function sanitiseTime(t: string): string {
  return /^[0-2]\d:[0-5]\d$/.test(t) ? t : '09:00';
}

// ── M1: strategic foundation sanitisers ─────────────────────────────────────
// Each list-shaped field has a hard upper bound to keep documents within
// Firestore's 1 MiB ceiling and to prevent UI lists from getting unwieldy.

const ID_RE = /^[a-z0-9_]{1,40}$/;
function sanitiseId(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    const cleaned = value.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_').slice(0, 40);
    if (ID_RE.test(cleaned)) return cleaned;
  }
  return fallback;
}

function sanitisePersonas(input: unknown): AudiencePersona[] {
  if (!Array.isArray(input)) return DEFAULT_PERSONAS;
  return input
    .map((p, i): AudiencePersona | null => {
      if (!p || typeof p !== 'object') return null;
      const obj = p as Record<string, unknown>;
      const id = sanitiseId(obj.id, `persona_${i}`);
      const label = typeof obj.label === 'string' ? obj.label.trim().slice(0, 60) : '';
      if (!label) return null;
      return {
        id,
        label,
        description: typeof obj.description === 'string' ? obj.description.trim().slice(0, 400) : '',
        enabled: typeof obj.enabled === 'boolean' ? obj.enabled : true,
      };
    })
    .filter((x): x is AudiencePersona => x !== null)
    .slice(0, 12);
}

function sanitisePillars(input: unknown): ContentPillar[] {
  if (!Array.isArray(input)) return DEFAULT_PILLARS;
  return input
    .map((p, i): ContentPillar | null => {
      if (!p || typeof p !== 'object') return null;
      const obj = p as Record<string, unknown>;
      const id = sanitiseId(obj.id, `pillar_${i}`);
      const label = typeof obj.label === 'string' ? obj.label.trim().slice(0, 60) : '';
      if (!label) return null;
      return {
        id,
        label,
        description: typeof obj.description === 'string' ? obj.description.trim().slice(0, 400) : '',
        emoji: typeof obj.emoji === 'string' ? obj.emoji.trim().slice(0, 4) : undefined,
        enabled: typeof obj.enabled === 'boolean' ? obj.enabled : true,
      };
    })
    .filter((x): x is ContentPillar => x !== null)
    .slice(0, 12);
}

const DATE_RE = /^\d{4}-\d{2}(-\d{2})?$/;
function sanitiseCulturalCalendar(input: unknown): CulturalEvent[] {
  if (!Array.isArray(input)) return DEFAULT_CULTURAL_CALENDAR;
  return input
    .map((e, i): CulturalEvent | null => {
      if (!e || typeof e !== 'object') return null;
      const obj = e as Record<string, unknown>;
      const id = sanitiseId(obj.id, `event_${i}`);
      const label = typeof obj.label === 'string' ? obj.label.trim().slice(0, 60) : '';
      const date = typeof obj.date === 'string' && DATE_RE.test(obj.date.trim()) ? obj.date.trim() : '';
      if (!label || !date) return null;
      const recurrence = obj.recurrence === 'one_off' ? 'one_off' : 'yearly';
      return {
        id,
        label,
        date,
        recurrence,
        pillarHint: typeof obj.pillarHint === 'string' ? sanitiseId(obj.pillarHint, '') || undefined : undefined,
        promptHint: typeof obj.promptHint === 'string' ? obj.promptHint.trim().slice(0, 240) || undefined : undefined,
      };
    })
    .filter((x): x is CulturalEvent => x !== null)
    .slice(0, 50);
}

function sanitiseCompliance(input: unknown): ComplianceRules {
  if (!input || typeof input !== 'object') return DEFAULT_COMPLIANCE;
  const obj = input as Record<string, unknown>;
  const trimList = (arr: unknown, max: number, charCap: number) =>
    Array.isArray(arr)
      ? Array.from(
          new Set(
            arr
              .map((x) => (typeof x === 'string' ? x.trim().toLowerCase().slice(0, charCap) : ''))
              .filter(Boolean),
          ),
        ).slice(0, max)
      : [];
  const disclaimers: DisclaimerRule[] = Array.isArray(obj.requiredDisclaimers)
    ? obj.requiredDisclaimers
        .map((d): DisclaimerRule | null => {
          if (!d || typeof d !== 'object') return null;
          const r = d as Record<string, unknown>;
          const trigger = typeof r.trigger === 'string' ? r.trigger.trim().toLowerCase().slice(0, 60) : '';
          const text = typeof r.text === 'string' ? r.text.trim().slice(0, 300) : '';
          if (!trigger || !text) return null;
          return { trigger, text };
        })
        .filter((x): x is DisclaimerRule => x !== null)
        .slice(0, 30)
    : DEFAULT_COMPLIANCE.requiredDisclaimers;
  return {
    medicalForbiddenWords: trimList(obj.medicalForbiddenWords, 80, 60),
    requiredDisclaimers: disclaimers,
    blockedTopics: trimList(obj.blockedTopics, 40, 100),
  };
}

function sanitiseCostCaps(input: unknown): CostCaps {
  if (!input || typeof input !== 'object') return DEFAULT_COST_CAPS;
  const obj = input as Record<string, unknown>;
  const num = (v: unknown, fallback: number, lo: number, hi: number) => {
    const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
    return Math.max(lo, Math.min(hi, Math.round(n)));
  };
  return {
    dailyInr: num(obj.dailyInr, DEFAULT_COST_CAPS.dailyInr, 0, 50_000),
    monthlyInr: num(obj.monthlyInr, DEFAULT_COST_CAPS.monthlyInr, 0, 1_000_000),
    alertAtPct: num(obj.alertAtPct, DEFAULT_COST_CAPS.alertAtPct, 1, 100),
  };
}

function sanitiseIllustrations(input: unknown): BrandIllustration[] {
  if (!Array.isArray(input)) return DEFAULT_ILLUSTRATIONS;
  return input
    .map((it): BrandIllustration | null => {
      if (!it || typeof it !== 'object') return null;
      const obj = it as Record<string, unknown>;
      const path = typeof obj.path === 'string' ? obj.path.trim().slice(0, 200) : '';
      const label = typeof obj.label === 'string' ? obj.label.trim().slice(0, 80) : '';
      if (!path || !label) return null;
      const pillarIds = Array.isArray(obj.pillarIds)
        ? obj.pillarIds
            .map((p) => (typeof p === 'string' ? sanitiseId(p, '') : ''))
            .filter((s): s is string => Boolean(s))
            .slice(0, 12)
        : [];
      return { path, label, pillarIds };
    })
    .filter((x): x is BrandIllustration => x !== null)
    .slice(0, 60);
}

// ── Template renderer (Phase 2) ─────────────────────────────────────────────
// Calls the renderMarketingTemplate Cloud Function with template name + props
// + an optional background spec. The Phase-3 cron uses the same payload.

export type RenderableTemplateName = 'tipCard' | 'quoteCard' | 'milestoneCard';
export type AiImageModel = 'flux' | 'imagen' | 'dalle';
export type ImageSourceTag = 'pexels' | 'flux' | 'imagen' | 'dalle' | 'caller-supplied' | 'none';

/** Discriminated union — picks one provider per render. */
export type BackgroundSpec =
  | { type: 'url'; url: string }
  | { type: 'stock'; provider: 'pexels'; query: string }
  | { type: 'ai'; model: AiImageModel; prompt: string };

export interface RenderTemplateInput {
  template: RenderableTemplateName;
  props: Record<string, any>;
  /** Background image source. Omit for templates without one (Tip Card). */
  background?: BackgroundSpec;
  /** Override dimensions (default 1080×1080). */
  width?: number;
  height?: number;
}

export interface RenderTemplateResult {
  ok: true;
  url: string;
  storagePath: string;
  width: number;
  height: number;
  imageSource: ImageSourceTag;
  imageAttribution: string | null;
  bytes: number;
}
export interface RenderTemplateError {
  ok: false;
  code: string;
  message: string;
}

export async function renderMarketingTemplate(
  input: RenderTemplateInput,
): Promise<RenderTemplateResult | RenderTemplateError> {
  if (!app) throw new Error('Firebase app not configured');
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions(app);
  const call = httpsCallable<RenderTemplateInput, RenderTemplateResult | RenderTemplateError>(
    functions,
    'renderMarketingTemplate',
  );
  const result = await call(input);
  return result.data;
}

// ── Compliance / scoring (M1) ──────────────────────────────────────────────
// Server-side regex screen against the brand's own ComplianceRules. Runs on
// any caption draft before it hits the queue. The Phase-3 cron will call
// this implicitly via the Cloud Function; the preview page calls it
// explicitly so the admin sees flags before approving.

export type ComplianceFlag = {
  type: 'forbidden_word' | 'blocked_topic';
  phrase: string;
  /** Index of the match in the original caption. */
  index: number;
};

export interface ScoreCaptionInput {
  caption: string;
}

export interface ScoreCaptionResult {
  ok: true;
  flags: ComplianceFlag[];
  /** Disclaimers that match the caption — caller appends to the caption tail. */
  requiredDisclaimers: string[];
  /** True when nothing tripped a forbidden word or blocked topic. */
  passes: boolean;
}
export interface ScoreCaptionError {
  ok: false;
  code: string;
  message: string;
}

export async function scoreMarketingDraft(
  input: ScoreCaptionInput,
): Promise<ScoreCaptionResult | ScoreCaptionError> {
  if (!app) throw new Error('Firebase app not configured');
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions(app);
  const call = httpsCallable<ScoreCaptionInput, ScoreCaptionResult | ScoreCaptionError>(
    functions,
    'scoreMarketingDraft',
  );
  const result = await call(input);
  return result.data;
}

// ── Cost log (M1) ──────────────────────────────────────────────────────────
// Every render writes a row to `marketing_cost_log` so the dashboard tile and
// monthly cap enforcement have real numbers. This wrapper just reads recent
// rows for the dashboard; writes happen server-side inside the renderer.

export interface CostLogRow {
  id: string;
  ts: string;            // ISO
  template: string;
  imageSource: ImageSourceTag;
  costInr: number;
  actor: string | null;
}

export async function fetchRecentCostLog(limitN = 60): Promise<CostLogRow[]> {
  if (!db) return [];
  try {
    const { collection, getDocs, limit, orderBy, query } = await import('firebase/firestore');
    const q = query(collection(db, 'marketing_cost_log'), orderBy('ts', 'desc'), limit(Math.min(limitN, 200)));
    const snap = await getDocs(q);
    return snap.docs.map((d): CostLogRow => {
      const data = d.data() as any;
      const ts = data?.ts;
      const iso = ts?.toDate ? ts.toDate().toISOString() : (typeof ts === 'string' ? ts : new Date().toISOString());
      return {
        id: d.id,
        ts: iso,
        template: typeof data?.template === 'string' ? data.template : 'unknown',
        imageSource: (typeof data?.imageSource === 'string' ? data.imageSource : 'none') as ImageSourceTag,
        costInr: typeof data?.costInr === 'number' ? data.costInr : 0,
        actor: typeof data?.actor === 'string' ? data.actor : null,
      };
    });
  } catch {
    return [];
  }
}

/** Sums cost rows for "today" and "this month" against the IST calendar. */
export function summariseCost(rows: CostLogRow[]): { today: number; month: number; lastTs: string | null } {
  const istNow = new Date(Date.now() + 5.5 * 3600 * 1000); // crude IST shift
  const todayKey = istNow.toISOString().slice(0, 10);
  const monthKey = istNow.toISOString().slice(0, 7);
  let today = 0;
  let month = 0;
  for (const r of rows) {
    const istTs = new Date(new Date(r.ts).getTime() + 5.5 * 3600 * 1000).toISOString();
    if (istTs.startsWith(monthKey)) month += r.costInr;
    if (istTs.startsWith(todayKey)) today += r.costInr;
  }
  return { today, month, lastTs: rows[0]?.ts ?? null };
}

function normaliseBrandKit(data: any): BrandKit {
  const fallback = defaultBrandKit();
  const ts = data?.updatedAt;
  const iso = ts?.toDate ? ts.toDate().toISOString() : (typeof ts === 'string' ? ts : null);
  return {
    brandName: typeof data?.brandName === 'string' ? data.brandName : fallback.brandName,
    logoUrl: typeof data?.logoUrl === 'string' ? data.logoUrl : null,
    palette: sanitisePalette(data?.palette ?? DEFAULT_PALETTE),
    fonts: sanitiseFonts(data?.fonts ?? DEFAULT_FONTS),
    voice: sanitiseVoice(data?.voice ?? DEFAULT_VOICE),
    themeCalendar: sanitiseThemeCalendar(data?.themeCalendar ?? DEFAULT_THEME_CALENDAR),
    hashtags: Array.isArray(data?.hashtags) ? sanitiseHashtags(data.hashtags) : DEFAULT_HASHTAGS,
    defaultPostTime: typeof data?.defaultPostTime === 'string' ? sanitiseTime(data.defaultPostTime) : '09:00',
    personas: sanitisePersonas(data?.personas),
    pillars: sanitisePillars(data?.pillars),
    culturalCalendar: sanitiseCulturalCalendar(data?.culturalCalendar),
    compliance: sanitiseCompliance(data?.compliance),
    costCaps: sanitiseCostCaps(data?.costCaps),
    illustrations: sanitiseIllustrations(data?.illustrations),
    cronEnabled: data?.cronEnabled === true,
    crisisPaused: data?.crisisPaused === true,
    crisisPauseReason: typeof data?.crisisPauseReason === 'string' ? data.crisisPauseReason : null,
    onboardedAt: tsToIso(data?.onboardedAt),
    styleProfile: data?.styleProfile ? sanitiseStyleProfile(data.styleProfile) : null,
    styleReferences: Array.isArray(data?.styleReferences)
      ? data.styleReferences.filter((r: any): r is string => typeof r === 'string').slice(0, 12)
      : [],
    cronOverrides: normaliseCronOverrides(data?.cronOverrides),
    updatedAt: iso,
    updatedBy: typeof data?.updatedBy === 'string' ? data.updatedBy : null,
  };
}

function normaliseCronOverrides(raw: unknown): CronOverrides {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: CronOverrides = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    if (!val || typeof val !== 'object') continue;
    const v = val as Record<string, unknown>;
    const override: CronOverride = {};
    if (v.skip === true) override.skip = true;
    if (typeof v.promptOverride === 'string' && v.promptOverride.trim()) {
      override.promptOverride = v.promptOverride.trim().slice(0, 400);
    }
    if (typeof v.personaId === 'string' && v.personaId.trim()) {
      override.personaId = v.personaId.trim().slice(0, 40);
    }
    if (typeof v.pillarId === 'string' && v.pillarId.trim()) {
      override.pillarId = v.pillarId.trim().slice(0, 40);
    }
    result[key] = override;
  }
  return result;
}

function tsToIso(ts: any): string | null {
  if (!ts) return null;
  if (typeof ts?.toDate === 'function') {
    try { return ts.toDate().toISOString(); } catch { return null; }
  }
  if (typeof ts === 'string') return ts;
  return null;
}

// ── Connection health (subscribe + manual re-check) ───────────────────────
// The probeMarketingHealth Cloud Function writes marketing_health/main.
// Clients subscribe for the live IG/FB dots in MarketingShell + Settings.
// The "Re-check now" button calls probeMarketingHealthNow which forces a
// fresh probe and returns the new state synchronously.

const HEALTH_PATH = 'marketing_health/main';

export function subscribeMarketingHealth(cb: (health: MarketingHealth | null) => void): Unsubscribe {
  if (!db) {
    cb(null);
    return () => {};
  }
  return onSnapshot(
    doc(db, HEALTH_PATH),
    (snap) => cb(snap.exists() ? normaliseHealth(snap.data()) : null),
    () => cb(null),
  );
}

interface ProbeNowResponse {
  ok: true;
  ig: { ok: boolean; handle: string | null; error: string | null };
  fb: { ok: boolean; handle: string | null; error: string | null };
}

export async function probeMarketingHealthNow(): Promise<ProbeNowResponse> {
  if (!app) throw new Error('Firebase app not configured');
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const fn = httpsCallable<unknown, ProbeNowResponse>(getFunctions(app), 'probeMarketingHealthNow');
  const result = await fn({});
  return result.data;
}

function normaliseHealth(data: any): MarketingHealth {
  return {
    ig: normaliseChannelHealth(data?.ig),
    fb: normaliseChannelHealth(data?.fb),
    lastCheckedAt: tsToIso(data?.lastCheckedAt),
  };
}

function normaliseChannelHealth(raw: any): ChannelHealth {
  if (!raw || typeof raw !== 'object') return UNKNOWN_CHANNEL_HEALTH;
  return {
    ok: raw.ok === true,
    checkedAt: tsToIso(raw.checkedAt),
    handle: typeof raw.handle === 'string' ? raw.handle : null,
    externalId: typeof raw.externalId === 'string' ? raw.externalId : null,
    error: typeof raw.error === 'string' ? raw.error : null,
    errorCode: typeof raw.errorCode === 'string' ? raw.errorCode : null,
  };
}

function sanitiseStyleProfile(raw: any): StyleProfile {
  // Caps raised 2026-05-05 to fit the audited DEFAULT_STYLE_PROFILE — the
  // codified prose runs ~2000 chars and includes specific motifs/palette
  // anchors. Below cap = truncation mid-sentence. Don't lower without
  // re-checking lib/marketingTypes.ts DEFAULT_STYLE_PROFILE lengths.
  return {
    oneLiner: typeof raw?.oneLiner === 'string' ? raw.oneLiner.slice(0, 320) : DEFAULT_STYLE_PROFILE.oneLiner,
    description: typeof raw?.description === 'string' ? raw.description.slice(0, 2500) : DEFAULT_STYLE_PROFILE.description,
    prohibited: Array.isArray(raw?.prohibited)
      ? raw.prohibited.filter((s: any): s is string => typeof s === 'string').slice(0, 40)
      : DEFAULT_STYLE_PROFILE.prohibited,
    artKeywords: typeof raw?.artKeywords === 'string' ? raw.artKeywords.slice(0, 400) : DEFAULT_STYLE_PROFILE.artKeywords,
  };
}

// ── Scheduler controls (Layer 2 + 3) ──────────────────────────────────────────
//
// saveCronOverride — writes (or clears) a per-date override into
//   marketing_brand/main.cronOverrides[YYYY-MM-DD]. Uses dot-notation merge
//   so it only touches that one key in the map.
//
// previewScheduledSlot — pure-client simulation of what the cron will pick
//   for a given date. Reads from the already-fetched BrandKit, no server round
//   trip. Used by the Today tab and Settings to show the "tomorrow" preview.
//
// generateAheadDrafts — calls the generateAheadDrafts Cloud Function, which
//   pre-generates pending_review drafts for the next N days.

/** Write (or clear) a per-date cron override. Pass `override: null` to remove. */
export async function saveCronOverride(
  actor: { uid: string; email: string | null | undefined },
  dateIso: string,
  override: CronOverride | null,
): Promise<void> {
  if (!db) throw new Error('Firestore not ready');
  const { updateDoc } = await import('firebase/firestore');
  const field = `cronOverrides.${dateIso}`;
  if (override === null) {
    const { deleteField } = await import('firebase/firestore');
    await updateDoc(doc(db, BRAND_PATH), { [field]: deleteField() });
  } else {
    const sanitised: CronOverride = {};
    if (override.skip === true) sanitised.skip = true;
    if (typeof override.promptOverride === 'string' && override.promptOverride.trim()) {
      sanitised.promptOverride = override.promptOverride.trim().slice(0, 400);
    }
    if (typeof override.personaId === 'string' && override.personaId.trim()) {
      sanitised.personaId = override.personaId.trim().slice(0, 40);
    }
    if (typeof override.pillarId === 'string' && override.pillarId.trim()) {
      sanitised.pillarId = override.pillarId.trim().slice(0, 40);
    }
    await updateDoc(doc(db, BRAND_PATH), { [field]: sanitised });
  }
  await logAdminAction(
    actor,
    'marketing.cron.override',
    { docId: 'main', label: `cron override ${dateIso}` },
    { dateIso, action: override === null ? 'clear' : override.skip ? 'skip' : 'override' },
  );
}

// ── Slot preview (pure-client) ───────────────────────────────────────────────

export interface ScheduledSlotPreview {
  dateIso: string;
  /** Weekday name, e.g. "Tuesday". */
  weekdayName: string;
  /** Theme label from the brand kit, e.g. "Tip Tuesday". */
  themeLabel: string;
  personaId: string | null;
  personaLabel: string | null;
  pillarId: string | null;
  pillarLabel: string | null;
  pillarEmoji: string | null;
  eventId: string | null;
  eventLabel: string | null;
  /** True when skip override is set for this date. */
  skipped: boolean;
  /** The active override (if any) for this date. */
  override: CronOverride | null;
}

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function toIstDate(d: Date): { isoDate: string; weekdayIdx: number } {
  const ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
  return {
    isoDate: ist.toISOString().slice(0, 10),
    weekdayIdx: ist.getUTCDay(),
  };
}

/** Pure-client simulation of what the 6 AM cron will pick for `targetDate`.
 *  No server round-trip — reads from the already-fetched BrandKit snapshot. */
export function previewScheduledSlot(brand: BrandKit, targetDate: Date): ScheduledSlotPreview {
  const { isoDate, weekdayIdx } = toIstDate(targetDate);
  const weekdayKey = WEEKDAY_KEYS[weekdayIdx];
  const weekdayName = WEEKDAY_NAMES[weekdayIdx];
  const override = brand.cronOverrides?.[isoDate] ?? null;
  const skipped = override?.skip === true;

  const enabledPersonas = brand.personas.filter((p) => p.enabled !== false);
  const enabledPillars = brand.pillars.filter((p) => p.enabled !== false);

  // Event matching: same MD as target date.
  const todayMd = isoDate.slice(5);
  const event = brand.culturalCalendar.find(
    (e) => e.date.slice(5) === todayMd || e.date === isoDate,
  ) ?? null;

  // Pillar: override → event pillarHint → first enabled
  let pillar = enabledPillars[0] ?? null;
  const pillarIdOverride = override?.pillarId ?? null;
  if (pillarIdOverride) {
    pillar = enabledPillars.find((p) => p.id === pillarIdOverride) ?? pillar;
  } else if (event?.pillarHint) {
    pillar = enabledPillars.find((p) => p.id === event.pillarHint) ?? pillar;
  }

  // Persona: override → day-of-month round-robin
  let persona: typeof enabledPersonas[0] | null = null;
  const personaIdOverride = override?.personaId ?? null;
  if (personaIdOverride) {
    persona = enabledPersonas.find((p) => p.id === personaIdOverride) ?? null;
  }
  if (!persona && enabledPersonas.length > 0) {
    const dayOfMonth = parseInt(isoDate.slice(8, 10), 10) || 1;
    persona = enabledPersonas[(dayOfMonth - 1) % enabledPersonas.length];
  }

  const theme = (brand.themeCalendar as any)?.[weekdayKey];
  return {
    dateIso: isoDate,
    weekdayName,
    themeLabel: theme?.label ?? weekdayKey,
    personaId: persona?.id ?? null,
    personaLabel: persona?.label ?? null,
    pillarId: pillar?.id ?? null,
    pillarLabel: pillar?.label ?? null,
    pillarEmoji: pillar?.emoji ?? null,
    eventId: event?.id ?? null,
    eventLabel: event?.label ?? null,
    skipped,
    override,
  };
}

// ── Ahead-generate callable wrapper ──────────────────────────────────────────

export interface GenerateAheadResult {
  ok: true;
  generated: number;
  skipped: number;
  results: { date: string; ok: boolean; draftId?: string; skipped?: string }[];
}

export async function generateAheadDrafts(days = 7): Promise<GenerateAheadResult | { ok: false; code: string; message: string }> {
  if (!app) return { ok: false, code: 'no-firebase', message: 'Not connected.' };
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const fn = httpsCallable<{ days: number }, GenerateAheadResult | { ok: false; code: string; message: string }>(
    getFunctions(app),
    'generateAheadDrafts',
  );
  try {
    const r = await fn({ days });
    return r.data;
  } catch (e: any) {
    return { ok: false, code: e?.code ?? 'callable-failed', message: e?.message ?? String(e) };
  }
}
