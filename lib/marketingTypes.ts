// Marketing automation types.
//
// The marketing module lives entirely under /admin/marketing/* in the
// existing admin panel. There is no separate app — same auth, shell, role
// gating. Firestore collections are namespaced `marketing_*`.
//
// Phase 1 ships the brand kit + setup overview. Subsequent phases add
// drafts, scheduled posts, inbox threads, and analytics — types for those
// are defined here up-front so other phases can wire to a stable shape.

export type MarketingPlatform = 'instagram' | 'facebook';
export type AutomationTemplate = 'auto' | 'tipCard' | 'quoteCard' | 'milestoneCard' | 'realStoryCard';

// ── Brand kit ───────────────────────────────────────────────────────────────
// Single Firestore doc at marketing_brand/main. Drives every rendered post:
// logo overlay, palette, fonts, voice, theme calendar.

export interface BrandPalette {
  /** Primary brand colour — used for accents, CTA, headlines. */
  primary: string;
  /** Background / canvas. */
  background: string;
  /** Body text. */
  text: string;
  /** Subtle highlight — used for tags, dividers. */
  accent: string;
}

export interface BrandFonts {
  /** Headline font family — must be available to Satori. */
  heading: string;
  /** Body font family. */
  body: string;
}

export interface BrandVoice {
  /** Three short adjectives describing the brand voice. */
  attributes: string[];
  /** Words / phrases the AI must avoid. */
  avoid: string[];
  /** Hindi+English mix preference. */
  bilingual: 'english_only' | 'hinglish' | 'devanagari_accents';
}

export type WeekDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** How often an automation slot generates a draft. */
export type SlotFrequency = 'daily' | 'alternate_day' | 'weekly' | 'monthly';

export interface ThemeForDay {
  /** Theme name shown to admin (e.g. "Tip Tuesday"). */
  label: string;
  /** Brief brief for the AI (e.g. "Practical 1-tip parenting hack"). */
  prompt: string;
  /** Whether this day is enabled. Disabled days produce no drafts. */
  enabled: boolean;
  /** When true, drafts for this day are auto-scheduled instead of queued for review. Overrides the slot-level setting. */
  autoSchedule?: boolean;
  /** Optional per-day post time override (IST "HH:MM"). When set, overrides the slot time for drafts on this weekday. */
  postTime?: string;
}

// ── Strategic foundation (M1) ───────────────────────────────────────────────
// Every generated draft is shaped by a (persona × pillar × locale) tuple plus
// the cultural calendar. Compliance and cost caps are guardrails the
// generator and scorer enforce server-side.

export interface AudiencePersona {
  /** Stable id — used in AI prompts and analytics joins. */
  id: string;
  label: string;
  /** Brief — concatenated into AI system prompts so drafts stay persona-aware. */
  description: string;
  enabled: boolean;
}

export interface ContentPillar {
  id: string;
  label: string;
  description: string;
  /** Optional emoji for list display + fallback hashtags. */
  emoji?: string;
  enabled: boolean;
}

export interface CulturalEvent {
  id: string;
  label: string;
  /** YYYY-MM-DD or YYYY-MM (month-floats for windows like World Breastfeeding
   *  Week). Yearly events store the upcoming year so sorting works. */
  date: string;
  recurrence: 'yearly' | 'one_off';
  /** Suggested pillar id for posts built around this event. */
  pillarHint?: string;
  /** Tone direction for the AI ("warm + reflective", "celebratory"…). */
  promptHint?: string;
}

export interface DisclaimerRule {
  /** Lower-case keyword that triggers this disclaimer. Whole-word match. */
  trigger: string;
  /** Disclaimer text appended to the caption tail when triggered. */
  text: string;
}

export interface ComplianceRules {
  /** Words/phrases banned from any draft. Whole-word, case-insensitive. */
  medicalForbiddenWords: string[];
  /** Auto-attached disclaimers. Multiple matches collapse to a unique set. */
  requiredDisclaimers: DisclaimerRule[];
  /** Topics that block publish until a senior admin reviews. */
  blockedTopics: string[];
}

export interface CostCaps {
  /** Hard ceiling per IST calendar day (₹). Generators refuse beyond this. */
  dailyInr: number;
  /** Hard ceiling per calendar month (₹). */
  monthlyInr: number;
  /** Surface a console + admin alert when usage crosses this percentage. */
  alertAtPct: number;
}

export interface BrandIllustration {
  /** Bundled-asset path relative to the project root, e.g.
   *  "assets/illustrations/community-hero.webp". */
  path: string;
  /** Human label shown in the picker. */
  label: string;
  /** Pillar ids this illustration is appropriate for; empty = any. */
  pillarIds: string[];
}

