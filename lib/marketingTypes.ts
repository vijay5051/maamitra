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
  updatedAt: string | null;
  updatedBy: string | null;
}

export const DEFAULT_PALETTE: BrandPalette = {
  primary: '#E91E63',
  background: '#FFF8F2',
  text: '#1F1F2C',
  accent: '#F8C8DC',
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
  /** AI-generated caption with hashtags appended. ≤ 2200 chars (IG cap). */
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
  /** Brand-safety flags caught by AI screen. */
  safetyFlags: string[];
  generatedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
}

// ── Inbox (Phase 6) ─────────────────────────────────────────────────────────

export type InboxChannel = 'ig_comment' | 'ig_dm' | 'fb_comment' | 'fb_message';
export type InboxStatus = 'unread' | 'replied' | 'archived' | 'spam';
export type InboxSentiment = 'positive' | 'question' | 'complaint' | 'neutral' | 'spam';

export interface InboxThread {
  id: string;
  channel: InboxChannel;
  status: InboxStatus;
  sentiment: InboxSentiment;
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
  createdAt: string;
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
}
