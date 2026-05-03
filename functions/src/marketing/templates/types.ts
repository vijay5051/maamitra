// Shared types for the Satori template registry.
//
// Each template module exports a `render(props, brand)` function that returns
// a Satori-compatible JSX tree. The renderer dispatches to the right template
// by name. Brand kit comes in once per call so templates can pull palette,
// fonts, and the logo URL.

export interface BrandPalette {
  primary: string;
  background: string;
  text: string;
  accent: string;
}

export interface BrandSnapshot {
  brandName: string;
  logoUrl: string | null;
  palette: BrandPalette;
}

export type TemplateName = 'tipCard' | 'quoteCard' | 'milestoneCard';

// ── Per-template prop shapes ────────────────────────────────────────────────
// Sanitised + length-capped server-side before rendering. Captions / hashtags
// are NOT in here — they live alongside the rendered image in the draft doc.

export interface TipCardProps {
  /** Short headline at the top, e.g. "Tip Tuesday". */
  eyebrow: string;
  /** Main headline, ~3-7 words. */
  title: string;
  /** 2-4 numbered tips. Each ≤ 90 chars. */
  tips: string[];
  /** Optional accent. Defaults to brand.palette.accent. */
  accent?: string;
}

export interface QuoteCardProps {
  /** The quote itself, ~10-30 words. */
  quote: string;
  /** Attribution. Optional — empty string for proverbs. */
  attribution: string;
  /** URL of a soft background image (e.g. from Pexels). Falls back to a
   *  gradient if missing. */
  backgroundUrl?: string;
}

export interface MilestoneCardProps {
  /** Eyebrow, e.g. "4 months" or "Week 12". */
  age: string;
  /** Title, e.g. "What to expect". */
  title: string;
  /** 3-6 milestones, each a short phrase. */
  milestones: string[];
  /** Optional baby photo URL (e.g. from Pexels). */
  photoUrl?: string;
}

export type AnyTemplateProps = TipCardProps | QuoteCardProps | MilestoneCardProps;
