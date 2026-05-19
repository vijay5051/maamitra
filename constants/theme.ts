import { TextStyle, ViewStyle } from 'react-native';

// ─── Colors ────────────────────────────────────────────────────────────────────
// Design rule (2026 refresh):
//   - `primary` is the ONLY accent colour — used for interactive elements,
//     active states, badges, and highlights. Everything else is neutral.
//   - Primary is now brand purple (was rose pink). The whole app inherits
//     this at once through the theme module; individual screens don't need
//     to be touched unless they hard-coded the old rose.
//   - `bgLight` is the page background; `bgTint` (was bgPink) is a subtle
//     lilac for pills, tiles, and highlighted cards.
//   - Status / semantic colours (success/warning/error) remain — reserve
//     them for their meanings (success = green, error = red, etc.).
export const Colors = {
  primary: '#7B5E9C',           // brand purple — sole accent (Deep dupatta)
  primarySoft: '#EFEAF5',       // tinted tile bg for icons / active chips
  // Pre-computed alpha variants of the brand primary. Use these for tinted
  // fills/borders instead of inline rgba() strings.
  primaryAlpha05: 'rgba(123,94,156,0.05)',
  primaryAlpha08: 'rgba(123,94,156,0.08)',
  primaryAlpha12: 'rgba(123,94,156,0.12)',
  primaryAlpha20: 'rgba(123,94,156,0.20)',
  primaryAlpha25: 'rgba(123,94,156,0.25)',
  bgLight: '#FBF7F1',           // warm cream page bg (lifted from neutral grey)
  bgPink: '#F5F0FF',            // alias retained for older screens — lilac
  bgTint: '#F5F0FF',            // preferred name for the tinted tile bg
  white: '#ffffff',
  textDark: '#1C1033',          // ink-plum
  textMuted: '#9ca3af',
  textLight: '#6b7280',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  border: '#E5E1EE',            // 1px dividers (was EDE9F6 — tuned)
  borderSoft: '#F0EDF5',        // even quieter dividers
  cardBg: '#FFFCF7',            // whisper-cream cards (was pure white — fintech-y)
  overlay: 'rgba(0,0,0,0.5)',

  // ─── Brand semantic accents ──────────────────────────────────────
  // Soft motherly palette extracted from the illustration set. Use
  // sparingly and *semantically* — one accent per card max — so the
  // app stops reading as a wall of purple. Rule of thumb:
  //   - sageMild  → health/wellness/positive (vaccine done, mood logged)
  //   - blushMild → love/community/social warmth
  //   - ochreMild → milestones / celebrations / premium badges
  //   - lavenderMild → decorative, secondary surfaces
  //   - creamWarm → illustration-matched bg (#FFF8F1) for hero plates
  sageMild: '#B7D8B5',
  blushMild: '#FDD9D2',
  ochreMild: '#F4C97A',
  lavenderMild: '#C9B6F2',
  creamWarm: '#FFF8F1',

  // ─── DEPRECATED — do not use in new code ─────────────────────────
  // Kept only for backward compatibility. Touching a file? Replace these
  // with primary/neutrals or the new semantic accents above. They'll be
  // removed once every screen is migrated.
  secondary: '#7B5E9C',
  gold: '#F59E0B',
  sage: '#34D399',
  sky: '#60A5FA',
  stone: '#6B7280',
  cloud: '#F5F0FF',
} as const;

// ─── Gradients ─────────────────────────────────────────────────────────────────
// Most screens should prefer a solid `Colors.primary` over these gradients.
// Kept as tuples for backward compatibility; values are tonal variations
// of brand purple. Brand is a single constant — no runtime overrides.
export const Gradients = {
  primary: ['#7B5E9C', '#674E84'] as const,               // brand-only, subtle depth
  header: ['#1C1033', '#3b1060', '#6d1a7a'] as const,      // dark hero header kept
  avatar: ['#7B5E9C', '#674E84'] as const,
  warmPink: ['#F5F0FF', '#EDE9F6'] as const,               // renamed in spirit — lilac now
  softPurple: ['#FAFAFB', '#F5F0FF'] as const,
  dark: ['#1C1033', '#4c1d95'] as const,
  momCard: ['#1C1033', '#3b1060'] as const,
  childRose: ['#7B5E9C', '#674E84'] as const,
  childPurple: ['#7B5E9C', '#674E84'] as const,
} as const;

/**
 * Convert a #RRGGBB hex to a rgba() string with the given alpha (0–1).
 * Used for brand-tinted surfaces (button hover, chip fill, divider glow).
 *
 * Prefer the `Colors.primaryAlpha*` presets for hot paths — they're
 * pre-computed constants that don't bust StyleSheet caches.
 */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r},${g},${b},${a})`;
}

// ─── Border Radius ─────────────────────────────────────────────────────────────
export const Radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
  full: 999,
} as const;

// ─── Spacing ───────────────────────────────────────────────────────────────────
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// ─── Shadows ───────────────────────────────────────────────────────────────────
// Shadows — neutral dark (not pink) so cards feel premium, not toyish.
export const Shadow = {
  sm: {
    shadowColor: '#1C1033',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    boxShadow: '0px 2px 8px rgba(28, 16, 51, 0.05)',
  } as ViewStyle,
  md: {
    shadowColor: '#1C1033',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    boxShadow: '0px 4px 12px rgba(28, 16, 51, 0.08)',
  } as ViewStyle,
  lg: {
    shadowColor: '#1C1033',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 8,
    boxShadow: '0px 8px 20px rgba(28, 16, 51, 0.10)',
  } as ViewStyle,
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
    boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.04)',
  } as ViewStyle,
} as const;

// ─── Font Families ─────────────────────────────────────────────────────────────
// Typography rule:
//   - Use `sansBold` for hero/display moments — the app name, a landing
//     greeting ("Good morning, Vijay"), or the single biggest title on a
//     screen. Never for repeated titles.
//   - Use `sansSemiBold` for section titles and card headings.
//   - Use `sansRegular` for body copy, `sansMedium` for captions / metadata.
//
// `Fonts.serif` is the warm humanist serif (Lora 700) used for greetings,
// section titles, hero copy, and other headline moments. Pairs with DM Sans
// for body. Reintroduced after the all-sans phase was found to read fintech-y;
// the existing ~30 callsites that already use `Fonts.serif` get auto-uplifted
// to the real serif just by changing this alias.
//
// `Fonts.serifMedium` (Lora 500) is for italics-style accent moments — quiet
// affirmations on Home, "Today for Aarav" caption text, etc.
export const Fonts = {
  serif: 'Lora_700Bold',
  serifMedium: 'Lora_500Medium',
  sansRegular: 'DMSans_400Regular',
  sansMedium: 'DMSans_500Medium',
  sansSemiBold: 'DMSans_600SemiBold',
  sansBold: 'DMSans_700Bold',
  mono: 'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
} as const;

// ─── Font Sizes ────────────────────────────────────────────────────────────────
export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  display: 36,
} as const;

// ─── Font Weights ──────────────────────────────────────────────────────────────
export const FontWeight = {
  normal: '400' as TextStyle['fontWeight'],
  medium: '500' as TextStyle['fontWeight'],
  semibold: '600' as TextStyle['fontWeight'],
  bold: '700' as TextStyle['fontWeight'],
  heavy: '800' as TextStyle['fontWeight'],
} as const;

// ─── Default Theme Export ──────────────────────────────────────────────────────
const Theme = {
  Colors,
  Gradients,
  Radius,
  Spacing,
  Shadow,
  Fonts,
  FontSize,
  FontWeight,
};

export default Theme;
