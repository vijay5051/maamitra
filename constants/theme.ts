import { TextStyle, ViewStyle } from 'react-native';

// ─── Colors ────────────────────────────────────────────────────────────────────
export const Colors = {
  primary: '#ec4899',
  secondary: '#8b5cf6',
  bgLight: '#fdf6ff',
  bgPink: '#fdf2f8',
  white: '#ffffff',
  textDark: '#1a1a2e',
  textMuted: '#9ca3af',
  textLight: '#6b7280',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  border: '#f3e8ff',
  cardBg: '#ffffff',
  overlay: 'rgba(0,0,0,0.5)',
} as const;

// ─── Gradients ─────────────────────────────────────────────────────────────────
export const Gradients = {
  primary: ['#ec4899', '#8b5cf6'] as const,
  header: ['#f472b6', '#a78bfa'] as const,
  avatar: ['#ec4899', '#8b5cf6'] as const,
  warmPink: ['#fdf2f8', '#fce7f3'] as const,
  softPurple: ['#fdf6ff', '#ede9fe'] as const,
  dark: ['#1e1b4b', '#4c1d95'] as const,
} as const;

// ─── Border Radius ─────────────────────────────────────────────────────────────
export const Radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
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
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    boxShadow: '0px 2px 8px rgba(236, 72, 153, 0.08)',
  } as ViewStyle,
  md: {
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 6,
    boxShadow: '0px 4px 12px rgba(236, 72, 153, 0.14)',
  } as ViewStyle,
  lg: {
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.20,
    shadowRadius: 20,
    elevation: 10,
    boxShadow: '0px 8px 20px rgba(139, 92, 246, 0.20)',
  } as ViewStyle,
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
  FontSize,
  FontWeight,
};

export default Theme;
