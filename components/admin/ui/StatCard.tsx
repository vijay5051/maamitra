import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, useWindowDimensions, View, ViewStyle } from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../../constants/theme';

interface Props {
  label: string;
  value: string | number;
  icon?: keyof typeof Ionicons.glyphMap;
  /** % change vs previous period. Positive = up. */
  delta?: number;
  /** Override delta colour-direction (e.g. churn going up is bad). */
  deltaPositive?: 'up' | 'down';
  hint?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

export default function StatCard({
  label,
  value,
  icon,
  delta,
  deltaPositive = 'up',
  hint,
  onPress,
  style,
}: Props) {
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta);
  const isUp = (delta ?? 0) > 0;
  const isGood = hasDelta && (deltaPositive === 'up' ? isUp : !isUp);
  const deltaColor = hasDelta ? (isGood ? Colors.success : Colors.error) : Colors.textMuted;

  const Wrapper: any = onPress ? Pressable : View;
  // On phone-sized viewports, drop the minWidth so two cards reliably
  // fit per row even on a 360px screen, and tighten interior padding.
  const { width } = useWindowDimensions();
  const isNarrow = width < 700;

  return (
    <Wrapper
      onPress={onPress}
      style={[styles.card, isNarrow && styles.cardNarrow, style]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <View style={styles.headerRow}>
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
        {icon ? (
          <View style={styles.iconRing}>
            <Ionicons name={icon} size={14} color={Colors.primary} />
          </View>
        ) : null}
      </View>
      <Text style={[styles.value, isNarrow && styles.valueNarrow]} numberOfLines={1}>
        {typeof value === 'number' ? formatNumber(value) : value}
      </Text>
      <View style={styles.footerRow}>
        {hasDelta ? (
          <View style={[styles.deltaPill, { backgroundColor: isGood ? '#DCFCE7' : '#FEE2E2' }]}>
            <Ionicons
              name={isUp ? 'arrow-up' : 'arrow-down'}
              size={11}
              color={deltaColor}
            />
            <Text style={[styles.deltaText, { color: deltaColor }]}>
              {Math.abs(delta!).toFixed(1)}%
            </Text>
          </View>
        ) : null}
        {hint ? <Text style={styles.hint} numberOfLines={1}>{hint}</Text> : null}
      </View>
    </Wrapper>
  );
}

function formatNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return n.toLocaleString();
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 160,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  cardNarrow: {
    // Two-up grid even on 360px screens (16 padding × 2 + 12 gap = 44 chrome
    // → ~158px per card on a 360 viewport, so 140 leaves headroom).
    minWidth: 140,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  valueNarrow: { fontSize: FontSize.xl },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textLight, letterSpacing: 0.4, textTransform: 'uppercase' },
  iconRing: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  value: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textDark, letterSpacing: -0.5 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  deltaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full,
  },
  deltaText: { fontSize: FontSize.xs, fontWeight: '700' },
  hint: { fontSize: FontSize.xs, color: Colors.textMuted },
});