export interface AutomationSlot {
  /** Stable key used for generatedForKey and UI edits. */
  id: string;
  /** Human-readable label shown in Settings. */
  label: string;
  /** IST 24h time, e.g. "09:00". */
  time: string;
  /** Which template this slot should generate. "auto" lets the model pick. */
  template: AutomationTemplate;
  /** Platforms to publish on when this slot auto-schedules. */
  platforms: MarketingPlatform[];
  /** When false, cron skips this slot entirely. */
  enabled: boolean;
  /** True = create the draft directly as scheduled. False = create for review. */
  autoSchedule: boolean;
  /** How often this slot generates: daily (default), every other day, once per week, once per month. */
  frequency: SlotFrequency;
  /** For weekly frequency — which weekday to run on. Defaults to 'mon'. */
  runOnWeekDay?: WeekDay;
  /** For monthly frequency — which day of the month (1-28) to run on. Defaults to 1. */
  runOnMonthDay?: number;
}

export interface BrandKit {
  /** Display name shown on rendered posts (usually "MaaMitra"). */
  brandName: string;
  /** Public Storage URL for the logo (square PNG, ideally 1080×1080). */
  logoUrl: string | null;
  palette: BrandPalette;
  fonts: BrandFonts;
  voice: BrandVoice;
  /** One theme per weekday — drives daily content rotation. */
  themeCalendar: Record<WeekDay, ThemeForDay>;
  /** Default Instagram + Facebook hashtag set, applied to every draft. */
  hashtags: string[];
  /** Default posting time IST (24h "HH:mm"). */
  defaultPostTime: string;
  /** Multi-slot automation plan for cron-generated drafts. */
  automationSlots: AutomationSlot[];
  /** M1 strategic foundation. */
  personas: AudiencePersona[];
  pillars: ContentPillar[];
  culturalCalendar: CulturalEvent[];
  compliance: ComplianceRules;
  costCaps: CostCaps;
  /** Curated bank of in-app illustrations available as backgrounds. */
  illustrations: BrandIllustration[];
  /** Daily 6am-IST cron. Off by default to keep test deploys safe. */
  cronEnabled: boolean;
  /** When true, the cron + scheduled-publisher both no-op. Used during
   *  national tragedies, app outages, sensitive news. */
  crisisPaused: boolean;
  /** Human-readable note explaining the active pause (shown in admin UI). */
  crisisPauseReason: string | null;
  /** Studio onboarding completion (Studio v2). null = forced wizard runs on
   *  next /admin/marketing visit. ISO timestamp once admin finishes the
   *  3-step setup. */
  onboardedAt: string | null;
  /** Studio v2 — codified visual DNA (palette HSL bounds, line-weight,
   *  shape language, prohibited styles). Plain English; passed into AI
   *  prompts as a "style preamble" so generations stay on-brand. */
  styleProfile: StyleProfile | null;
  /** Studio v2 — 6-12 illustrations from `illustrations[]` curated as the
   *  canonical visual references. Image-gen calls pass these as style refs. */
  styleReferences: string[];
  /** Per-date scheduler overrides. Keyed by YYYY-MM-DD IST date.
   *  Cron reads the key matching today's IST date before generating.
   *  Skip a date, or override the persona/pillar/prompt for that day. */
  cronOverrides: CronOverrides;
  updatedAt: string | null;
  updatedBy: string | null;
}

// ── Scheduler overrides (Layer 2) ─────────────────────────────────────────────

/** Per-date control for automation. Can apply to the whole day or a single slot. */
export interface CronOverride {
  /** When true the cron silently skips this date — no draft is created. */
  skip?: boolean;
  /** Optional plain-English hint injected into the AI caption prompt for
   *  this date (e.g. "focus on Diwali safety tips for babies"). */
  promptOverride?: string;
  /** Force a specific persona id for this date, overriding the round-robin. */
  personaId?: string;
  /** Force a specific pillar id for this date, overriding the weighted pick. */
  pillarId?: string;
  /** Optional extra hint that applies across all slots for this date. */
  template?: AutomationTemplate;
}

export interface CronDayOverride {
  /** Optional date-wide fallback override. */
  default?: CronOverride;
  /** Optional slot-specific overrides keyed by automation slot id. */
  slots?: Record<string, CronOverride>;
}

/** YYYY-MM-DD → override data. Stored on marketing_brand/main. */
export type CronOverrides = Record<string, CronDayOverride>;

/**
 * Studio v2 — Brand Style Profile.
 *
 * Codifies what "MaaMitra style" actually means so AI image generation
 * can produce on-brand output. The plain-English fields are concatenated
 * into image-gen prompts as a style preamble, while curated illustration
 * references are passed directly into premium image-generation calls.
 * This profile remains the text fallback layer around those references.
 */
