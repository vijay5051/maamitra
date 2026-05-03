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
  BrandKit,
  defaultBrandKit,
  DEFAULT_FONTS,
  DEFAULT_HASHTAGS,
  DEFAULT_PALETTE,
  DEFAULT_THEME_CALENDAR,
  DEFAULT_VOICE,
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
    updatedAt: iso,
    updatedBy: typeof data?.updatedBy === 'string' ? data.updatedBy : null,
  };
}
