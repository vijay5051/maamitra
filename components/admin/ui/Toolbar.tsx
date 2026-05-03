import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '../../../constants/theme';

interface Props {
  search?: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  };
  actions?: React.ReactNode;
  /** Items shown on the left (before search). Counts, filters, etc. */
  leading?: React.ReactNode;
  style?: ViewStyle;
}

export default function Toolbar({ search, actions, leading, style }: Props) {
  return (
    <View style={[styles.bar, style]}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      {search ? (
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={Colors.textMuted} />
          <TextInput
            value={search.value}
            onChangeText={search.onChange}
            placeholder={search.placeholder ?? 'Search…'}
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
          />
          {search.value ? (
            <Pressable onPress={() => search.onChange('')} hitSlop={6}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      ) : <View style={{ flex: 1 }} />}
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

interface ButtonProps {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
}

export function ToolbarButton({ label, icon, onPress, variant = 'secondary', disabled }: ButtonProps) {
  const styleVariant = variant === 'primary'
    ? styles.primary
    : variant === 'danger'
      ? styles.danger
      : variant === 'ghost'
        ? styles.ghost
        : styles.secondary;
  const textVariant = variant === 'primary' || variant === 'danger'
    ? styles.primaryText
    : variant === 'ghost'
      ? styles.ghostText
      : styles.secondaryText;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[styles.btn, styleVariant, disabled && { opacity: 0.5 }]}
      accessibilityRole="button"
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={15}
          color={variant === 'primary' || variant === 'danger' ? Colors.white : Colors.textDark}
        />
      ) : null}
      <Text style={[styles.btnText, textVariant]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.cardBg, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  leading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    backgroundColor: Colors.bgLight, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  searchInput: { flex: 1, fontSize: FontSize.sm, color: Colors.textDark, padding: 0 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderRadius: Radius.md,
  },
  primary: { backgroundColor: Colors.primary },
  primaryText: { color: Colors.white },
  secondary: { backgroundColor: Colors.bgLight, borderWidth: 1, borderColor: Colors.borderSoft },
  secondaryText: { color: Colors.textDark },
  danger: { backgroundColor: Colors.error },
  ghost: { backgroundColor: 'transparent' },
  ghostText: { color: Colors.textDark },
  btnText: { fontSize: FontSize.sm, fontWeight: '600' },
});