export interface StyleProfile {
  /** One-line distillation: "flat 2D illustration, pastel palette,
   *  rounded shapes, brown-skin Indian moms + babies, soft gradients". */
  oneLiner: string;
  /** Detailed style description fed to image-gen as a system-style prompt. */
  description: string;
  /** Things the AI must NOT produce. e.g. "no photorealism, no 3D renders,
   *  no harsh shadows, no Western-only character traits". */
  prohibited: string[];
  /** Comma-separated preferred art keywords for prompt suffixing. */
  artKeywords: string;
}

// Marketing identity is pink — deliberately distinct from the app's purple
// theme. Pink reads warmer + more "consumer brand" on social feeds, while
// the app stays purple inside. If you want them aligned later, set primary
// to '#7C3AED' (Colors.primary) + accent to '#F5F0FF' (Colors.primarySoft).
export const DEFAULT_PALETTE: BrandPalette = {
  primary: '#E91E63',     // brand pink (marketing identity)
  background: '#FFF8F2',  // warm off-white canvas
  text: '#1F1F2C',        // near-black neutral (no plum cast — pairs with pink)
  accent: '#F8C8DC',      // soft baby-pink companion
};

export const DEFAULT_FONTS: BrandFonts = {
  heading: 'Inter',
  body: 'Inter',
};

export const DEFAULT_VOICE: BrandVoice = {
  attributes: ['warm', 'honest', 'judgement-free'],
  avoid: ['miracle', 'cure', 'guaranteed', 'doctor-approved'],
  bilingual: 'hinglish',
};

export const DEFAULT_THEME_CALENDAR: Record<WeekDay, ThemeForDay> = {
  mon: { label: 'Mom-Wisdom Monday', prompt: 'A short story or learning from a real Indian mom. Warm, relatable, ends with one practical takeaway.', enabled: true, autoSchedule: false },
  tue: { label: 'Tip Tuesday', prompt: 'One specific, actionable parenting or pregnancy tip. Number + concrete action.', enabled: true, autoSchedule: false },
  wed: { label: 'Myth-Buster Wednesday', prompt: 'A common Indian-parenting myth + the actual evidence. Friendly correction, never judgemental.', enabled: true, autoSchedule: false },
  thu: { label: 'Throwback Thursday', prompt: 'A nostalgic / generational moment — pairing tradition with modern parenting.', enabled: true, autoSchedule: false },
  fri: { label: 'Friday Q&A', prompt: 'A question moms commonly DM us, answered in 3 lines max.', enabled: true, autoSchedule: false },
  sat: { label: 'Self-care Saturday', prompt: 'A reminder for moms to care for themselves. Specific, doable in 5 minutes.', enabled: true, autoSchedule: false },
  sun: { label: 'Sunday Reflection', prompt: 'A gentle quote or thought for the week ahead. Quiet, hopeful tone.', enabled: true, autoSchedule: false },
};

export const DEFAULT_HASHTAGS = [
  '#MaaMitra', '#IndianMoms', '#Parenting', '#NewMom',
  '#BabyCare', '#PregnancyJourney', '#MomLife',
];

export const DEFAULT_AUTOMATION_SLOTS: AutomationSlot[] = [
  {
    id: 'morning_auto',
    label: 'Morning post',
    time: '09:00',
    template: 'auto',
    platforms: ['instagram', 'facebook'],
    enabled: true,
    autoSchedule: false,
    frequency: 'daily',
  },
];

// ── M1 defaults — Indian-mom focused ────────────────────────────────────────

export const DEFAULT_PERSONAS: AudiencePersona[] = [
  { id: 'pregnancy',    label: 'Pregnancy',                  description: 'Pregnant women across all trimesters. Curious, slightly anxious, hungry for warmth and accuracy.',                                          enabled: true },
  { id: 'newborn_0_3',  label: 'Newborn mom (0-3 months)',   description: 'Brand-new moms — sleep-deprived, recovering, flooded with advice. Needs reassurance + concrete next steps.',                                enabled: true },
  { id: 'infant_3_12',  label: 'Infant mom (3-12 months)',   description: 'Infant moms — milestones, weaning, vaccines, sleep regressions. More confident, hungry for facts.',                                          enabled: true },
  { id: 'toddler',      label: 'Toddler mom (1-3 years)',    description: 'Toddler moms — language, food fights, tantrums, preschool decisions. Wants short, witty, practical content.',                                enabled: true },
  { id: 'mom_self',     label: 'Mom self-care',              description: 'Any-stage mom focused on her own mental, physical, emotional health. Needs permission to put herself first sometimes.',                       enabled: true },
];

