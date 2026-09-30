import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GradientButton from '../ui/GradientButton';
import { Colors, Fonts } from '../../constants/theme';
import { useMealSafety } from '../../hooks/useMealSafety';
import { useProfileStore } from '../../store/useProfileStore';
import { useAuthStore } from '../../store/useAuthStore';
import { saveFullProfile } from '../../services/firebase';
import { allergyLabel, COMMON_ALLERGENS, isAllergenKey } from '../../lib/mealSafety';

const INK = Colors.textDark;
const STONE = Colors.textLight;
const RED = '#B91C1C';
const RED_BG = '#FEF2F2';
const RED_BORDER = '#FCA5A5';

/** Persist the kids array (incl. allergies) the same way the Health tab does. */
function persistProfile(uid: string | undefined) {
  if (!uid) return;
  const s = useProfileStore.getState();
  saveFullProfile(uid, {
    motherName: s.motherName,
    profile: s.profile,
    kids: s.kids,
    completedVaccines: s.completedVaccines,
    onboardingComplete: s.onboardingComplete,
    photoUrl: s.photoUrl || '',
    parentGender: s.parentGender || '',
    bio: s.bio || '',
    expertise: s.expertise || [],
    visibilitySettings: s.visibilitySettings,
  }).catch((err) => console.warn('saveFullProfile (allergies) failed:', err));
}

/**
 * "Allergies · <kid>" strip shown above Tiffin, Travel Meals and the food
 * tracker. Tap → sheet to pick common allergens or type any other food.
 * Meals containing these get flagged everywhere (see MealSafetyNotice).
 */
export default function KidAllergyCard() {
  const { activeKid, allergies } = useMealSafety();
  const updateKid = useProfileStore((s) => s.updateKid);
  const uid = useAuthStore((s) => s.user?.uid);
  const [open, setOpen] = useState(false);

  if (!activeKid || activeKid.isExpecting) return null;
  const name = activeKid.name || 'your child';

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
        style={[styles.card, allergies.length > 0 && styles.cardSet]}
        accessibilityRole="button"
        accessibilityLabel={`Edit food allergies for ${name}`}
      >
        <Ionicons
          name={allergies.length ? 'alert-circle' : 'shield-checkmark-outline'}
          size={18}
          color={allergies.length ? RED : Colors.primary}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {allergies.length ? `${name} is allergic to` : `Any food allergies for ${name}?`}
          </Text>
          <Text style={[styles.sub, allergies.length > 0 && { color: RED }]} numberOfLines={2}>
            {allergies.length
              ? allergies.map(allergyLabel).join(', ')
              : 'Add them once — we’ll flag every meal that contains them.'}
          </Text>
        </View>
        <Text style={styles.edit}>{allergies.length ? 'Edit' : 'Add'}</Text>
      </TouchableOpacity>

      <AllergyEditor
        visible={open}
        kidName={name}
        initial={allergies}
        onClose={() => setOpen(false)}
        onSave={(list) => {
          updateKid(activeKid.id, { allergies: list });
          persistProfile(uid);
          setOpen(false);
        }}
      />
    </>
  );
}

function AllergyEditor({
  visible,
  kidName,
  initial,
  onClose,
  onSave,
}: {
  visible: boolean;
  kidName: string;
  initial: string[];
  onClose: () => void;
  onSave: (list: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(initial);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (visible) {
      setSelected(initial);
      setDraft('');
    }
  }, [visible, initial]);

  const toggle = (v: string) =>
    setSelected((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const addDraft = () => {
    const v = draft.trim().toLowerCase();
    if (v && !selected.includes(v)) setSelected((p) => [...p, v]);
    setDraft('');
  };

  const custom = selected.filter((s) => !isAllergenKey(s));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{kidName}’s food allergies</Text>
              <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={STONE} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sheetSub}>
              Meals in Tiffin, the weekly plan and Travel Meals that contain these will be flagged.
            </Text>
            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Common allergens</Text>
              <View style={styles.chips}>
                {COMMON_ALLERGENS.map((a) => {
                  const on = selected.includes(a.key);
                  return (
                    <TouchableOpacity
                      key={a.key}
                      onPress={() => toggle(a.key)}
                      style={[styles.chip, on && styles.chipOn]}
                      activeOpacity={0.8}
                    >
                      {on && <Ionicons name="checkmark" size={13} color="#fff" />}
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{a.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Any other food</Text>
              <View style={styles.inputRow}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="e.g. banana, tomato, mango"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.input}
                  returnKeyType="done"
                  onSubmitEditing={addDraft}
                  maxLength={40}
                />
                <TouchableOpacity
                  onPress={addDraft}
                  disabled={!draft.trim()}
                  style={[styles.addBtn, !draft.trim() && { opacity: 0.4 }]}
                  accessibilityLabel="Add food"
                >
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
              {custom.length > 0 && (
                <View style={[styles.chips, { marginTop: 10 }]}>
                  {custom.map((c) => (
                    <TouchableOpacity key={c} onPress={() => toggle(c)} style={[styles.chip, styles.chipOn]}>
                      <Text style={[styles.chipText, styles.chipTextOn]}>{c}</Text>
                      <Ionicons name="close" size={13} color="#fff" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>

            <GradientButton
              title={selected.length ? `Save ${selected.length} allerg${selected.length === 1 ? 'y' : 'ies'}` : 'Save — no allergies'}
              onPress={() => onSave(selected)}
              style={{ marginTop: 16 }}
            />
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primaryAlpha05,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primaryAlpha08,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  cardSet: { backgroundColor: RED_BG, borderColor: RED_BORDER },
  title: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: INK },
  sub: { fontFamily: Fonts.sansRegular, fontSize: 12, color: STONE, marginTop: 1 },
  edit: { fontFamily: Fonts.sansBold, fontSize: 13, color: Colors.primary },

  backdrop: { flex: 1, backgroundColor: 'rgba(28,16,51,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontFamily: Fonts.sansBold, fontSize: 17, color: INK, flex: 1 },
  sheetSub: { fontFamily: Fonts.sansRegular, fontSize: 12.5, color: STONE, marginTop: 4, marginBottom: 12, lineHeight: 18 },
  label: { fontFamily: Fonts.sansBold, fontSize: 12, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: '#fff',
  },
  chipOn: { backgroundColor: RED, borderColor: RED },
  chipText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: INK },
  chipTextOn: { color: '#fff', fontFamily: Fonts.sansSemiBold },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: INK,
  },
  addBtn: { width: 42, height: 42, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
});
