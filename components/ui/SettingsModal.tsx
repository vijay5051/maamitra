import React, { useState, useEffect } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore, Kid, Profile, ParentGender, ParentRelation, calculateAgeInMonths, calculateAgeInWeeks, DEFAULT_VISIBILITY } from '../../store/useProfileStore';
import { saveFullProfile } from '../../services/firebase';
import DatePickerField from './DatePickerField';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

type ViewMode = 'main' | 'edit-profile' | 'edit-kid';

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

  const [name, setName] = useState(motherName || '');
  const [state, setState] = useState(profile?.state || '');
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
        img.onload = () => {
          const MAX = 300;
          let w = img.width, h = img.height;
          if (w > h) { h = Math.round((h / w) * MAX); w = MAX; }
          else { w = Math.round((w / h) * MAX); h = MAX; }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setPhoto(dataUrl);
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
      <TextInput style={s.textInput} value={state} onChangeText={setState} placeholder="e.g. Maharashtra" placeholderTextColor="#9ca3af" />

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

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut, deleteAccount } = useAuthStore();
  const { motherName, profile, kids, visibilitySettings, setVisibilitySettings, removeKid } = useProfileStore();
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [editingKidId, setEditingKidId] = useState<string | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signedOutSuccess, setSignedOutSuccess] = useState(false);

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

  const headerTitle = viewMode === 'edit-profile'
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
            contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Profile card */}
            <View style={s.profileCard}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{initials}</Text>
              </View>
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
            <SectionHeader title="Privacy — What Others Can See" />
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