export const DEFAULT_PILLARS: ContentPillar[] = [
  { id: 'health_safety',   label: 'Health & Safety',         description: 'Evidence-based parenting, paediatric safety, vaccines, red flags. Always cite or qualify.',                       emoji: '🩺', enabled: true },
  { id: 'milestones',      label: 'Milestones & Development', description: 'Age-appropriate milestones, "what to expect this month", normal-vs-flag developmental cues.',                    emoji: '🌱', enabled: true },
  { id: 'mom_wellness',    label: 'Mom Wellness',             description: 'Postpartum recovery, mental health, body image, sleep, nutrition for the mother.',                                 emoji: '🌸', enabled: true },
  { id: 'cultural_wisdom', label: 'Cultural Wisdom',          description: 'Indian traditions through a modern, evidence-checked lens. Honour what helps; gently update what doesn\'t.',     emoji: '🪔', enabled: true },
  { id: 'real_stories',    label: 'Real Stories',             description: 'Real Indian moms sharing real moments, with consent. Quotes, photos, mini case-studies.',                          emoji: '💬', enabled: true },
  { id: 'qa',              label: 'Q&A',                      description: 'Real questions from the app + DMs, answered crisply in 3 lines or less.',                                          emoji: '❓', enabled: true },
  { id: 'community',       label: 'Community',                description: 'Spotlights, group experiences, polls, events. Builds the "we" feeling.',                                            emoji: '🤝', enabled: true },
];

// Yearly Indian + global events relevant to motherhood. Dates are seeded for
// the upcoming year; admins can drift them forward. Approximate dates for
// lunar festivals — admin should confirm in their first review.
export const DEFAULT_CULTURAL_CALENDAR: CulturalEvent[] = [
  { id: 'diwali_2026',         label: 'Diwali',                       date: '2026-11-08', recurrence: 'yearly', pillarHint: 'cultural_wisdom', promptHint: 'Festive but safety-first — diyas, sweets, sound sensitivity for babies.' },
  { id: 'navratri_2026',       label: 'Navratri',                     date: '2026-10-12', recurrence: 'yearly', pillarHint: 'cultural_wisdom', promptHint: 'Pregnancy + fasting nuance, baby-friendly garba alternatives.' },
  { id: 'holi_2026',           label: 'Holi',                         date: '2026-03-04', recurrence: 'yearly', pillarHint: 'cultural_wisdom', promptHint: 'Skin-safe colours for babies, hydration, sun protection.' },
  { id: 'rakhi_2026',          label: 'Raksha Bandhan',               date: '2026-08-30', recurrence: 'yearly', pillarHint: 'real_stories',    promptHint: 'Sibling moments, first rakhi memories.' },
  { id: 'eid_2026',            label: 'Eid al-Fitr',                  date: '2026-03-21', recurrence: 'yearly', pillarHint: 'cultural_wisdom', promptHint: 'Inclusive content for Muslim moms, ramadan + breastfeeding nuances.' },
  { id: 'mothers_day_2026',    label: "Mother's Day",                 date: '2026-05-10', recurrence: 'yearly', pillarHint: 'mom_wellness',    promptHint: 'Permission to be celebrated. Real, not performative.' },
  { id: 'wbw_2026',            label: 'World Breastfeeding Week',     date: '2026-08-01', recurrence: 'yearly', pillarHint: 'health_safety',   promptHint: 'Judgement-free, science-backed; respect every feeding choice.' },
  { id: 'mental_health_2026',  label: 'World Mental Health Day',      date: '2026-10-10', recurrence: 'yearly', pillarHint: 'mom_wellness',    promptHint: 'PPD destigmatisation, hotline links, gentle.' },
  { id: 'childrens_day_2026',  label: "Children's Day",               date: '2026-11-14', recurrence: 'yearly', pillarHint: 'milestones',      promptHint: 'Childhood through Indian moms\' lens; nostalgia + present.' },
  { id: 'womens_day_2026',     label: "International Women's Day",    date: '2026-03-08', recurrence: 'yearly', pillarHint: 'mom_wellness',    promptHint: 'Mom = woman. Whole-self framing.' },
  { id: 'independence_2026',   label: 'Independence Day',             date: '2026-08-15', recurrence: 'yearly', pillarHint: 'community',       promptHint: 'Patriotic but soft — raising the next generation.' },
  { id: 'karva_chauth_2026',   label: 'Karva Chauth',                 date: '2026-10-29', recurrence: 'yearly', pillarHint: 'cultural_wisdom', promptHint: 'Pregnancy/breastfeeding fasting nuance, hydration.' },
];

