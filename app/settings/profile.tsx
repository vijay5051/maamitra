import { useMemo, useState } from 'react';
import {
  Alert,
  Image as RNImage,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore, type ParentGender } from '../../store/useProfileStore';
import { saveFullProfile, saveUserProfile } from '../../services/firebase';
import { uploadAvatar } from '../../services/storage';
import StateSelectorComponent from '../../components/onboarding/StateSelector';
import { ScreenHeader } from '../../components/settings/ScreenHeader';
import { Colors, Fonts, Radius, Spacing, withAlpha } from '../../constants/theme';

const EXPERTISE_COMMON = [
  'Baby Sleep', 'Nutrition', 'Child Development',
  'Baby Care', 'Mental Health', 'Vaccination', 'Yoga & Wellness',
];

const EXPERTISE_MOTHER = [
  'Breastfeeding', 'Postpartum Recovery', 'Pregnancy',
  'Lactation', 'Mom Self-Care', 'Working Mom', 'Birth Story',
];

const EXPERTISE_FATHER = [
  'Active Parenting', 'Bonding with Baby', 'Fatherhood Journey',
  'Co-Parenting', 'Work-Life Balance', 'Sleep Training',
];

const EXPERTISE_OTHER = [
  'Soothing Tricks', 'Family Routines', 'Multigenerational Care',
  'Caregiving', 'Bonding with Baby',
];

function getExpertiseOptions(parentGender: ParentGender): string[] {
  if (parentGender === 'father') return [...EXPERTISE_COMMON, ...EXPERTISE_FATHER];
  if (parentGender === 'other') return [...EXPERTISE_COMMON, ...EXPERTISE_OTHER];
  return [...EXPERTISE_COMMON, ...EXPERTISE_MOTHER];
}

async function pickSquareImage(): Promise<string | null> {
  if (Platform.OS !== 'web') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo access to choose an image.');
      return null;
    }
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.82,
    base64: true,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  if (asset.base64) return `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`;
  if (typeof asset.uri === 'string' && asset.uri.startsWith('data:')) return asset.uri;
  throw new Error('Could not read image data from the selected file.');
}

