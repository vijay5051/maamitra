import { Pressable, StyleSheet, Text, View } from 'react-native';
import JustInTimePrompt from './JustInTimePrompt';
import { useProfileStore } from '../../store/useProfileStore';
import { Colors, Fonts } from '../../constants/theme';

type KidGender = 'boy' | 'girl';

export default function KidGenderPrompt() {
  const kids = useProfileStore((s) => s.kids);
  const activeKidId = useProfileStore((s) => s.activeKidId);
  const updateKid = useProfileStore((s) => s.updateKid);
  const dismiss = useProfileStore((s) => s.dismissPrompt);

  const activeKid = kids.find((k) => k.id === activeKidId) ?? kids[0];

  // Only renders for newborns with 'not-set' gender.
  // 'surprise' is a conscious choice — we never re-prompt for it.
  const visible =
    !!activeKid &&
    activeKid.stage === 'newborn' &&
    activeKid.gender === 'not-set';

  if (!visible) return null;

  const handlePick = (v: KidGender) => {
    if (!activeKid) return;
    updateKid(activeKid.id, { gender: v });
    dismiss('kidGender');
  };

  return (
    <JustInTimePrompt
      promptKey="kidGender"
      question={`Pick a gender for ${activeKid?.name ?? 'your baby'}`}
      reason="So MaaMitra uses the right pronouns and shows eligible schemes."
      visible={visible}
    >
      <View style={styles.row}>
        <Pressable
          onPress={() => handlePick('boy')}
          style={styles.chip}
          accessibilityRole="button"
          accessibilityLabel="Boy"
        >
          <Text style={styles.chipText}>Boy</Text>
        </Pressable>
        <Pressable
          onPress={() => handlePick('girl')}
          style={styles.chip}
          accessibilityRole="button"
          accessibilityLabel="Girl"
        >
          <Text style={styles.chipText}>Girl</Text>
        </Pressable>
      </View>
    </JustInTimePrompt>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderColor: Colors.border,
    borderWidth: 1,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.textDark },
});