export const DEFAULT_COMPLIANCE: ComplianceRules = {
  medicalForbiddenWords: [
    'cure', 'cures', 'curing', 'guaranteed', 'guarantee',
    'miracle', 'magical', 'instant', 'overnight',
    'doctor-approved', 'fda-approved', 'medically proven',
    'scientifically proven', 'always', 'never', 'definitely',
    '100%', '100 percent', 'risk-free', 'side-effect free',
  ],
  requiredDisclaimers: [
    { trigger: 'vaccine',       text: '*Schedule and recommendations vary; please consult your paediatrician.*' },
    { trigger: 'breastfeed',    text: '*Every feeding journey is different. This is not medical advice.*' },
    { trigger: 'formula',       text: '*Every feeding journey is different. This is not medical advice.*' },
    { trigger: 'postpartum',    text: '*If you feel persistent low mood or distress, reach out — Vandrevala 1860 2662 345.*' },
    { trigger: 'depression',    text: '*If you feel persistent low mood or distress, reach out — Vandrevala 1860 2662 345.*' },
    { trigger: 'medicine',      text: '*Not medical advice. Consult your doctor before any medication.*' },
    { trigger: 'medication',    text: '*Not medical advice. Consult your doctor before any medication.*' },
    { trigger: 'dosage',        text: '*Specific doses depend on your child. Always check with your paediatrician.*' },
    { trigger: 'fever',         text: '*High or persistent fever in babies needs a paediatrician — call yours.*' },
  ],
  blockedTopics: [
    'specific medication dosage', 'abortion', 'gender selection',
    'religious supremacy', 'caste', 'political party',
  ],
};

export const DEFAULT_COST_CAPS: CostCaps = {
  dailyInr:   200,    // ~50 Imagen renders / 5 ChatGPT renders / day
  monthlyInr: 3000,   // ~900 renders / month — well above 30-post cadence
  alertAtPct: 80,
};

// Curated subset of the 72 illustrations under assets/illustrations/. Tagged
// to pillars so the daily generator can pick a matching one when no real
// photo / AI image is needed. Admin can extend this list from the strategy
// editor.
export const DEFAULT_ILLUSTRATIONS: BrandIllustration[] = [
  { path: 'assets/illustrations/chat-mascot.webp',       label: 'Chat mascot',      pillarIds: ['qa', 'community'] },
  { path: 'assets/illustrations/community-hero.webp',    label: 'Community hero',   pillarIds: ['community', 'real_stories'] },
  { path: 'assets/illustrations/family-empty.webp',      label: 'Family',           pillarIds: ['real_stories', 'community'] },
  { path: 'assets/illustrations/health-hero.webp',       label: 'Health hero',      pillarIds: ['health_safety'] },
  { path: 'assets/illustrations/health-cat-baby.webp',   label: 'Baby health',      pillarIds: ['health_safety', 'milestones'] },
  { path: 'assets/illustrations/health-cat-mother.webp', label: 'Mother health',    pillarIds: ['health_safety', 'mom_wellness'] },
  { path: 'assets/illustrations/feature-india.webp',     label: 'India / cultural', pillarIds: ['cultural_wisdom'] },
  { path: 'assets/illustrations/feature-community.webp', label: 'Community feature', pillarIds: ['community'] },
  { path: 'assets/illustrations/feature-growth.webp',    label: 'Growth feature',   pillarIds: ['milestones'] },
  { path: 'assets/illustrations/feature-ai.webp',        label: 'AI feature',       pillarIds: ['qa'] },
  { path: 'assets/illustrations/dadi-ke-nuskhe-hero.webp', label: 'Dadi ke nuskhe', pillarIds: ['cultural_wisdom'] },
  { path: 'assets/illustrations/home-hero-afternoon.webp', label: 'Home hero',     pillarIds: [] },
];

export function defaultBrandKit(brandName = 'MaaMitra'): BrandKit {
  return {
    brandName,
    logoUrl: null,
    palette: DEFAULT_PALETTE,
    fonts: DEFAULT_FONTS,
    voice: DEFAULT_VOICE,
    themeCalendar: DEFAULT_THEME_CALENDAR,
    hashtags: DEFAULT_HASHTAGS,
    defaultPostTime: '09:00',
    automationSlots: DEFAULT_AUTOMATION_SLOTS,
    personas: DEFAULT_PERSONAS,
    pillars: DEFAULT_PILLARS,
    culturalCalendar: DEFAULT_CULTURAL_CALENDAR,
    compliance: DEFAULT_COMPLIANCE,
    costCaps: DEFAULT_COST_CAPS,
    illustrations: DEFAULT_ILLUSTRATIONS,
    cronEnabled: false,
    crisisPaused: false,
    crisisPauseReason: null,
    onboardedAt: null,
    styleProfile: DEFAULT_STYLE_PROFILE,
    styleReferences: [],
    cronOverrides: {},
    updatedAt: null,
    updatedBy: null,
  };
}