function ChipSelect({
  options,
  selected,
  onSelect,
}: {
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <View style={s.chipRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[s.chip, opt === selected && s.chipActive]}
          onPress={() => onSelect(opt)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={opt}
          accessibilityState={{ selected: opt === selected }}
        >
          <Text style={[s.chipText, opt === selected && s.chipTextActive]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function MultiChipSelect({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <View style={s.chipRow}>
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <TouchableOpacity
            key={opt}
            style={[s.chip, active && s.chipActive]}
            onPress={() => onToggle(opt)}
            activeOpacity={0.7}
          >
            <Text style={[s.chipText, active && s.chipTextActive]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function StatePickerModal({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: string;
  onSelect: (state: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={sp.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={sp.sheet}>
          <View style={sp.handleBar} />
          <View style={sp.header}>
            <Text style={sp.title}>Select State</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={Colors.textLight} />
            </TouchableOpacity>
          </View>
          <StateSelectorComponent
            selected={selected}
            onSelect={(state) => { onSelect(state); onClose(); }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    motherName, profile, photoUrl, parentGender, bio, expertise,
    setMotherName, setProfile, setPhotoUrl, setBio, setExpertise,
  } = useProfileStore();
  const { user } = useAuthStore();

  const [name, setName] = useState(motherName || '');
  const [state, setState] = useState(profile?.state || '');
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [diet, setDiet] = useState<'vegetarian' | 'eggetarian' | 'non-vegetarian' | 'vegan'>(
    (profile?.diet as 'vegetarian' | 'eggetarian' | 'non-vegetarian' | 'vegan') || 'vegetarian'
  );
  const [familyType, setFamilyType] = useState<'nuclear' | 'joint' | 'in-laws' | 'single-parent'>(
    (profile?.familyType as 'nuclear' | 'joint' | 'in-laws' | 'single-parent') || 'nuclear'
  );
  const [photo, setPhoto] = useState(photoUrl || '');
  const [bioText, setBioText] = useState(bio || '');
  const [expertiseTags, setExpertiseTags] = useState<string[]>(expertise || []);
  const [imgError, setImgError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);

  // parentGender is locked at signup. We surface the role-personalised
  // expertise pool but don't let the user re-pick gender here.
  const expertiseOptions = useMemo(() => {
    const pool = getExpertiseOptions(parentGender);
    const extras = expertiseTags.filter((t) => !pool.includes(t));
    return [...pool, ...extras];
  }, [parentGender, expertiseTags]);

  const handlePickPhoto = async () => {
    try {
      setPhotoLoading(true);
      const dataUrl = await pickSquareImage();
      if (!dataUrl) return;
      const uid = user?.uid;
      if (!uid) {
        Alert.alert('Sign in required', 'Please sign in again to update your photo.');
        return;
      }
      const downloadUrl = await uploadAvatar(uid, dataUrl);
      setPhoto(downloadUrl);
      setImgError(false);
    } catch (error) {
      console.error('pick profile photo failed:', error);
      Alert.alert('Could not save that photo', 'Upload to Firebase Storage failed. Check your connection and try again.');
    } finally {
      setPhotoLoading(false);
    }
  };

  const DIET_OPTIONS = ['vegetarian', 'eggetarian', 'non-vegetarian', 'vegan'];
  const FAMILY_OPTIONS: { key: 'nuclear' | 'joint' | 'in-laws' | 'single-parent'; label: string }[] = [
    { key: 'nuclear', label: 'Nuclear' },
    { key: 'joint', label: 'Joint' },
    { key: 'in-laws', label: 'With in-laws' },
    { key: 'single-parent', label: 'Single parent' },
  ];

  const toggleExpertise = (tag: string) =>
    setExpertiseTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (name.trim()) setMotherName(name.trim());
      if (profile) setProfile({ ...profile, state: state.trim() || profile.state, diet: diet as any, familyType: familyType as any });
      setPhotoUrl(photo.trim());
      setBio(bioText.trim());
      setExpertise(expertiseTags);

      if (user?.uid) {
        const st = useProfileStore.getState();
        await saveFullProfile(user.uid, {
          motherName: name.trim() || st.motherName,
          profile: st.profile
            ? { ...st.profile, state: state.trim() || st.profile.state, diet: diet as any, familyType: familyType as any }
            : st.profile,
          kids: st.kids,
          completedVaccines: st.completedVaccines,
          onboardingComplete: st.onboardingComplete,
          visibilitySettings: st.visibilitySettings,
          photoUrl: photo.trim(),
          parentGender: st.parentGender,
          bio: bioText.trim(),
          expertise: expertiseTags,
        });
        await saveUserProfile(user.uid, { photoUrl: photo.trim() });
      }

      router.back();
    } catch (error) {
      console.error('save profile failed:', error);
      Alert.alert('Could not save changes', 'Please try again once more.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Edit profile" />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        <Text style={s.editSectionTitle}>Profile Photo</Text>
        <View style={s.photoPickerWrap}>
          <View style={s.photoPreviewCircle}>
            {photo && !imgError ? (
              <RNImage source={{ uri: photo }} style={{ width: 80, height: 80, borderRadius: 40 }} onError={() => setImgError(true)} />
            ) : (
              <View style={s.photoPlaceholder}>
                <Ionicons name="person" size={36} color="#d1d5db" />
              </View>
            )}
          </View>
          <View style={s.photoActions}>
            <TouchableOpacity style={s.photoUploadBtn} onPress={handlePickPhoto} activeOpacity={0.8} disabled={photoLoading}>
              <Ionicons name="camera-outline" size={18} color={Colors.white} />
              <Text style={s.photoUploadText}>{photoLoading ? 'Processing…' : photo ? 'Change Photo' : 'Upload Photo'}</Text>
            </TouchableOpacity>
            {photo ? (
              <TouchableOpacity style={s.photoRemoveBtn} onPress={() => { setPhoto(''); setImgError(false); }} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={16} color={Colors.error} />
                <Text style={s.photoRemoveText}>Remove</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <Text style={s.editSectionTitle}>Your Name</Text>
        <TextInput
          style={s.textInput}
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={Colors.textMuted}
        />

        <Text style={s.editSectionTitle}>State</Text>
        <TouchableOpacity
          style={s.statePickerBtn}
          onPress={() => setShowStatePicker(true)}
          activeOpacity={0.75}
        >
          <Ionicons name="location-outline" size={18} color={Colors.primary} style={{ marginRight: 8 }} />
          <Text style={[s.statePickerText, !state && s.statePickerPlaceholder]}>
            {state || 'Select your state'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
        <StatePickerModal
          visible={showStatePicker}
          selected={state}
          onSelect={(val) => setState(val)}
          onClose={() => setShowStatePicker(false)}
        />

        <Text style={s.editSectionTitle}>Diet</Text>
        <ChipSelect
          options={DIET_OPTIONS}
          selected={diet}
          onSelect={(v) => setDiet(v as 'vegetarian' | 'eggetarian' | 'non-vegetarian' | 'vegan')}
        />

        <Text style={s.editSectionTitle}>Family Setup</Text>
        <ChipSelect
          options={FAMILY_OPTIONS.map((f) => f.label)}
          selected={FAMILY_OPTIONS.find((f) => f.key === familyType)?.label ?? 'Nuclear'}
          onSelect={(v) => {
            const found = FAMILY_OPTIONS.find((f) => f.label === v);
            if (found) setFamilyType(found.key);
          }}
        />

        <Text style={s.editSectionTitle}>Bio <Text style={s.optional}>(shown on your profile)</Text></Text>
        <TextInput
          style={[s.textInput, s.textArea]}
          value={bioText}
          onChangeText={setBioText}
          placeholder="Share a little about yourself…"
          placeholderTextColor={Colors.textMuted}
          multiline
          numberOfLines={3}
        />

        <Text style={s.editSectionTitle}>My Expertise <Text style={s.optional}>(pick all that apply)</Text></Text>
        <MultiChipSelect options={expertiseOptions} selected={expertiseTags} onToggle={toggleExpertise} />

        <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.85} disabled={saving}>
          <LinearGradient colors={[Colors.primary, Colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveBtnGrad}>
            <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl },
  editSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textLight,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: Radius.sm,
    paddingHorizontal: 14,
    paddingVertical: Spacing.md,
    fontSize: 15,
    color: '#1a1a2e',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top', paddingTop: Spacing.md },
  optional: { color: Colors.textMuted, fontWeight: '400', textTransform: 'none' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: 14,
    backgroundColor: '#f9fafb',
  },
  chipActive: {
    borderColor: Colors.primary,
    backgroundColor: withAlpha(Colors.textDark, 0.048),
  },
  chipText: { fontSize: 13, color: Colors.textLight, fontWeight: '500' },
  chipTextActive: { color: Colors.primary, fontWeight: '700' },
  saveBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 28 },
  saveBtnGrad: { paddingVertical: Spacing.lg, alignItems: 'center' },
  saveBtnText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  statePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: Radius.sm,
    paddingHorizontal: 14,
    paddingVertical: Spacing.md,
  },
  statePickerText: { flex: 1, fontSize: 15, color: '#1a1a2e' },
  statePickerPlaceholder: { color: Colors.textMuted },
  photoPickerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    backgroundColor: '#fdf6ff',
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.bgTint,
    marginBottom: Spacing.xs,
  },
  photoPreviewCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.bgTint,
  },
  photoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActions: { flex: 1, gap: 10 },
  photoUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  photoUploadText: { color: Colors.white, fontSize: 14, fontWeight: '600' },
  photoRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.xs,
  },
  photoRemoveText: { color: Colors.error, fontSize: 13, fontWeight: '500' },
});

const sp = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fdf6ff',
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.xl,
    paddingTop: 10,
    paddingBottom: 36,
    maxHeight: '75%',
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 17,
    fontFamily: Fonts.sansBold,
    color: '#1a1a2e',
  },
});
