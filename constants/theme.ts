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
  primary: '#7C3AED',           // brand purple — sole accent
  primarySoft: '#F5F0FF',       // tinted tile bg for icons / active chips
  bgLight: '#FAFAFB',           // page background (neutral, was warm cream)
  bgPink: '#F5F0FF',            // alias retained for older screens — now lilac
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
  cardBg: '#ffffff',
  overlay: 'rgba(0,0,0,0.5)',

  // ─── DEPRECATED — do not use in new code ─────────────────────────
  // Kept only for backward compatibility. Touching a file? Replace these
  // with primary/neutrals. They'll be removed once every screen is migrated.
  secondary: '#7C3AED',
  gold: '#F59E0B',
  sage: '#34D399',
  sky: '#60A5FA',
  stone: '#6B7280',
  cloud: '#F5F0FF',
} as const;

// ─── Gradients ─────────────────────────────────────────────────────────────────
// Most screens should prefer a solid `Colors.primary` over these gradients.
// Kept as tuples for backward compatibility; values are now tonal variations
// of brand purple rather than the old rose→purple rainbow.
//
// IMPORTANT: these are `as const` tuples at build time — at runtime we
// overwrite the .primary / .avatar / .childRose / .childPurple entries via
// setPrimaryAtRuntime() so the user-picked accent colour flows through
// components that render gradients (avatars, buttons that still use
// Gradients.primary, etc.). `as const` makes the type readonly but the
// underlying JS object is still mutable.
export const Gradients = {
  primary: ['#7C3AED', '#6d28d9'] as const,               // brand-only, subtle depth
  header: ['#1C1033', '#3b1060', '#6d1a7a'] as const,      // dark hero header kept
  avatar: ['#7C3AED', '#6d28d9'] as const,
  warmPink: ['#F5F0FF', '#EDE9F6'] as const,               // renamed in spirit — lilac now
  softPurple: ['#FAFAFB', '#F5F0FF'] as const,
  dark: ['#1C1033', '#4c1d95'] as const,
  momCard: ['#1C1033', '#3b1060'] as const,
  childRose: ['#7C3AED', '#6d28d9'] as const,
  childPurple: ['#7C3AED', '#6d28d9'] as const,
} as const;

// ─── Runtime theming ──────────────────────────────────────────────────────────
//
// The accent colour is user-pickable from Settings → Appearance. The picker
// writes the chosen hex into useThemeStore, which on every successful write
// (including the initial hydration from AsyncStorage / Firestore) calls
// setPrimaryAtRuntime(hex). That mutates the module-level `Colors` and
// `Gradients` objects.
//
// Caveat: StyleSheet.create() snapshots values at module-load time. Styles
// created BEFORE the user's preference is known will keep the default
// #7C3AED. So the theme store triggers a soft reload on web after a change
// (see useThemeStore) to rebuild every stylesheet cache cleanly. On native
// the user is prompted to restart the app.
//
// This trade-off keeps the implementation sane (zero refactors across
// ~500 Colors.primary references) while delivering a live-looking result
// to the user.

