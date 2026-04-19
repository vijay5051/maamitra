import React, { useState, useEffect, useRef } from 'react';
import {
  Alert,
  Image as RNImage,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { ConfirmationResult } from 'firebase/auth';
import { useProfileStore, Kid, Profile, ParentGender, ParentRelation, calculateAgeInMonths, calculateAgeInWeeks, DEFAULT_VISIBILITY } from '../../store/useProfileStore';
import {
  saveFullProfile,
  saveUserProfile,
  sendPhoneOtp,
  verifyPhoneOtp,
  resetPhoneRecaptcha,
  PHONE_OTP_CONTAINER_ID,
  PHONE_OTP_UNSUPPORTED,
} from '../../services/firebase';
import { uploadAvatar } from '../../services/storage';
import DatePickerField from './DatePickerField';
import StateSelectorComponent from '../onboarding/StateSelector';

type ViewMode = 'main' | 'edit-profile' | 'edit-kid' | 'change-phone';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  /** Pre-select a sub-view when the modal opens. */
  initialView?: ViewMode;
  /** When true, auto-scroll the main view to the Privacy section on open. */
  scrollToPrivacy?: boolean;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={s.sectionHeader}>{title}</Text>;
}

function SettingsRow({
  icon,
  label,
  value,
  onPress,
  danger,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={s.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={[s.rowIcon, danger && s.rowIconDanger]}>
        <Ionicons name={icon as any} size={18} color={danger ? '#ef4444' : '#8b5cf6'} />
      </View>
      <View style={s.rowContent}>
        <Text style={[s.rowLabel, danger && s.rowLabelDanger]}>{label}</Text>
        {value ? <Text style={s.rowValue}>{value}</Text> : null}
      </View>
      {onPress && !danger && (
        <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
      )}
    </TouchableOpacity>
  );
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
        >
          <Text style={[s.chipText, opt === selected && s.chipTextActive]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Toggle Row ───────────────────────────────────────────────────────────────

function ToggleRow({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity style={s.toggleRow} onPress={onToggle} activeOpacity={0.75}>
      <Text style={s.toggleLabel}>{label}</Text>
      <View style={[s.toggleTrack, value && s.toggleTrackOn]}>
        <View style={[s.toggleThumb, value && s.toggleThumbOn]} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Multi-select chips ───────────────────────────────────────────────────────

function MultiChipSelect({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
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

// ─── State Picker Modal ───────────────────────────────────────────────────────

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
        style={spStyles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={spStyles.sheet}>
          {/* Handle + header */}
          <View style={spStyles.handleBar} />
          <View style={spStyles.header}>
            <Text style={spStyles.title}>Select State</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <StateSelectorComponent
            selected={selected}
            onSelect={(state) => {
              onSelect(state);
              onClose();
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const spStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fdf6ff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
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
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a2e',
  },
});

// ─── Edit Profile View ────────────────────────────────────────────────────────

const EXPERTISE_OPTIONS = [
  'Breastfeeding', 'Baby Sleep', 'Nutrition', 'Child Development',
  'Postpartum Recovery', 'Yoga & Wellness', 'Baby Care', 'Mental Health', 'Vaccination',
];

function EditProfileView({ onBack }: { onBack: () => void }) {
  const {
    motherName, profile, photoUrl, parentGender, bio, expertise,
    setMotherName, setProfile, setPhotoUrl, setParentGender, setBio, setExpertise,
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
  const [gender, setGender] = useState<ParentGender>(parentGender || '');
  const [bioText, setBioText] = useState(bio || '');
  const [expertiseTags, setExpertiseTags] = useState<string[]>(expertise || []);
  const [imgError, setImgError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);

  const handlePickPhoto = () => {
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      setPhotoLoading(true);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = async () => {
          const MAX = 300;
          let w = img.width, h = img.height;
          if (w > h) { h = Math.round((h / w) * MAX); w = MAX; }
          else { w = Math.round((w / h) * MAX); h = MAX; }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          // Upload to Firebase Storage and use the download URL
          const uid = user?.uid;
          if (uid) {
            try {
              const downloadUrl = await uploadAvatar(uid, dataUrl);
              setPhoto(downloadUrl);
            } catch (uploadErr) {
              console.error('Avatar upload failed, using data URL:', uploadErr);
              setPhoto(dataUrl);
            }
          } else {
            setPhoto(dataUrl);
          }
          setImgError(false);
          setPhotoLoading(false);
        };
        img.onerror = () => setPhotoLoading(false);
        img.src = ev.target?.result as string;
      };
      reader.onerror = () => setPhotoLoading(false);
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const DIET_OPTIONS = ['vegetarian', 'eggetarian', 'non-vegetarian', 'vegan'];
  const FAMILY_OPTIONS = ['nuclear', 'joint', 'in-laws', 'single-parent'];
  const GENDER_OPTIONS: { key: ParentGender; label: string }[] = [
    { key: 'mother', label: 'Mother 👩' },
    { key: 'father', label: 'Father 👨' },
    { key: 'other', label: 'Other 🧑' },
  ];

  const toggleExpertise = (tag: string) =>
    setExpertiseTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);

  const handleSave = () => {
    setSaving(true);
    if (name.trim()) setMotherName(name.trim());
    if (profile) setProfile({ ...profile, state: state.trim() || profile.state, diet: diet as any, familyType: familyType as any });
    setPhotoUrl(photo.trim());
    setParentGender(gender);
    setBio(bioText.trim());
    setExpertise(expertiseTags);
    // Persist ALL profile fields to Firestore so nothing is lost on next login.
    // IMPORTANT: st is read AFTER all setters above so it already has the new values.
    if (user?.uid) {
      const st = useProfileStore.getState();
      saveFullProfile(user.uid, {
        motherName: name.trim() || st.motherName,
        profile: st.profile
          ? { ...st.profile, state: state.trim() || st.profile.state, diet: diet as any, familyType: familyType as any }
          : st.profile,
        kids: st.kids,
        completedVaccines: st.completedVaccines,
        onboardingComplete: st.onboardingComplete,
        visibilitySettings: st.visibilitySettings,
        // These were previously omitted — Firestore was overwriting them with ''
        photoUrl: photo.trim(),
        parentGender: gender,
        bio: bioText.trim(),
        expertise: expertiseTags,
      }).catch(console.error);
    }
    setSaving(false);
    onBack();
  };

  return (
    <ScrollView contentContainerStyle={s.editContent} showsVerticalScrollIndicator={false}>

      {/* ── Profile Photo ── */}
      <Text style={s.editSectionTitle}>Profile Photo</Text>
      <View style={s.photoPickerWrap}>
        {/* Avatar preview */}
        <View style={s.photoPreviewCircle}>
          {photo && !imgError ? (
            // @ts-ignore
            <img src={photo} alt="profile" style={{ width: 80, height: 80, borderRadius: 40, objectFit: 'cover' }} onError={() => setImgError(true)} />
          ) : (
            <View style={s.photoPlaceholder}>
              <Ionicons name="person" size={36} color="#d1d5db" />
            </View>
          )}
        </View>

        {/* Buttons */}
        <View style={s.photoActions}>
          <TouchableOpacity style={s.photoUploadBtn} onPress={handlePickPhoto} activeOpacity={0.8} disabled={photoLoading}>
            <Ionicons name="camera-outline" size={18} color="#ffffff" />
            <Text style={s.photoUploadText}>{photoLoading ? 'Processing…' : photo ? 'Change Photo' : 'Upload Photo'}</Text>
          </TouchableOpacity>
          {photo ? (
            <TouchableOpacity style={s.photoRemoveBtn} onPress={() => { setPhoto(''); setImgError(false); }} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
              <Text style={s.photoRemoveText}>Remove</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* ── Basic info ── */}
      <Text style={s.editSectionTitle}>Your Name</Text>
      <TextInput style={s.textInput} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#9ca3af" />

      <Text style={s.editSectionTitle}>I Am a</Text>
      <ChipSelect
        options={GENDER_OPTIONS.map((g) => g.label)}
        selected={GENDER_OPTIONS.find((g) => g.key === gender)?.label ?? ''}
        onSelect={(v) => { const found = GENDER_OPTIONS.find((g) => g.label === v); if (found) setGender(found.key); }}
      />

      <Text style={s.editSectionTitle}>State</Text>
      <TouchableOpacity
        style={s.statePickerBtn}
        onPress={() => setShowStatePicker(true)}
        activeOpacity={0.75}
      >
        <Ionicons name="location-outline" size={18} color="#8b5cf6" style={{ marginRight: 8 }} />
        <Text style={[s.statePickerText, !state && s.statePickerPlaceholder]}>
          {state || 'Select your state'}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#9ca3af" />
      </TouchableOpacity>
      <StatePickerModal
        visible={showStatePicker}
        selected={state}
        onSelect={(val) => setState(val)}
        onClose={() => setShowStatePicker(false)}
      />

      <Text style={s.editSectionTitle}>Diet</Text>
      <ChipSelect options={DIET_OPTIONS} selected={diet} onSelect={(v) => setDiet(v as 'vegetarian' | 'eggetarian' | 'non-vegetarian' | 'vegan')} />

      <Text style={s.editSectionTitle}>Family Setup</Text>
      <ChipSelect options={FAMILY_OPTIONS} selected={familyType} onSelect={(v) => setFamilyType(v as 'nuclear' | 'joint' | 'in-laws' | 'single-parent')} />

      {/* ── Bio ── */}
      <Text style={s.editSectionTitle}>Bio <Text style={s.optional}>(shown on your profile)</Text></Text>
      <TextInput
        style={[s.textInput, s.textArea]}
        value={bioText}
        onChangeText={setBioText}
        placeholder="Share a little about yourself…"
        placeholderTextColor="#9ca3af"
        multiline
        numberOfLines={3}
      />

      {/* ── Expertise ── */}
      <Text style={s.editSectionTitle}>My Expertise <Text style={s.optional}>(pick all that apply)</Text></Text>
      <MultiChipSelect options={EXPERTISE_OPTIONS} selected={expertiseTags} onToggle={toggleExpertise} />

      <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.85}>
        <LinearGradient colors={['#ec4899', '#8b5cf6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveBtnGrad}>
          <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Edit Kid View ────────────────────────────────────────────────────────────

function EditKidView({ kid, onBack, onRemove }: { kid: Kid; onBack: () => void; onRemove: (kidId: string) => void }) {
  const { updateKid } = useProfileStore();
  const { user } = useAuthStore();
  const [name, setName] = useState(kid.name || '');
  const [dob, setDob] = useState(kid.dob ? kid.dob.split('T')[0] : '');
  const [gender, setGender] = useState<'boy' | 'girl' | 'surprise'>(kid.gender || 'surprise');
  const [relation, setRelation] = useState<ParentRelation>(kid.relation || '');
  const [saving, setSaving] = useState(false);

  const GENDER_OPTIONS = [
    { key: 'boy', label: 'Boy 👦' },
    { key: 'girl', label: 'Girl 👧' },
    { key: 'surprise', label: 'Surprise 🎁' },
  ];

  const RELATION_OPTIONS: { key: ParentRelation; label: string }[] = [
    { key: 'mother', label: 'Mother' },
    { key: 'father', label: 'Father' },
    { key: 'guardian', label: 'Guardian' },
    { key: 'grandparent', label: 'Grandparent' },
    { key: 'aunt/uncle', label: 'Aunt / Uncle' },
    { key: 'other', label: 'Other' },
  ];

  const handleSave = () => {
    setSaving(true);
    const updates: Partial<Omit<Kid, 'id'>> = {};
    if (name.trim()) updates.name = name.trim();
    if (dob) {
      const parsed = new Date(dob + 'T00:00:00');
      if (!isNaN(parsed.getTime())) {
        updates.dob = parsed.toISOString();
        updates.ageInMonths = calculateAgeInMonths(parsed.toISOString());
        updates.ageInWeeks = calculateAgeInWeeks(parsed.toISOString());
      }
    }
    updates.gender = gender;
    updates.relation = relation || undefined;
    updateKid(kid.id, updates);
    // Persist to Firestore immediately — get the post-update state
    if (user?.uid) {
      const st = useProfileStore.getState();
      saveFullProfile(user.uid, {
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
      }).catch(console.error);
    }
    setSaving(false);
    onBack();
  };

  return (
    <ScrollView contentContainerStyle={s.editContent} showsVerticalScrollIndicator={false}>
      <Text style={s.editSectionTitle}>Child's Name</Text>
      <TextInput style={s.textInput} value={name} onChangeText={setName} placeholder="Name" placeholderTextColor="#9ca3af" />

      <Text style={s.editSectionTitle}>Date of Birth</Text>
      <DatePickerField value={dob} onChange={setDob} placeholder="Tap to pick date of birth" maxDate={new Date().toISOString().split('T')[0]} />

      <Text style={s.editSectionTitle}>Child's Gender</Text>
      <ChipSelect
        options={GENDER_OPTIONS.map((g) => g.label)}
        selected={GENDER_OPTIONS.find((g) => g.key === gender)?.label ?? 'Surprise 🎁'}
        onSelect={(v) => { const found = GENDER_OPTIONS.find((g) => g.label === v); if (found) setGender(found.key as 'boy' | 'girl' | 'surprise'); }}
      />

      <Text style={s.editSectionTitle}>Your Relation to This Child</Text>
      <ChipSelect
        options={RELATION_OPTIONS.map((r) => r.label)}
        selected={RELATION_OPTIONS.find((r) => r.key === relation)?.label ?? ''}
        onSelect={(v) => { const found = RELATION_OPTIONS.find((r) => r.label === v); if (found) setRelation(found.key); }}
      />

      <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.85}>
        <LinearGradient colors={['#ec4899', '#8b5cf6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveBtnGrad}>
          <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Delete child */}
      <TouchableOpacity
        style={s.deleteKidBtn}
        onPress={() => onRemove(kid.id)}
        activeOpacity={0.8}
      >
        <Ionicons name="trash-outline" size={16} color="#ef4444" style={{ marginRight: 6 }} />
        <Text style={s.deleteKidBtnText}>Remove {kid.name || 'this child'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Change Phone View ───────────────────────────────────────────────────────
// OTP-gated mobile number change. The user CANNOT persist a new number
// without completing the OTP step — same helper (`sendPhoneOtp`) as the
// first-time flow, which auto-unlinks the old phone before linking the new.

function validateIndianMobile(digits: string): string | null {
  const clean = digits.replace(/\D/g, '');
  if (clean.length === 0) return 'Please enter your mobile number';
  if (clean.length !== 10) return 'Mobile number must be 10 digits';
  if (!/^[6-9]/.test(clean)) return 'Please enter a valid Indian mobile number';
  return null;
}

function friendlyOtpError(e: any): string {
  const code = e?.code ?? '';
  switch (code) {
    case 'auth/invalid-phone-number': return 'That phone number format is invalid.';
    case 'auth/too-many-requests': return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/invalid-verification-code': return 'That code is incorrect. Please check and try again.';
    case 'auth/code-expired': return 'Code expired. Tap resend to get a new one.';
    case 'auth/credential-already-in-use':
    case 'auth/account-exists-with-different-credential':
      return 'This number is already linked to another MaaMitra account.';
    case 'auth/captcha-check-failed': return 'Security check failed. Please refresh the page and try again.';
    case 'auth/quota-exceeded': return 'SMS quota reached. Please try again later.';
    case 'auth/missing-phone-number': return 'Please enter your phone number.';
    default: return `${code ? code + ': ' : ''}${e?.message ?? 'Something went wrong.'}`;
  }
}

function ChangePhoneView({
  onBack,
  insetsBottom,
}: {
  onBack: () => void;
  insetsBottom: number;
}) {
  const { user } = useAuthStore();
  const currentPhone = useProfileStore((st) => st.phone);
  const setPhone = useProfileStore((st) => st.setPhone);
  const setPhoneVerified = useProfileStore((st) => st.setPhoneVerified);

  const [step, setStep] = useState<'enter-number' | 'enter-code'>('enter-number');
  const [digits, setDigits] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const e164 = `+91${digits.replace(/\D/g, '')}`;

  const handleSendOtp = async () => {
    const v = validateIndianMobile(digits);
    if (v) { setError(v); return; }
    if (!user?.uid) { setError('You are not signed in.'); return; }
    // Don't allow "changing" to the same number
    if (`+91${digits}` === currentPhone) {
      setError('This is already your current mobile number.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const confirmation = await sendPhoneOtp(e164);
      confirmationRef.current = confirmation;
      setStep('enter-code');
    } catch (e: any) {
      if (e?.code === PHONE_OTP_UNSUPPORTED) {
        setError('OTP verification is only available on web. Please use a browser to change your mobile number.');
      } else {
        setError(friendlyOtpError(e));
        resetPhoneRecaptcha();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    const clean = code.replace(/\D/g, '');
    if (clean.length !== 6) { setError('Enter the 6-digit code from the SMS.'); return; }
    if (!confirmationRef.current) {
      setError('Verification expired. Please request a new code.');
      setStep('enter-number');
      return;
    }
    if (!user?.uid) return;
    setError('');
    setBusy(true);
    try {
      await verifyPhoneOtp(confirmationRef.current, clean);
      // Only persist AFTER successful OTP — this is the whole point of
      // the gate. Local store + Firestore stay in sync.
      setPhone(e164);
      setPhoneVerified(true);
      await saveUserProfile(user.uid, { phone: e164, phoneVerified: true });
      setSuccess(true);
      // Brief success state before returning to settings
      setTimeout(() => onBack(), 1200);
    } catch (e: any) {
      setError(friendlyOtpError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleResend = () => {
    confirmationRef.current = null;
    resetPhoneRecaptcha();
    setCode('');
    setError('');
    setStep('enter-number');
  };

  const isStep1 = step === 'enter-number';

  return (
    <ScrollView
      contentContainerStyle={[s.content, { paddingBottom: insetsBottom + 32 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {success ? (
        <View style={cp.successCard}>
          <View style={cp.successIcon}>
            <Ionicons name="checkmark-circle" size={44} color="#16a34a" />
          </View>
          <Text style={cp.successTitle}>Mobile verified</Text>
          <Text style={cp.successSub}>Your new number has been saved.</Text>
        </View>
      ) : (
        <>
          {/* Current number */}
          {currentPhone ? (
            <View style={cp.currentCard}>
              <Text style={cp.currentLabel}>Current number</Text>
              <Text style={cp.currentValue}>{currentPhone}</Text>
            </View>
          ) : null}

          <Text style={s.editSectionTitle}>
            {isStep1 ? 'New mobile number' : 'Enter the code we sent'}
          </Text>
          <Text style={cp.hint}>
            {isStep1
              ? "We'll send a one-time code to verify the new number. It stays private."
              : `A 6-digit code was sent to ${e164}. It may take a few seconds.`}
          </Text>

          {isStep1 ? (
            <View style={[cp.inputRow, error && cp.inputRowError]}>
              <View style={cp.countryBox}>
                <Text style={cp.flag}>🇮🇳</Text>
                <Text style={cp.countryCode}>+91</Text>
              </View>
              <TextInput
                value={digits}
                onChangeText={(t) => { setDigits(t.replace(/\D/g, '').slice(0, 10)); setError(''); }}
                placeholder="98765 43210"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
                maxLength={10}
                style={cp.input}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSendOtp}
              />
            </View>
          ) : (
            <View style={[cp.codeRow, error && cp.inputRowError]}>
              <TextInput
                value={code}
                onChangeText={(t) => { setCode(t.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                placeholder="• • • • • •"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
                maxLength={6}
                style={cp.codeInput}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleVerifyOtp}
              />
            </View>
          )}

          {error ? <Text style={cp.errorText}>{error}</Text> : null}

          <TouchableOpacity
            onPress={isStep1 ? handleSendOtp : handleVerifyOtp}
            disabled={busy || (isStep1 ? digits.length < 10 : code.length < 6)}
            activeOpacity={0.85}
            style={{ marginTop: 20 }}
          >
            <LinearGradient
              colors={['#ec4899', '#8b5cf6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                cp.primaryBtn,
                (busy || (isStep1 ? digits.length < 10 : code.length < 6)) && cp.primaryBtnDisabled,
              ]}
            >
              <Text style={cp.primaryBtnText}>
                {busy
                  ? (isStep1 ? 'Sending…' : 'Verifying…')
                  : (isStep1 ? 'Send OTP' : 'Verify & Save')}
              </Text>
              {!busy && <Ionicons name="arrow-forward" size={16} color="#ffffff" style={{ marginLeft: 6 }} />}
            </LinearGradient>
          </TouchableOpacity>

          {!isStep1 && (
            <TouchableOpacity onPress={handleResend} activeOpacity={0.7} style={{ marginTop: 14, alignItems: 'center' }}>
              <Text style={cp.resendText}>Didn't get the code? Resend / change number</Text>
            </TouchableOpacity>
          )}

          <Text style={cp.legal}>
            By continuing you agree to receive transactional SMS on this number. Standard carrier rates may apply.
          </Text>
        </>
      )}

      {/* Invisible reCAPTCHA container — required by Firebase Phone Auth on web.
          React Native Web renders View as <div>, and nativeID becomes the HTML id. */}
      <View nativeID={PHONE_OTP_CONTAINER_ID} style={cp.recaptcha} />
    </ScrollView>
  );
}

const cp = StyleSheet.create({
  currentCard: {
    backgroundColor: '#faf5ff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ede9fe',
    marginBottom: 20,
  },
  currentLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 2,
  },
  currentValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  hint: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  inputRowError: {
    borderColor: '#ef4444',
  },
  countryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    gap: 6,
  },
  flag: { fontSize: 18 },
  countryCode: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 10 : 12,
    fontSize: 17,
    color: '#111827',
    letterSpacing: 0.5,
  },
  codeRow: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  codeInput: {
    textAlign: 'center',
    paddingVertical: Platform.OS === 'web' ? 14 : 16,
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#ef4444',
    marginTop: 10,
    marginLeft: 4,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  resendText: {
    fontSize: 13,
    color: '#6d1a7a',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  legal: {
    fontSize: 11,
    color: '#9ca3af',
    lineHeight: 16,
    marginTop: 20,
    textAlign: 'center',
  },
  recaptcha: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 1,
    height: 1,
    opacity: 0,
  },
  successCard: {
    alignItems: 'center',
    paddingTop: 48,
  },
  successIcon: {
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  successSub: {
    fontSize: 14,
    color: '#6b7280',
  },
});

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function SettingsModal({
  visible,
  onClose,
  initialView,
  scrollToPrivacy,
}: SettingsModalProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut, deleteAccount } = useAuthStore();
  const { motherName, profile, kids, visibilitySettings, setVisibilitySettings, removeKid, photoUrl, phone, phoneVerified } = useProfileStore();
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(initialView ?? 'main');
  const [editingKidId, setEditingKidId] = useState<string | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signedOutSuccess, setSignedOutSuccess] = useState(false);

  // Refs for scrolling the main view to the Privacy section on demand.
  const mainScrollRef = useRef<ScrollView>(null);
  const privacyAnchorY = useRef(0);

  // When parent opens the modal and requests a specific sub-view or a scroll
  // target, honor that each time `visible` flips to true.
  useEffect(() => {
    if (!visible) return;
    setViewMode(initialView ?? 'main');
    if (scrollToPrivacy && (initialView === undefined || initialView === 'main')) {
      // Give the ScrollView a moment to lay out before scrolling.
      const t = setTimeout(() => {
        mainScrollRef.current?.scrollTo({
          y: Math.max(0, privacyAnchorY.current - 20),
          animated: true,
        });
      }, 250);
      return () => clearTimeout(t);
    }
  }, [visible, initialView, scrollToPrivacy]);

  const editingKid = editingKidId ? kids.find((k) => k.id === editingKidId) ?? null : null;

  // Toggles the given visibility key, updates the store, and immediately persists
  // to Firestore so the change survives reloads.
  const handlePrivacyToggle = (key: keyof typeof visibilitySettings) => {
    const updated = { ...visibilitySettings, [key]: !visibilitySettings[key] };
    setVisibilitySettings({ [key]: !visibilitySettings[key] });
    if (user?.uid) {
      const st = useProfileStore.getState();
      saveFullProfile(user.uid, {
        motherName: st.motherName,
        profile: st.profile,
        kids: st.kids,
        completedVaccines: st.completedVaccines,
        onboardingComplete: st.onboardingComplete,
        visibilitySettings: updated,
        photoUrl: st.photoUrl || '',
        parentGender: st.parentGender || '',
        bio: st.bio || '',
        expertise: st.expertise || [],
      }).catch(console.error);
    }
  };

  const handleClose = () => {
    setViewMode('main');
    setEditingKidId(null);
    onClose();
  };

  const handleBack = () => {
    setViewMode('main');
    setEditingKidId(null);
  };

  const handleRemoveKid = (kidId: string) => {
    const kidName = kids.find((k) => k.id === kidId)?.name || 'this child';
    const doRemove = () => {
      removeKid(kidId);
      // Sync updated profile to Firestore
      if (user?.uid) {
        const s = useProfileStore.getState();
        saveFullProfile(user.uid, {
          motherName: s.motherName,
          profile: s.profile,
          kids: s.kids,
          completedVaccines: s.completedVaccines,
          onboardingComplete: s.onboardingComplete,
          visibilitySettings: s.visibilitySettings,
          photoUrl: s.photoUrl || '',
          parentGender: s.parentGender || '',
          bio: s.bio || '',
          expertise: s.expertise || [],
        }).catch(console.error);
      }
      setViewMode('main');
      setEditingKidId(null);
    };
    if (typeof window !== 'undefined') {
      if (window.confirm(`Remove ${kidName}?\n\nThis will delete all their vaccine records too. This cannot be undone.`)) {
        doRemove();
      }
    } else {
      Alert.alert(
        `Remove ${kidName}?`,
        'This will delete all their vaccine records too. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: doRemove },
        ]
      );
    }
  };

  const handleSignOut = async () => {
    setShowSignOutConfirm(false);
    try {
      setLoading(true);
      await signOut();
      // Show "Signed Out" success overlay briefly before navigating
      setSignedOutSuccess(true);
      setTimeout(() => {
        setSignedOutSuccess(false);
        setLoading(false);
        handleClose();
        router.replace('/(auth)/welcome');
      }, 1600);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        'Delete account permanently?\n\nThis will delete all your data and cannot be undone.'
      );
      if (confirmed) performDelete();
    } else {
      Alert.alert(
        'Delete Account',
        'This will permanently delete all your data. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: performDelete },
        ]
      );
    }
  };

  const performDelete = async () => {
    try {
      setLoading(true);
      handleClose();
      await deleteAccount();
      router.replace('/(auth)/welcome');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const initials = (motherName || user?.name || 'M').slice(0, 1).toUpperCase();

  const headerTitle = viewMode === 'change-phone'
    ? (phone ? 'Change Mobile Number' : 'Add Mobile Number')
    : viewMode === 'edit-profile'
    ? 'Edit Profile ✏️'
    : viewMode === 'edit-kid'
    ? `Edit ${editingKid?.name ?? 'Child'} ✏️`
    : 'Settings ⚙️';

  const showBack = viewMode !== 'main';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[s.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <LinearGradient
          colors={['#f472b6', '#a78bfa']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.header}
        >
          <TouchableOpacity onPress={showBack ? handleBack : handleClose} style={s.closeBtn}>
            <Ionicons name={showBack ? 'arrow-back' : 'close'} size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{headerTitle}</Text>
          <View style={s.closeBtn} />
        </LinearGradient>

        {/* Main settings view */}
        {viewMode === 'main' && (
          <ScrollView
            ref={mainScrollRef}
            contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Profile card */}
            <View style={s.profileCard}>
              {photoUrl ? (
                <RNImage source={{ uri: photoUrl }} style={s.avatar} />
              ) : (
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{initials}</Text>
                </View>
              )}
              <View style={s.profileInfo}>
                <Text style={s.profileName}>{motherName || user?.name || 'Mom'}</Text>
                <Text style={s.profileEmail}>{user?.email || 'demo@maamitra.app'}</Text>
              </View>
            </View>

            {/* Profile & Kids */}
            <SectionHeader title="Profile" />
            <View style={s.card}>
              <SettingsRow
                icon="person-outline"
                label="Name"
                value={motherName || user?.name || '—'}
              />
              <View style={s.divider} />
              <SettingsRow
                icon="mail-outline"
                label="Email"
                value={user?.email || '—'}
              />
              <View style={s.divider} />
              <SettingsRow
                icon="call-outline"
                label={phoneVerified ? 'Mobile ✓' : 'Mobile'}
                value={phone || 'Not added'}
                onPress={() => setViewMode('change-phone')}
              />
              {profile && (
                <>
                  <View style={s.divider} />
                  <SettingsRow
                    icon="location-outline"
                    label="State"
                    value={profile.state || '—'}
                  />
                  <View style={s.divider} />
                  <SettingsRow
                    icon="restaurant-outline"
                    label="Diet"
                    value={profile.diet ? profile.diet.charAt(0).toUpperCase() + profile.diet.slice(1) : '—'}
                  />
                  <View style={s.divider} />
                  <SettingsRow
                    icon="home-outline"
                    label="Family"
                    value={profile.familyType ? profile.familyType.charAt(0).toUpperCase() + profile.familyType.slice(1) : '—'}
                  />
                </>
              )}
              <View style={s.divider} />
              <SettingsRow
                icon="create-outline"
                label="Edit Profile"
                onPress={() => setViewMode('edit-profile')}
              />
            </View>

            {/* Kids */}
            {kids.length > 0 && (
              <>
                <SectionHeader title="My Children" />
                <View style={s.card}>
                  {kids.map((kid, i) => {
                    const genderEmoji = kid.gender === 'boy' ? '👦' : kid.gender === 'girl' ? '👧' : '🎁';
                    const _diffMs = kid.dob ? Date.now() - new Date(kid.dob).getTime() : 0;
                    const _months = Math.max(0, Math.floor(_diffMs / (1000 * 60 * 60 * 24 * 30.44)));
                    const ageStr = kid.isExpecting ? 'Expecting' : `${_months}m old`;
                    return (
                      <React.Fragment key={kid.id}>
                        {i > 0 && <View style={s.divider} />}
                        <SettingsRow
                          icon={kid.isExpecting ? 'heart-outline' : 'happy-outline'}
                          label={`${kid.name || 'Baby'} ${genderEmoji}`}
                          value={ageStr}
                          onPress={() => { setEditingKidId(kid.id); setViewMode('edit-kid'); }}
                        />
                      </React.Fragment>
                    );
                  })}
                </View>
              </>
            )}

            {/* Privacy */}
            <View
              onLayout={(e) => {
                privacyAnchorY.current = e.nativeEvent.layout.y;
              }}
            >
              <SectionHeader title="Privacy — What Others Can See" />
            </View>
            <View style={s.card}>
              <ToggleRow
                label="Number of kids"
                value={visibilitySettings.showKids}
                onToggle={() => handlePrivacyToggle('showKids')}
              />
              <View style={s.divider} />
              <ToggleRow
                label="State / location"
                value={visibilitySettings.showState}
                onToggle={() => handlePrivacyToggle('showState')}
              />
              <View style={s.divider} />
              <ToggleRow
                label="Bio"
                value={visibilitySettings.showBio}
                onToggle={() => handlePrivacyToggle('showBio')}
              />
              <View style={s.divider} />
              <ToggleRow
                label="Expertise tags"
                value={visibilitySettings.showExpertise}
                onToggle={() => handlePrivacyToggle('showExpertise')}
              />
              <View style={s.divider} />
              <ToggleRow
                label="Post count"
                value={visibilitySettings.showPostCount}
                onToggle={() => handlePrivacyToggle('showPostCount')}
              />
              <View style={s.divider} />
              <ToggleRow
                label="Posts visible only to followers"
                value={visibilitySettings.postsFollowersOnly}
                onToggle={() => handlePrivacyToggle('postsFollowersOnly')}
              />
            </View>

            {/* Account */}
            <SectionHeader title="Account" />
            <View style={s.card}>
              <SettingsRow
                icon="log-out-outline"
                label={loading ? 'Signing out…' : 'Sign Out'}
                onPress={loading ? undefined : () => setShowSignOutConfirm(true)}
              />
            </View>

            <View style={[s.card, s.dangerCard]}>
              <SettingsRow
                icon="trash-outline"
                label="Delete Account"
                onPress={loading ? undefined : handleDeleteAccount}
                danger
              />
            </View>

            {/* App info */}
            <Text style={s.version}>MaaMitra v1.0 · Made with 💕 in India</Text>
          </ScrollView>
        )}

        {/* Edit profile view */}
        {viewMode === 'edit-profile' && (
          <EditProfileView onBack={handleBack} />
        )}

        {/* Edit kid view */}
        {viewMode === 'edit-kid' && editingKid && (
          <EditKidView kid={editingKid} onBack={handleBack} onRemove={handleRemoveKid} />
        )}

        {/* Change phone view — gated by OTP verification */}
        {viewMode === 'change-phone' && (
          <ChangePhoneView onBack={handleBack} insetsBottom={insets.bottom} />
        )}
      </View>

      {/* ── Sign Out Confirmation Modal ── */}
      <Modal visible={showSignOutConfirm} transparent animationType="fade" onRequestClose={() => setShowSignOutConfirm(false)}>
        <View style={s.confirmOverlay}>
          <View style={s.confirmSheet}>
            <View style={s.confirmIconWrap}>
              <LinearGradient colors={['#ec4899', '#8b5cf6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.confirmIconCircle}>
                <Ionicons name="log-out-outline" size={26} color="#ffffff" />
              </LinearGradient>
            </View>
            <Text style={s.confirmTitle}>Sign Out?</Text>
            <Text style={s.confirmSubtitle}>You'll need to sign in again to access your account.</Text>
            <View style={s.confirmBtns}>
              <TouchableOpacity style={s.confirmCancel} onPress={() => setShowSignOutConfirm(false)} activeOpacity={0.8}>
                <Text style={s.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <LinearGradient colors={['#ec4899', '#8b5cf6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.confirmSignOutBtn}>
                <TouchableOpacity style={s.confirmSignOutInner} onPress={handleSignOut} activeOpacity={0.85}>
                  <Text style={s.confirmSignOutText}>Sign Out</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Signed Out Success Overlay ── */}
      <Modal visible={signedOutSuccess} transparent animationType="fade">
        <View style={s.successOverlay}>
          <View style={s.successCard}>
            <LinearGradient colors={['#22c55e', '#16a34a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.successIconCircle}>
              <Ionicons name="checkmark" size={30} color="#ffffff" />
            </LinearGradient>
            <Text style={s.successTitle}>Signed Out</Text>
            <Text style={s.successSubtitle}>You've been signed out successfully.</Text>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fdf6ff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 20 },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#f3e8ff',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ec4899',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: '700', color: '#1a1a2e' },
  profileEmail: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
    paddingLeft: 4,
  },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f3e8ff',
    overflow: 'hidden',
  },
  dangerCard: {
    borderColor: 'rgba(239,68,68,0.15)',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(139,92,246,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconDanger: {
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: '#1a1a2e' },
  rowLabelDanger: { color: '#ef4444' },
  rowValue: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  divider: {
    height: 1,
    backgroundColor: '#f9fafb',
    marginLeft: 60,
  },

  version: {
    textAlign: 'center',
    fontSize: 12,
    color: '#d1d5db',
    marginTop: 8,
  },

  // Edit views
  editContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  editSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 8,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1a1a2e',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#f9fafb',
  },
  chipActive: {
    borderColor: '#ec4899',
    backgroundColor: 'rgba(236,72,153,0.08)',
  },
  chipText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  chipTextActive: { color: '#ec4899', fontWeight: '700' },

  saveBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 28,
  },
  saveBtnGrad: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },

  deleteKidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#fff5f5',
  },
  deleteKidBtnText: { color: '#ef4444', fontWeight: '600', fontSize: 14 },

  optional: { color: '#9ca3af', fontWeight: '400', textTransform: 'none' },

  statePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statePickerText: {
    flex: 1,
    fontSize: 15,
    color: '#1a1a2e',
  },
  statePickerPlaceholder: {
    color: '#9ca3af',
  },

  textArea: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },

  photoPickerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#fdf6ff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f3e8ff',
    marginBottom: 4,
  },
  photoPreviewCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#f3e8ff',
  },
  photoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActions: { flex: 1, gap: 10 },
  photoUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  photoUploadText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  photoRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  photoRemoveText: { color: '#ef4444', fontSize: 13, fontWeight: '500' },
  // legacy — kept for safety
  photoPreviewWrap: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  removePhotoBtn: { padding: 2 },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  toggleLabel: { fontSize: 15, fontWeight: '500', color: '#1a1a2e' },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e5e7eb',
    padding: 3,
  },
  toggleTrackOn: { backgroundColor: '#ec4899' },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbOn: { transform: [{ translateX: 18 }] },

  // Sign out confirm modal
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  confirmSheet: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  confirmIconWrap: { marginBottom: 16 },
  confirmIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a2e',
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  confirmBtns: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmCancel: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  confirmCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  confirmSignOutBtn: {
    flex: 1,
    borderRadius: 14,
  },
  confirmSignOutInner: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmSignOutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Signed out success overlay
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  successCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
