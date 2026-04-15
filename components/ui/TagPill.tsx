import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

type PillSize = 'sm' | 'md';

interface TagPillProps {
  label: string;
  color?: string;
  bgColor?: string;
  style?: ViewStyle;
  size?: PillSize;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function TagPill({
  label,
  color = '#ec4899',
  bgColor,
  style,
  size = 'sm',
}: TagPillProps) {
  const resolvedBg = bgColor ?? hexToRgba(color, 0.12);

  const isMd = size === 'md';

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: resolvedBg,
          paddingHorizontal: isMd ? 14 : 10,
          paddingVertical: isMd ? 6 : 4,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color,
            fontSize: isMd ? 13 : 12,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
