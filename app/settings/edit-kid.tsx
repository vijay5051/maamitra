import { useMemo, useState } from 'react';
import {
  Alert,
  Image as RNImage,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import {
  useProfileStore,
  calculateAgeInMonths,
  calculateAgeInWeeks,
  type Kid,
} from '../../store/useProfileStore';
import { saveFullProfile, saveUserProfile } from '../../services/firebase';
import { uploadKidAvatar } from '../../services/storage';
import StageChip, { type Stage } from '../../components/onboarding/StageChip';
import GenderChip, { type GenderChipValue } from '../../components/onboarding/GenderChip';
import LivePreviewPill from '../../components/onboarding/LivePreviewPill';
import { validateNewbornDob, validatePregnantDueDate } from '../../lib/dateValidation';
import DatePickerField from '../../components/ui/DatePickerField';
import { ScreenHeader } from '../../components/settings/ScreenHeader';
import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';

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

export default function EditKidScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { kidId } = useLocalSearchParams<{ kidId?: string }>();
  const { user } = useAuthStore();
  const { kids, removeKid } = useProfileStore();
  const kid = useMemo(() => kids.find((k) => k.id === kidId) ?? null, [kids, kidId]);

  if (!kid) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <ScreenHeader title="Edit child" />
        <View style={s.missingWrap}>
          <Text style={s.missingTitle}>Child not found</Text>
          <Text style={s.missingBody}>This child may have been removed. Go back and pick another.</Text>
        </View>
      </View>
    );
  }

  return (
    <EditKidForm
      kid={kid}
      onBack={() => router.back()}
      onRemove={async (id) => {
        const kidName = kid.name || 'this child';
        const doRemove = async () => {
          removeKid(id);
          if (user?.uid) {
            const st = useProfileStore.getState();
            saveFullProfile(user.uid, {
              motherName: st.motherName,
              profile: st.profile,
              kids: st.kids,
              completedVaccines: st.completedVaccines,
              onboardingComplete: st.onboardingComplete,
              visibilitySettings: st.visibilitySettings,
              photoUrl: st.photoUrl || '',
              parentGender: st.parentGender || '',
              bio: st.bio || '',
              expertise: st.expertise || [],
            }).catch(console.error);
          }
          router.back();
        };
        if (typeof window !== 'undefined' && (window as any).confirm) {
          if ((window as any).confirm(`Remove ${kidName}?\n\nThis will delete all their vaccine records too. This cannot be undone.`)) {
            await doRemove();
          }
        } else {
          Alert.alert(
            `Remove ${kidName}?`,
            'This will delete all their vaccine records too. This cannot be undone.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: () => { void doRemove(); } },
            ],
          );
        }
      }}
      insetsBottom={insets.bottom}
    />
  );
}