/** Darken a hex colour by mixing toward black. `amount` 0–1. */
function shade(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  const num = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = Math.max(0, Math.min(255, Math.round(((num >> 16) & 0xff) * (1 - amount))));
  const g = Math.max(0, Math.min(255, Math.round(((num >> 8) & 0xff) * (1 - amount))));
  const b = Math.max(0, Math.min(255, Math.round((num & 0xff) * (1 - amount))));
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** Lighten a hex colour by mixing toward white. `amount` 0–1. */
function tint(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  const num = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = Math.max(0, Math.min(255, Math.round(((num >> 16) & 0xff) + (255 - ((num >> 16) & 0xff)) * amount)));
  const g = Math.max(0, Math.min(255, Math.round(((num >> 8) & 0xff) + (255 - ((num >> 8) & 0xff)) * amount)));
  const b = Math.max(0, Math.min(255, Math.round((num & 0xff) + (255 - (num & 0xff)) * amount)));
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Overwrite the module-level Colors.primary / Colors.primarySoft /
 * Colors.secondary and the relevant Gradients entries with values derived
 * from a user-picked accent colour. Safe to call during app bootstrap
 * before any components render, or at runtime (followed by a reload).
 */
export function setPrimaryAtRuntime(hex: string): void {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
  const soft = tint(hex, 0.92);                        // ~#F5F0FF-equivalent
  const dark = shade(hex, 0.12);
  // Colors is `as const` at the type level but plain JS at runtime — these
  // writes do reach every call site that reads Colors.primary NEXT render.
  (Colors as any).primary = hex;
  (Colors as any).primarySoft = soft;
  (Colors as any).bgPink = soft;
  (Colors as any).bgTint = soft;
  (Colors as any).secondary = hex;
  (Colors as any).cloud = soft;
  // Tonal gradients take the same accent + a subtle darkening.
  (Gradients as any).primary  = [hex, dark];
  (Gradients as any).avatar   = [hex, dark];
  (Gradients as any).childRose   = [hex, dark];
  (Gradients as any).childPurple = [hex, dark];
}

/**
 * Curated palette shown in the Settings colour picker. Kept short and
 * tonally varied so every choice still reads premium against the neutral
 * canvas we built. `name` is shown in the picker label.
 */
export const ACCENT_PRESETS: ReadonlyArray<{ name: string; hex: string }> = [
  { name: 'Purple',  hex: '#7C3AED' }, // default
  { name: 'Indigo',  hex: '#4F46E5' },
  { name: 'Blue',    hex: '#2563EB' },
  { name: 'Teal',    hex: '#0D9488' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Amber',   hex: '#D97706' },
  { name: 'Coral',   hex: '#EA580C' },
  { name: 'Rose',    hex: '#E11D48' },
  { name: 'Pink',    hex: '#DB2777' },
  { name: 'Slate',   hex: '#475569' },
];

/** Synchronous web-storage key. MUST stay in sync with the mirror write
 *  done from useThemeStore.setPrimary(). */
export const ACCENT_STORAGE_KEY = 'maamitra-accent-primary';

// ─── Self-hydration (runs at module evaluation) ──────────────────────────────
//
// StyleSheet.create() in every other module snapshots Colors.primary at the
// moment THAT module is evaluated. If we wait for the async AsyncStorage
// rehydration (see useThemeStore.onRehydrateStorage) to apply the user's
// colour, the stylesheets in already-imported tabs have already cached
// the default — which is exactly why only the first tab showed the new
// colour in testing.
//
// The fix is to do a synchronous read from `localStorage` RIGHT HERE, at
// the bottom of this module's top-level code. All other modules that
// `import { Colors } from '../../constants/theme'` will get the mutated
// Colors object because module evaluation is strictly ordered.
//
// localStorage is only available on web. On native, AsyncStorage-backed
// rehydration via zustand's onRehydrateStorage still runs — native is
// single-screen-on-mount so the first-render delay isn't visible in
// the same way.
try {
  if (typeof globalThis !== 'undefined' && typeof (globalThis as any).localStorage !== 'undefined') {
    const ls = (globalThis as any).localStorage;
    const raw = ls.getItem(ACCENT_STORAGE_KEY);
    if (typeof raw === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw)) {
      setPrimaryAtRuntime(raw);
    }
  }
} catch (_) {
  // localStorage can throw in private-mode Safari / sandboxed iframes.
  // Falling through leaves the default purple — harmless.
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
// `Fonts.serif` is a deprecated alias kept for backward compatibility with
// ~30 existing callers. It now resolves to DM Sans Bold — we dropped the
// DM Serif Display face in favour of a single-family system. In new code,
// use `Fonts.sansBold` directly.
export const Fonts = {
  serif: 'DMSans_700Bold',
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
