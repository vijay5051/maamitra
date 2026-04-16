/**
 * AppIcon — unified gradient / light icon system for MaaMitra
 *
 * Usage:
 *   <AppIcon name="heart-outline" variant="gradient" size={20} />
 *   <AppIcon name="book-outline"  variant="soft"     size={18} />
 *   <AppIcon name="shield-checkmark-outline" variant="plain" color="#E8487A" size={22} />
 */

import React from 'react';
import { View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export type IconVariant = 'gradient' | 'soft' | 'white' | 'plain';

interface AppIconProps {
  name: string;
  size?: number;
  variant?: IconVariant;
  /** gradient stop colours — only used when variant='gradient' */
  colors?: [string, string];
  /** icon tint — used by variant='soft' and 'plain' */
  color?: string;
  /** border-radius as a fraction of box size (0–1). default: 0.3 */
  radiusFactor?: number;
  style?: ViewStyle;
}

const DEFAULT_GRADIENT: [string, string] = ['#E8487A', '#7C3AED'];
const DEFAULT_COLOR = '#E8487A';

export function AppIcon({
  name,
  size = 20,
  variant = 'plain',
  colors = DEFAULT_GRADIENT,
  color = DEFAULT_COLOR,
  radiusFactor = 0.3,
  style,
}: AppIconProps) {
  if (variant === 'plain') {
    return <Ionicons name={name as any} size={size} color={color} />;
  }

  const padding = Math.round(size * 0.42);
  const boxSize = size + padding * 2;
  const radius = Math.round(boxSize * radiusFactor);

  const boxBase: ViewStyle = {
    width: boxSize,
    height: boxSize,
    borderRadius: radius,
    alignItems: 'center',
    justifyContent: 'center',
    ...(style as object),
  };

  if (variant === 'gradient') {
    return (
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={boxBase}
      >
        <Ionicons name={name as any} size={size} color="#fff" />
      </LinearGradient>
    );
  }

  if (variant === 'white') {
    return (
      <View style={[boxBase, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
        <Ionicons name={name as any} size={size} color="#fff" />
      </View>
    );
  }

  // soft — light rose tint box
  return (
    <View style={[boxBase, { backgroundColor: 'rgba(232,72,122,0.09)' }]}>
      <Ionicons name={name as any} size={size} color={color} />
    </View>
  );
}

/** Convenience: sub-tab icon, 16px plain rose/plum */
export function TabIcon({ name, active }: { name: string; active: boolean }) {
  return (
    <Ionicons
      name={name as any}
      size={15}
      color={active ? '#fff' : '#A78BCA'}
    />
  );
}

export default AppIcon;
