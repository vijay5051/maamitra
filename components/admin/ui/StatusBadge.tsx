import { StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing, withAlpha } from '../../../constants/theme';

interface Props {
  label: string;
  /** Hex colour for the badge accent. Defaults to primary. */
  color?: string;
  size?: 'sm' | 'md';
  variant?: 'tint' | 'solid' | 'outline';
}

export default function StatusBadge({ label, color = Colors.primary, size = 'sm', variant = 'tint' }: Props) {
  const isSolid = variant === 'solid';
  const isOutline = variant === 'outline';
  return (
    <View
      style={[
        styles.base,
        size === 'md' && styles.md,
        {
          backgroundColor: isSolid ? color : isOutline ? 'transparent' : withAlpha(color, 0.12),
          borderColor: isOutline ? color : 'transparent',
          borderWidth: isOutline ? 1 : 0,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: isSolid ? Colors.white : color }]} />
      <Text style={[styles.text, { color: isSolid ? Colors.white : color }, size === 'md' && styles.textMd]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  md: { paddingHorizontal: Spacing.md, paddingVertical: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 0.2 },
  textMd: { fontSize: FontSize.sm },
});
