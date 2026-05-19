import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import JustInTimePrompt from './JustInTimePrompt';
import { useProfileStore } from '../../store/useProfileStore';
import { Colors, Fonts } from '../../constants/theme';

const FALLBACK_NAMES = ['Little one', 'Sibling'];

export default function KidNamePrompt() {
  const kids = useProfileStore((s) => s.kids);
  const activeKidId = useProfileStore((s) => s.activeKidId);
  const updateKid = useProfileStore((s) => s.updateKid);
  const dismiss = useProfileStore((s) => s.dismissPrompt);

  const activeKid = kids.find((k) => k.id === activeKidId) ?? kids[0];
  const isFallbackName =
    !activeKid?.name || FALLBACK_NAMES.includes(activeKid.name);
  const visible = !!activeKid && isFallbackName;

  const [value, setValue] = useState('');

  if (!visible) return null;

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || !activeKid) return;
    updateKid(activeKid.id, { name: trimmed });
    dismiss('kidName');
  };

  return (
    <JustInTimePrompt
      promptKey="kidName"
      question="Has your little one got a name yet?"
      reason="Adding it makes MaaMitra feel a lot more personal."
      visible={visible}
    >
      <View style={styles.row}>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="e.g. Aarav, Diya, Aanya"
          placeholderTextColor={Colors.textLight}
          autoCapitalize="words"
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />
        <Pressable
          onPress={handleSubmit}
          style={[styles.saveBtn, !value.trim() && styles.saveBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Save name"
          disabled={!value.trim()}
        >
          {/* Checkmark-shaped inner dot — minimal, token-only */}
          <View style={styles.saveBtnInner} />
        </Pressable>
      </View>
    </JustInTimePrompt>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderColor: Colors.border,
    borderWidth: 1,
    backgroundColor: Colors.white,
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: Colors.textDark,
  },
  saveBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: Colors.border,
  },
  saveBtnInner: {
    width: 12,
    height: 12,
    backgroundColor: Colors.white,
    borderRadius: 2,
  },
});
