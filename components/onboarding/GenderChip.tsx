import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Fonts } from '../../constants/theme';
import type { Stage } from './StageChip';

export type GenderChipValue = 'boy' | 'girl' | 'surprise';

interface Props {
  stage: Stage;
  value: GenderChipValue | null;
  onChange: (v: GenderChipValue) => void;
}

export default function GenderChip({ stage, value, onChange }: Props) {
  const options: { v: GenderChipValue; label: string }[] =
    stage === 'pregnant'
      ? [
          { v: 'boy', label: 'Boy' },
          { v: 'girl', label: 'Girl' },
          { v: 'surprise', label: 'Surprise' },
        ]
      : [
          { v: 'boy', label: 'Boy' },
          { v: 'girl', label: 'Girl' },
        ];

  return (
    <View style={styles.row}>
      {options.map((o) => {
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
            <Text style={[styles.label, active && styles.labelActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  label: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.textLight },
  // Active label uses Colors.white (token) — primary background needs white text
  labelActive: { fontFamily: Fonts.sansBold, color: Colors.white },
});
