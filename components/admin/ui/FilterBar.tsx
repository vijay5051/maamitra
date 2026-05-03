import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '../../../constants/theme';

export interface FilterChip {
  key: string;
  label: string;
  count?: number;
}

interface Props {
  chips: FilterChip[];
  active: string;
  onChange: (key: string) => void;
}

export default function FilterBar({ chips, active, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {chips.map((c) => {
        const isActive = c.key === active;
        return (
          <Pressable
            key={c.key}
            onPress={() => onChange(c.key)}
            style={[styles.chip, isActive && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>{c.label}</Text>
            {typeof c.count === 'number' ? (
              <View style={[styles.countPill, isActive && styles.countPillActive]}>
                <Text style={[styles.countText, isActive && styles.countTextActive]}>
                  {c.count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgLight,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textDark },
  labelActive: { color: Colors.white },
  countPill: {
    minWidth: 20, paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: Radius.full, backgroundColor: Colors.cardBg, alignItems: 'center',
  },
  countPillActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
  countText: { fontSize: 11, fontWeight: '700', color: Colors.textDark },
  countTextActive: { color: Colors.white },
});