export const DEFAULT_STYLE_PROFILE: StyleProfile = {
  oneLiner: 'MaaMitra house style: crisp pastel Indian mom/baby/dadi illustrations with consistent warm Indian skin, rotating pastel chikankari wardrobe, clear prompt props, polished gouache-ink finish, no text or speech bubbles.',
  description: 'Match the best MaaMitra mother, baby, and dadi character illustrations. Premium hand-drawn Indian editorial illustration, not generic cartoon. Recurring young mother: consistent warm medium-brown Indian skin with soft peach undertones, soft oval face, almond brown eyes, delicate nose/lips, tiny bindi when visible, gold studs/bangles, thick dark brown hair in loose high bun or braid with wisps. Recurring baby/toddler: clean even warm Indian skin, round cheeks, big bright brown eyes, tiny dark curls, joyful curious expression, soft pastel clothes. Dadi/elder: kind silver-haired Indian grandmother in low bun, pastel saree/kurta, gentle smile. Wardrobe language: rotating pastel kurta, saree, baby clothes or dupatta in lavender, blush pink, sage green, mint, powder blue, peach, cream, or soft lilac with fine white chikankari/floral embroidery and soft fabric folds. Finish: crisp clean ink contours, refined face anatomy, smooth gouache/watercolor pastel fills, subtle paper grain, polished high-resolution edges, controlled soft shadows, premium children-book/editorial quality. Palette: ivory/cream background, lavender, blush pink, sage green, mint, powder blue, peach, warm terracotta, muted gold. Scene language: airy Indian home, floor cushions, rugs, plants/tulsi, teacups, wooden tables, yoga mats, wellness objects, and clearly visible props matching the prompt. Use generous negative space, balanced focal characters, clear readable action, no written text, no labels, no speech bubbles, no infographic panels.',
  prohibited: [
    'photorealism', 'photographs', '3D renders', 'CGI',
    'harsh shadows', 'high contrast', 'muddy colors', 'neon colors',
    'Western-only character traits', 'generic cartoon style', 'western stock look',
    'anime', 'manga', 'pixel art',
    'flat blob characters', 'low-detail doodles',
    'distorted hands', 'extra fingers', 'deformed faces',
    'skin blemishes', 'red patches on faces', 'plastic skin', 'airbrushed glamour',
    'cluttered backgrounds', 'busy compositions',
    'text', 'written text', 'labels', 'speech bubbles', 'empty speech balloons', 'infographic panels',
    'poster/card layout', 'logos', 'watermarks',
    'cropped faces', 'uncanny eyes', 'random character design',
  ],
  artKeywords: 'MaaMitra house style, Indian mother baby dadi, rotating pastel chikankari wardrobe, warm medium-brown Indian skin, clean baby skin, cream dupatta, crisp ink contours, polished gouache watercolor, pastel editorial, almond eyes, soft paper texture, ivory negative space, sage plants, blush cushions, visible prompt props, no text, no speech bubbles',
};

// ── Connections (Phase 4) ───────────────────────────────────────────────────
// One doc at marketing_connections/main. OAuth tokens stored encrypted.

export interface MarketingConnection {
  facebookPageId: string | null;
  facebookPageName: string | null;
  instagramBusinessId: string | null;
  instagramHandle: string | null;
  /** Long-lived Page access token, encrypted via Firebase Functions secret. */
  encryptedToken: string | null;
  /** When the token was minted. Long-lived tokens last ~60d; refresh job runs weekly. */
  tokenIssuedAt: string | null;
  tokenExpiresAt: string | null;
  connectedAt: string | null;
  connectedBy: string | null;
}

// ── Drafts (Phase 3) ────────────────────────────────────────────────────────

export type DraftStatus =
  | 'pending_review'
  | 'approved'
  | 'scheduled'
  | 'posted'
  | 'rejected'
  | 'failed';

export type ContentKind = 'image' | 'carousel' | 'video';

export interface DraftAsset {
  /** Public Storage URL of the rendered PNG/MP4. */
  url: string;
  /** Slide order within a carousel. 0 for single image. */
  index: number;
  /** Template name used to render this asset. */
  template: string;
}