function EditKidForm({
  kid,
  onBack,
  onRemove,
  insetsBottom,
}: {
  kid: Kid;
  onBack: () => void;
  onRemove: (kidId: string) => void;
  insetsBottom: number;
}) {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { updateKid } = useProfileStore();
  const [name, setName] = useState(kid.name || '');
  const [stage, setStage] = useState<Stage>(kid.stage === 'pregnant' ? 'pregnant' : 'newborn');
  const [keyDate, setKeyDate] = useState(kid.dob ? kid.dob.split('T')[0] : '');
  const [dateError, setDateError] = useState<string | null>(null);
  const [genderChip, setGenderChip] = useState<GenderChipValue | null>(
    kid.gender === 'boy' || kid.gender === 'girl' || kid.gender === 'surprise' ? kid.gender : null,
  );
  const [photo, setPhoto] = useState(kid.photoUrl || '');
  const [photoLoading, setPhotoLoading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [saving, setSaving] = useState(false);

  const onDateChange = (v: string) => {
    setKeyDate(v);
    setDateError(stage === 'pregnant' ? validatePregnantDueDate(v) : validateNewbornDob(v));
  };

  const onStageChange = (next: Stage) => {
    setStage(next);
    setGenderChip(null);
    if (keyDate) {
      setDateError(next === 'pregnant' ? validatePregnantDueDate(keyDate) : validateNewbornDob(keyDate));
    }
  };

  const livePreview = useMemo(() => {
    if (!keyDate || dateError) return null;
    const d = new Date(keyDate + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    if (stage === 'pregnant') {
      const weeksUntilDue = Math.round((d.getTime() - Date.now()) / (7 * 86400000));
      const weeks = Math.max(0, Math.min(40, 40 - weeksUntilDue));
      const tri = weeks <= 13 ? 'first' : weeks <= 27 ? 'second' : 'third';
      return `Around ${weeks} weeks along — ${tri} trimester.`;
    }
    const months = Math.max(0, Math.round((Date.now() - d.getTime()) / (30.5 * 86400000)));
    const who = name.trim() || 'Little one';
    return `${who} is ${months} ${months === 1 ? 'month' : 'months'} old.`;
  }, [stage, keyDate, dateError, name]);

  const handlePickKidPhoto = async () => {
    try {
      setPhotoLoading(true);
      const dataUrl = await pickSquareImage();
      if (!dataUrl) return;
      const uid = user?.uid;
      if (!uid) {
        Alert.alert('Sign in required', 'Please sign in again to attach a photo.');
        return;
      }
      const downloadUrl = await uploadKidAvatar(uid, kid.id, dataUrl);
      setPhoto(downloadUrl);
      setImgError(false);
    } catch (error) {
      console.error('pick child photo failed:', error);
      Alert.alert('Could not save that photo', 'Upload to Firebase Storage failed. Check your connection and try again.');
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleSave = async () => {
    if (dateError) return;
    setSaving(true);
    try {
      const updates: Partial<Omit<Kid, 'id'>> = {};
      updates.name = name.trim() || kid.name;
      if (keyDate) {
        const parsed = new Date(keyDate + 'T00:00:00');
        if (!isNaN(parsed.getTime())) {
          updates.dob = parsed.toISOString();
          updates.ageInMonths = calculateAgeInMonths(parsed.toISOString());
          updates.ageInWeeks = calculateAgeInWeeks(parsed.toISOString());
        }
      }
      updates.stage = stage;
      updates.isExpecting = stage === 'pregnant';
      updates.gender = genderChip ?? (stage === 'pregnant' ? 'surprise' : 'not-set');
      updates.photoUrl = photo.trim();
      updateKid(kid.id, updates);

      if (user?.uid) {
        const st = useProfileStore.getState();
        await saveFullProfile(user.uid, {
          motherName: st.motherName,
          profile: st.profile,
          kids: st.kids,
          completedVaccines: st.completedVaccines,
          onboardingComplete: st.onboardingComplete,
          photoUrl: st.photoUrl || '',
          parentGender: st.parentGender || '',
          bio: st.bio || '',
          expertise: st.expertise || [],
          visibilitySettings: st.visibilitySettings,
        });
        await saveUserProfile(user.uid, { kids: st.kids });
      }

      onBack();
    } catch (error: any) {
      console.error('save kid profile failed:', error);
      const reason =
        (error?.code ? `[${error.code}] ` : '') + (error?.message || 'Unknown error');
      Alert.alert('Could not save changes', reason);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScreenHeader title={`Edit ${kid.name || 'child'}`} />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insetsBottom + 40 }]} showsVerticalScrollIndicator={false}>
        <Text style={s.editSectionTitle}>Child Photo</Text>
        <View style={s.photoPickerWrap}>
          <View style={s.photoPreviewCircle}>
            {photo && !imgError ? (
              <RNImage source={{ uri: photo }} style={{ width: 80, height: 80, borderRadius: 40 }} onError={() => setImgError(true)} />
            ) : (
              <View style={s.photoPlaceholder}>
                <Ionicons name="happy-outline" size={36} color="#d1d5db" />
              </View>
            )}
          </View>
          <View style={s.photoActions}>
            <TouchableOpacity style={s.photoUploadBtn} onPress={handlePickKidPhoto} activeOpacity={0.8} disabled={photoLoading}>
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

        <Text style={s.editSectionTitle}>Stage</Text>
        <StageChip value={stage} onChange={onStageChange} />

        <Text style={[s.editSectionTitle, { marginTop: 18 }]}>
          {stage === 'pregnant' ? 'Due date' : 'Date of birth'}
        </Text>
        <DatePickerField value={keyDate} onChange={onDateChange} />
        {dateError ? <Text style={s.editFieldError}>{dateError}</Text> : null}
        <LivePreviewPill message={livePreview} />

        <Text style={[s.editSectionTitle, { marginTop: 18 }]}>Child's Name</Text>
        <TextInput
          style={s.textInput}
          value={name}
          onChangeText={setName}
          placeholder={stage === 'pregnant' ? 'Even a working name helps' : 'e.g. Aarav, Diya'}
          placeholderTextColor="#9ca3af"
          autoCapitalize="words"
        />

        <Text style={[s.editSectionTitle, { marginTop: 18 }]}>Gender</Text>
        <GenderChip stage={stage} value={genderChip} onChange={setGenderChip} />

        <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.85} disabled={saving}>
          <LinearGradient colors={[Colors.primary, Colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveBtnGrad}>
            <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.deleteKidBtn}
          onPress={() => onRemove(kid.id)}
          activeOpacity={0.8}
        >
          <Ionicons name="trash-outline" size={16} color={Colors.error} style={{ marginRight: 6 }} />
          <Text style={s.deleteKidBtnText}>Remove {kid.name || 'this child'}</Text>
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
  editFieldError: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: Colors.error,
    marginTop: 6,
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
  saveBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 28 },
  saveBtnGrad: { paddingVertical: Spacing.lg, alignItems: 'center' },
  saveBtnText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  deleteKidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#fff5f5',
  },
  deleteKidBtnText: { color: Colors.error, fontWeight: '600', fontSize: 14 },
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
    width: 80, height: 80, borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 2, borderColor: Colors.bgTint,
  },
  photoPlaceholder: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.borderSoft,
    alignItems: 'center', justifyContent: 'center',
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
  missingWrap: { padding: Spacing.xl, alignItems: 'center' },
  missingTitle: { fontFamily: Fonts.sansBold, fontSize: 18, color: Colors.textDark, marginBottom: 6 },
  missingBody: { fontFamily: Fonts.sansRegular, fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
});
