/**
 * AppIcon — brand-aware semantic icon component.
 *
 * Wraps Ionicons via a registry (`constants/icons.ts`) so every icon in the
 * app inherits a consistent palette by default. Replaces the older
 * 4-variant icon component (gradient/soft/white/plain) — that pattern had
 * zero callers other than `TabIcon` (preserved below for the existing
 * library tab caller).
 *
 * Usage:
 *   <AppIcon name="health.vaccine" />            // default role from registry
 *   <AppIcon name="action.delete" role="muted"/> // override per call site
 *   <AppIcon name="object.user" size={24}/>      // size override (default 20)
 *
 * To color an icon, in order from least to most surgical:
 *   1. Default — `<AppIcon name="..." />`. Picks the registry's defaultRole.
 *   2. Role override — `<AppIcon name="..." role="muted" />`.
 *   3. Color override — `<AppIcon name="..." color="#fff" />`. Last
 *      resort. Prefer adding a new role to ROLE_COLOR over hardcoded hex.
 */

import React from 'react';
import { StyleProp, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../constants/theme';
import { ICONS, IconKey, IconRole } from '../../constants/icons';

// Resolve a semantic IconRole to the actual hex from the brand palette.
// Centralised here so the next time the brand colour shifts, every icon
// across the app inherits the new value via this single map.
const ROLE_COLOR: Record<IconRole, string> = {
  action:  Colors.primary,
  success: Colors.sageMild,
  warning: Colors.ochreMild,
  error:   Colors.error,
  info:    Colors.lavenderMild,
  love:    Colors.primary,        // active heart inherits primary
  muted:   Colors.textMuted,
};

interface AppIconProps {
  name: IconKey;
  size?: number;
  role?: IconRole;
  /** Hard-override the resolved colour. Prefer `role` over hardcoded hex. */
  color?: string;
  accessibilityLabel?: string;
  style?: StyleProp<TextStyle>;
}

export function AppIcon({
  name,
  size = 20,
  role,
  color,
  accessibilityLabel,
  style,
}: AppIconProps): React.JSX.Element {
  const entry = ICONS[name];
  const finalColor = color ?? ROLE_COLOR[role ?? entry.defaultRole];
  return (
    <Ionicons
      name={entry.glyph}
      size={size}
      color={finalColor}
      accessibilityLabel={accessibilityLabel}
      style={style}
    />
  );
}

/**
 * Sub-tab icon used by the Library subtab pill bar (active/inactive
 * white-on-tint pattern). Kept on raw Ionicons names because the library
 * sub-tab data passes glyph names directly. Refactor to AppIcon if those
 * call sites ever migrate to semantic keys.
 */
export function TabIcon({ name, active }: { name: string; active: boolean }) {
  return (
    <Ionicons
      name={name as keyof typeof Ionicons.glyphMap}
      size={15}
      color={active ? '#ffffff' : '#A78BCA'}
    />
  );
}

export default AppIcon;