export interface MarketingDraft {
  id: string;
  status: DraftStatus;
  kind: ContentKind;
  /** Which weekday-theme generated this draft. */
  themeKey: WeekDay;
  themeLabel: string;
  /** AI-generated caption with hashtags + disclaimers appended. ≤ 2200 chars. */
  caption: string;
  /** Rendered assets. Single image → 1 entry, carousel → ≤ 10. */
  assets: DraftAsset[];
  /** Which platforms this draft is targeted at. */
  platforms: MarketingPlatform[];
  /** Scheduled publish time IST. Null until approved. */
  scheduledAt: string | null;
  /** Set when status = 'posted'; the live post permalink. */
  postedAt: string | null;
  postPermalinks: Partial<Record<MarketingPlatform, string>>;
  /** If status = 'failed', the error from the publisher. */
  publishError: string | null;
  /** Compliance flags caught by scoreMarketingDraft. */
  safetyFlags: string[];
  /** ── M2: persona + pillar + event tagging ──────────────────────────────── */
  personaId: string | null;
  personaLabel: string | null;
  pillarId: string | null;
  pillarLabel: string | null;
  /** Cultural calendar event id this draft references, if any. */
  eventId: string | null;
  eventLabel: string | null;
  /** Locale of the caption ('en' | 'hinglish' | 'hi'). */
  locale: string | null;
  /** Headline shown in queue cards (≤ 80 chars). Distinct from caption. */
  headline: string | null;
  /** Structured fields passed to the template renderer (eyebrow / story /
   * attribution / tips / quote / milestones — shape varies by template).
   * Persisted so the admin can re-render or inspect the source content. */
  templateProps: Record<string, unknown> | null;
  /** Image prompt used by the generator — kept so admin can regenerate. */
  imagePrompt: string | null;
  /** Image source provider used for the rendered asset. */
  imageSource: string | null;
  /** Per-draft cost (₹) attributable to this generation (caption + image). */
  costInr: number;
  generatedAt: string | null;
  generatedBy: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectReason: string | null;
  /** M6 — set when admin clicked "Boost this post" on a posted draft. */
  boost: BoostInfo | null;
  /** M6 — set when this draft was rendered from a UGC submission. */
  ugcSubmissionId: string | null;
}

// ── UGC (M6) ────────────────────────────────────────────────────────────────
// User-generated content: real moms submit a photo + story from inside the
// app. Admin reviews + approves → renders as a Real Story draft. Consent is
// captured at submission and recorded in consent_ledger (DPDP).

export type UgcStatus = 'pending_review' | 'approved' | 'rejected' | 'rendered' | 'deleted';

