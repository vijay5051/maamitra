import { Pressable, StyleSheet, Text, View } from 'react-native';
import JustInTimePrompt from './JustInTimePrompt';
import { useProfileStore } from '../../store/useProfileStore';
import { Colors, Fonts } from '../../constants/theme';

type Diet = 'vegetarian' | 'eggetarian' | 'non-vegetarian' | 'vegan';

const DIETS: { v: Diet; label: string }[] = [
  { v: 'vegetarian', label: 'Vegetarian' },
  { v: 'eggetarian', label: 'Eggetarian' },
  { v: 'non-vegetarian', label: 'Non-veg' },
  { v: 'vegan', label: 'Vegan' },
];

export default function DietPrompt() {
  const profile = useProfileStore((s) => s.profile);
  const setProfile = useProfileStore((s) => s.setProfile);
  const dismiss = useProfileStore((s) => s.dismissPrompt);

  const visible = !!profile && !profile.diet;

  const handlePick = (v: Diet) => {
    if (!profile) return;
    setProfile({ ...profile, diet: v });
    dismiss('diet');
  };

  return (
    <JustInTimePrompt
      promptKey="diet"
      question="What works for your home?"
      reason="So we filter weaning foods to match your kitchen."
      visible={visible}
    >
      <View style={styles.chipRow}>
        {DIETS.map((d) => (
          <Pressable
            key={d.v}
            onPress={() => handlePick(d.v)}
            style={styles.chip}
            accessibilityRole="button"
            accessibilityLabel={d.label}
          >
            <Text style={styles.chipText}>{d.label}</Text>
          </Pressable>
        ))}
      </View>
    </JustInTimePrompt>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: 999,
    borderColor: Colors.border,
    borderWidth: 1,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.textDark },
});
