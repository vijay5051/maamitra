import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../../constants/theme';

export type Stage = 'pregnant' | 'newborn';

interface Props {
  value: Stage | null;
  onChange: (v: Stage) => void;
}

const OPTIONS: { v: Stage; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { v: 'pregnant', label: "We're expecting", icon: 'heart-outline' },
  { v: 'newborn', label: 'Baby is here', icon: 'happy-outline' },
];

export default function StageChip({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((o) => {
        const active = value === o.v;
        return (
          <Pressable
            key={o.v}
            onPress={() => onChange(o.v)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: active }}
          >
            <Ionicons name={o.icon} size={20} color={active ? Colors.primary : Colors.textLight} />
            <Text style={[styles.label, active && styles.labelActive]}>{o.label}</Text>
            {active && (
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={Colors.primary}
                style={styles.check}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  chipActive: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  label: { fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.textLight },
  labelActive: { fontFamily: Fonts.sansBold, color: Colors.primary },
  check: { marginLeft: 4 },
});