export interface UgcSubmission {
  id: string;
  /** Submitter's Firebase uid. */
  uid: string;
  /** Display name as it should appear in the rendered post (caller can
   *  pass a nickname if they want anonymity). */
  displayName: string;
  /** Story text from the mom — 50-500 chars. */
  story: string;
  /** Storage URL of the submitted photo. Square; ideally >=1080×1080. */
  photoUrl: string | null;
  /** Storage path so admin can delete the asset on reject. */
  photoStoragePath: string | null;
  /** Optional age of the child mentioned in the story — drives template
   *  side-tag and analytics joins. */
  childAge: string | null;
  /** Pillar admin tagged this with at approval. Defaults to 'real_stories'. */
  pillarId: string | null;
  status: UgcStatus;
  rejectReason: string | null;
  /** When approved, points to the marketing_draft id we created. */
  renderedDraftId: string | null;
  /** Audit trail. */
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

// ── Boost (M6) ──────────────────────────────────────────────────────────────
// "Boost this post" via the Ads API. Stored on the parent draft.

export interface BoostInfo {
  /** Ads API ad set id. */
  adSetId: string;
  /** Status of the boost. */
  status: 'creating' | 'active' | 'paused' | 'completed' | 'failed';
  /** Daily INR budget the admin set. */
  dailyBudgetInr: number;
  /** Duration in days (1–7). */
  durationDays: number;
  /** Total spend so far (₹). Updated by polling. */
  spendInr: number;
  /** Reach attributable to the boost. Polled. */
  reach: number;
  startedAt: string;
  endsAt: string;
  /** Error from the Ads API if status='failed'. */
  error: string | null;
}

// ── Inbox (M4) ──────────────────────────────────────────────────────────────

export type InboxChannel = 'ig_comment' | 'ig_dm' | 'fb_comment' | 'fb_message';
export type InboxStatus = 'unread' | 'replied' | 'resolved' | 'archived' | 'spam';
export type InboxSentiment = 'positive' | 'question' | 'complaint' | 'neutral' | 'spam';
export type InboxIntent = 'greeting' | 'question_general' | 'question_medical' | 'praise' | 'complaint' | 'lead' | 'spam' | 'other';
export type InboxUrgency = 'low' | 'medium' | 'high';

export interface InboxThread {
  id: string;
  channel: InboxChannel;
  status: InboxStatus;
  sentiment: InboxSentiment;
  /** Classified intent — drives auto-reply rules + escalation. */
  intent: InboxIntent;
  /** Routing severity. 'high' surfaces in a top-of-list alert row. */
  urgency: InboxUrgency;
  /** External author display name from Meta. */
  authorName: string;
  /** External author Meta ID (PSID for Messenger, IGSID for IG). */
  authorExternalId: string;
  /** First-message snippet for list view. */
  preview: string;
  unreadCount: number;
  lastMessageAt: string;
  /** If this thread is on a post we created, link to the draft. */
  draftId: string | null;
  /** True for admin-injected test threads (M4a only — until Meta lands).
   *  Always rendered with a "TEST" badge so it's never confused with real. */
  isSynthetic: boolean;
  createdAt: string;
}

export type OutboundStatus = 'pending_send' | 'sent' | 'failed';

// ── Analytics (M5) ──────────────────────────────────────────────────────────
// One PostInsightSnapshot per fetch — stored as a subcollection of the draft
// at marketing_drafts/{id}/insights/{ts}. The latest values are also
// denormalised onto the parent draft for cheap queries.

export interface PostInsightMetrics {
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  saved: number;
  shares: number;
  profileVisits: number;
}

export interface PostInsightSnapshot extends PostInsightMetrics {
  /** ISO timestamp of when this snapshot was fetched. */
  fetchedAt: string;
  /** Hours since the post was published — useful for "1h / 24h / 7d" buckets. */
  hoursSincePost: number;
}

export interface AccountInsightDay {
  /** Calendar day in IST, YYYY-MM-DD. Doc id of marketing_account_insights. */
  date: string;
  /** IG follower count. */
  followerCount: number;
  /** IG daily reach. */
  reach: number;
  /** IG daily impressions. */
  impressions: number;
  /** Net IG follower change vs the previous stored day. Computed on write. */
  followersDelta: number;
  // ── FB Page (M4c) — undefined on days before M4c shipped or when FB unconfigured.
  /** FB Page fan / followers count. */
  fbFanCount?: number;
  /** FB Page daily reach. */
  fbReach?: number;
  /** FB Page daily impressions. */
  fbImpressions?: number;
  /** Net FB Page fan change vs the previous stored day. */
  fbFansDelta?: number;
}

export interface WeeklyDigest {
  /** ISO week id, e.g. "2026-W18". Doc id of marketing_insights. */
  weekId: string;
  weekStart: string;
  weekEnd: string;
  postsPublished: number;
  totalReach: number;
  totalImpressions: number;
  avgEngagementRate: number;
  /** LLM commentary on what worked + what didn't + recommendations. */
  commentary: string;
  /** Top 3 posts of the week by engagement rate. */
  topPosts: { draftId: string; headline: string; engagementRate: number }[];
  /** Recommended pillar shifts — feeds into the M5 feedback loop. */
  recommendations: string[];
  generatedAt: string;
}

export interface InboxMessage {
  id: string;
  threadId: string;
  /** 'inbound' = from external user; 'outbound' = our reply. */
  direction: 'inbound' | 'outbound';
  text: string;
  /** Attachment URLs from Meta (images, stickers). */
  attachments: string[];
  sentAt: string;
  /** For outbound: the admin who sent it. */
  sentBy: string | null;
  /** AI-suggested reply this message was generated from. */
  fromSuggestion: boolean;
  /** Outbound only — pending_send until M4b wires the Graph API call. */
  outboundStatus?: OutboundStatus;
  /** Outbound only — error message from the publisher when status=failed. */
  outboundError?: string | null;
  /** Inbound only — Meta event ID for idempotency (= Firestore doc id). */
  externalId?: string;
}

// ── Marketing health probe ─────────────────────────────────────────────────
// Single Firestore doc at marketing_health/main, written by the
// probeMarketingHealth Cloud Function (hourly cron + admin-callable
// "Refresh" button). Drives the IG/FB dots in the MarketingShell health
// chip and the Connected accounts card in Settings — replaces the previous
// optimistic "always green" UI with live token-validity state.

export interface ChannelHealth {
  /** True when the most recent probe call hit Graph successfully. */
  ok: boolean;
  /** ISO timestamp of the last probe attempt (success or failure). */
  checkedAt: string | null;
  /** Display handle resolved from Graph when ok (IG: @username, FB: Page name). */
  handle: string | null;
  /** Resource id resolved from Graph when ok. */
  externalId: string | null;
  /** When !ok: short, plain-English reason for the failure. */
  error: string | null;
  /** When !ok: Meta error code (or 'no-token', 'no-id', 'fetch-failed'). */
  errorCode: string | null;
}

export interface MarketingHealth {
  ig: ChannelHealth;
  fb: ChannelHealth;
  /** ISO timestamp of the most recent full probe pass. */
  lastCheckedAt: string | null;
}

export const UNKNOWN_CHANNEL_HEALTH: ChannelHealth = {
  ok: false,
  checkedAt: null,
  handle: null,
  externalId: null,
  error: null,
  errorCode: 'unknown',
};

export const UNKNOWN_MARKETING_HEALTH: MarketingHealth = {
  ig: UNKNOWN_CHANNEL_HEALTH,
  fb: UNKNOWN_CHANNEL_HEALTH,
  lastCheckedAt: null,
};
