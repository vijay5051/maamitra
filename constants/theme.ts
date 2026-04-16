import { TextStyle, ViewStyle } from 'react-native';

// ─── Colors ────────────────────────────────────────────────────────────────────
export const Colors = {
  primary: '#E8487A',           // rose (was #ec4899)
  secondary: '#7C3AED',         // plum (was #8b5cf6)
  bgLight: '#FFF8FC',           // warm cream (was #fdf6ff)
  bgPink: '#FFF0F5',            // warm pink-white (was #fdf2f8)
  white: '#ffffff',
  textDark: '#1C1033',          // ink-plum (was #1a1a2e)
  textMuted: '#9ca3af',
  textLight: '#6b7280',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  border: '#EDE9F6',            // (was #f3e8ff)
  cardBg: '#ffffff',
  overlay: 'rgba(0,0,0,0.5)',
  gold: '#F59E0B',              // premium badges, streaks
  sage: '#34D399',              // health success
  sky: '#60A5FA',               // info / accent blue
  stone: '#6B7280',             // secondary muted text
  cloud: '#F8F4FF',             // soft purple-white background
} as const;

// ─── Gradients ─────────────────────────────────────────────────────────────────
export const Gradients = {
  primary: ['#E8487A', '#7C3AED'] as const,
  header: ['#1C1033', '#3b1060', '#6d1a7a'] as const,   // dark hero header
  avatar: ['#E8487A', '#7C3AED'] as const,
  warmPink: ['#FFF0F5', '#FCE7F3'] as const,
  softPurple: ['#FFF8FC', '#EDE9F6'] as const,
  dark: ['#1C1033', '#4c1d95'] as const,
  momCard: ['#1C1033', '#3b1060'] as const,              // family mom card
  childRose: ['#E8487A', '#7C3AED'] as const,
  childPurple: ['#7C3AED', '#60A5FA'] as const,
} as const;

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
export const Shadow = {
  sm: {
    shadowColor: '#E8487A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    boxShadow: '0px 2px 8px rgba(232, 72, 122, 0.08)',
  } as ViewStyle,
  md: {
    shadowColor: '#E8487A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 6,
    boxShadow: '0px 4px 12px rgba(232, 72, 122, 0.14)',
  } as ViewStyle,
  lg: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.20,
    shadowRadius: 20,
    elevation: 10,
    boxShadow: '0px 8px 20px rgba(124, 58, 237, 0.20)',
  } as ViewStyle,
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    boxShadow: '0px 2px 12px rgba(0, 0, 0, 0.06)',
  } as ViewStyle,
} as const;

// ─── Font Families ─────────────────────────────────────────────────────────────
export const Fonts = {
  serif: 'DMSerifDisplay_400Regular',
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
