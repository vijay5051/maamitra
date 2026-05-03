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

export interface ThemeForDay {
  /** Theme name shown to admin (e.g. "Tip Tuesday"). */
  label: string;
  /** Brief brief for the AI (e.g. "Practical 1-tip parenting hack"). */
  prompt: string;
  /** Whether this day is enabled. Disabled days produce no drafts. */
  enabled: boolean;
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
  updatedAt: string | null;
  updatedBy: string | null;
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
  mon: { label: 'Mom-Wisdom Monday', prompt: 'A short story or learning from a real Indian mom. Warm, relatable, ends with one practical takeaway.', enabled: true },
  tue: { label: 'Tip Tuesday', prompt: 'One specific, actionable parenting or pregnancy tip. Number + concrete action.', enabled: true },
  wed: { label: 'Myth-Buster Wednesday', prompt: 'A common Indian-parenting myth + the actual evidence. Friendly correction, never judgemental.', enabled: true },
  thu: { label: 'Throwback Thursday', prompt: 'A nostalgic / generational moment — pairing tradition with modern parenting.', enabled: true },
  fri: { label: 'Friday Q&A', prompt: 'A question moms commonly DM us, answered in 3 lines max.', enabled: true },
  sat: { label: 'Self-care Saturday', prompt: 'A reminder for moms to care for themselves. Specific, doable in 5 minutes.', enabled: true },
  sun: { label: 'Sunday Reflection', prompt: 'A gentle quote or thought for the week ahead. Quiet, hopeful tone.', enabled: true },
};

export const DEFAULT_HASHTAGS = [
  '#MaaMitra', '#IndianMoms', '#Parenting', '#NewMom',
  '#BabyCare', '#PregnancyJourney', '#MomLife',
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
    personas: DEFAULT_PERSONAS,
    pillars: DEFAULT_PILLARS,
    culturalCalendar: DEFAULT_CULTURAL_CALENDAR,
    compliance: DEFAULT_COMPLIANCE,
    costCaps: DEFAULT_COST_CAPS,
    illustrations: DEFAULT_ILLUSTRATIONS,
    cronEnabled: false,
    crisisPaused: false,
    crisisPauseReason: null,
    updatedAt: null,
    updatedBy: null,
  };
}

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
