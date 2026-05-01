import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  Image as RNImage,
  Linking,
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
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import SuccessCheck from './SuccessCheck';
import { useProfileStore, Kid, Profile, ParentGender, calculateAgeInMonths, calculateAgeInWeeks, DEFAULT_VISIBILITY } from '../../store/useProfileStore';
import {
  saveFullProfile,
  saveUserProfile,
  sendPhoneOtp,
  verifyPhoneOtp,
  resetPhoneRecaptcha,
  removePhoneFromAccount,
  PHONE_OTP_CONTAINER_ID,
  PHONE_OTP_UNSUPPORTED,
  type PhoneOtpHandle,
} from '../../services/firebase';
import { confirmAction, infoAlert } from '../../lib/cross-platform-alerts';
import { isAdminEmail } from '../../lib/admin';
import { uploadAvatar, uploadKidAvatar } from '../../services/storage';
import DatePickerField from './DatePickerField';
import StateSelectorComponent from '../onboarding/StateSelector';
import { Fonts, ACCENT_PRESETS } from '../../constants/theme';
import { useThemeStore, reloadForThemeChange } from '../../store/useThemeStore';
import {
  checkPushSupportDetailed,
  currentPushPermission,
  enablePushDetailed,
  disablePush,
  loadNotifPrefs,
  updateNotifPref,
  DEFAULT_NOTIF_PREFS,
  type NotifPrefs,
  type PushSupportStatus,
} from '../../services/push';
import { Colors } from '../../constants/theme';

type ViewMode = 'main' | 'edit-profile' | 'edit-kid' | 'change-phone';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  /** Pre-select a sub-view when the modal opens. */
  initialView?: ViewMode;
  /** When opening directly into the child editor, select this child first. */
  initialKidId?: string | null;
  /** When true, auto-scroll the main view to the Privacy section on open. */
  scrollToPrivacy?: boolean;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={s.sectionHeaderWrap}>
      <Text style={s.sectionHeader}>{title}</Text>
      {subtitle ? <Text style={s.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function SettingsRow({
  icon,
  label,
  value,
  onPress,
  danger,
  avatarUri,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  avatarUri?: string;
}) {
  return (
    <TouchableOpacity
      style={s.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      {avatarUri ? (
        <RNImage source={{ uri: avatarUri }} style={s.rowAvatar} />
      ) : (
        <View style={[s.rowIcon, danger && s.rowIconDanger]}>
          <Ionicons name={icon as any} size={18} color={danger ? '#ef4444' : Colors.primary} />
        </View>
      )}
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

function QuickSettingsTile({
  icon,
  label,
  sub,
  onPress,
}: {
  icon: string;
  label: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.quickTile} onPress={onPress} activeOpacity={0.78}>
      <View style={s.quickTileIcon}>
        <Ionicons name={icon as any} size={18} color={Colors.primary} />
      </View>
      <Text style={s.quickTileLabel} numberOfLines={1}>{label}</Text>
      <Text style={s.quickTileSub} numberOfLines={2}>{sub}</Text>
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

// ─── Notifications toggle ────────────────────────────────────────────────────
// Enables web push for this browser. Asks for OS permission, grabs the
// FCM token, and persists it to users/{uid}.fcmTokens so the dispatcher
// can target this device. When push is on, five sub-toggles let the user
// opt out of individual topics (reactions, comments, DMs, follows,
// announcements). The dispatcher reads these before firing each push.
const PREF_ROWS: Array<{ key: keyof NotifPrefs; label: string; sub: string }> = [
  { key: 'reactions',     label: 'Reactions',     sub: 'When someone reacts to your post' },
  { key: 'comments',      label: 'Comments',      sub: 'When someone comments on your post' },
  { key: 'dms',           label: 'Direct messages',sub: 'New chat messages' },
  { key: 'follows',       label: 'Follows',       sub: 'Follow requests & accepts' },
  { key: 'announcements', label: 'Announcements', sub: 'Broadcasts from MaaMitra' },
];

function NotificationsPanel({ uid }: { uid?: string }) {
  const [support, setSupport] = useState<PushSupportStatus | null>(null);
  const [permission, setPermission] = useState<'unsupported' | 'default' | 'granted' | 'denied'>(
    'default',
  );
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (Platform.OS !== 'web') {
      // Native: probe RNFB messaging() for current authorization state.
      // checkPushSupportDetailed is web-only and would return
      // 'platform-native' (which we treat as supported here).
      setSupport({ ok: true } as any);
      (async () => {
        try {
          const messagingModule = await import('@react-native-firebase/messaging');
          const messaging = messagingModule.default;
          const { AuthorizationStatus } = messagingModule;
          const status = await messaging().hasPermission();
          if (cancelled) return;
          if (status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL) {
            setPermission('granted');
            try {
              const nativeToken = await messaging().getToken();
              if (cancelled) return;
              if (nativeToken) {
                const { registerFcmToken } = await import('../../services/firebase');
                if (uid) {
                  await registerFcmToken(uid, nativeToken);
                }
                if (!cancelled) setToken(nativeToken);
              } else if (!cancelled) {
                setToken(null);
              }
            } catch {
              if (!cancelled) setToken(null);
            }
          } else if (status === AuthorizationStatus.DENIED) {
            setPermission('denied');
          } else {
            setPermission('default');
          }
        } catch {
          if (!cancelled) setPermission('default');
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    checkPushSupportDetailed().then((s) => {
      if (cancelled) return;
      setSupport(s);
      setPermission(currentPushPermission() as any);
    });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  // Load the user's saved prefs once we have a uid.
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    loadNotifPrefs(uid).then((p) => {
      if (!cancelled) {
        setPrefs(p);
        setPrefsLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const supported = support?.ok === true;
  const enabled = permission === 'granted' && !!token;
  const blocked = permission === 'denied';
  const showSubToggles = enabled && prefsLoaded;

  // Human-readable status line for the master toggle. iOS-PWA-not-
  // -standalone is the #1 source of "can't toggle push" reports; surface
  // the hint explicitly.
  const statusLine = (() => {
    if (!support) return '';
    if (!support.ok) {
      if (support.reason === 'ios-not-standalone') return 'Open from your Home Screen icon';
      if (support.reason === 'no-notification-api') return 'Not supported in this browser';
      if (support.reason === 'no-push-manager') return 'Push not supported here — use Chrome or Safari 16.4+';
      if (support.reason === 'platform-native') return 'Only available on the web build for now';
      return 'Not supported on this device';
    }
    if (blocked) return 'Blocked in browser settings';
    if (permission === 'granted' && !token) return 'Permission granted, still registering this device';
    if (enabled) return 'Enabled on this device';
    return 'Off — tap to enable';
  })();

  const handleToggle = async () => {
    if (!uid) return;

    // Native (Android/iOS) — FCM-backed flow. Three branches:
    //   1. Currently ON     → unregister this device's token + ask the user
    //                         to also revoke at OS level (we can't do that
    //                         programmatically). Open native settings on
    //                         confirm.
    //   2. Previously DENIED → can't re-prompt the OS dialog; escort the
    //                         user to native app settings.
    //   3. Default / fresh   → request permission; if the OS prompt comes
    //                         back denied, offer to open settings.
    if (Platform.OS !== 'web') {
      setBusy(true);
      try {
        if (enabled) {
          // Turn OFF: unregister this device's token so we stop pushing
          // here. The OS-level permission has to be flipped in Settings.
          try {
            const messagingModule = await import('@react-native-firebase/messaging');
            const messaging = messagingModule.default;
            const currentToken = await messaging().getToken().catch(() => null);
            if (currentToken) {
              const { unregisterFcmToken } = await import('../../services/firebase');
              await unregisterFcmToken(uid, currentToken);
            }
          } catch (err) {
            console.warn('[push] unregister token failed:', err);
          }
          setToken(null);
          setPermission('default');
          Alert.alert(
            'Notifications paused',
            'This device will stop receiving MaaMitra notifications. To fully turn off (or back on) at the OS level, open device settings.',
            [
              { text: 'OK', style: 'cancel' },
              { text: 'Open settings', onPress: () => Linking.openSettings() },
            ],
          );
          return;
        }

        if (permission === 'denied') {
          // OS already said no — re-prompting won't show the dialog.
          Alert.alert(
            'Enable in settings',
            'Notifications were turned off earlier. Open device settings to enable them, then come back here.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open settings', onPress: () => Linking.openSettings() },
            ],
          );
          return;
        }

        const { requestNotificationPermission } = await import('../../lib/requestNotificationPermission');
        const result = await requestNotificationPermission(uid);
        if (result.status === 'granted') {
          setPermission('granted');
          setToken('native');
        } else if (result.status === 'denied') {
          setPermission('denied');
          Alert.alert(
            'Notifications turned off',
            'You declined the system prompt. Open device settings to enable them whenever you\'re ready.',
            [
              { text: 'Not now', style: 'cancel' },
              { text: 'Open settings', onPress: () => Linking.openSettings() },
            ],
          );
        } else if (result.status === 'unsupported') {
          Alert.alert('Not supported', 'This device does not support push notifications.');
        } else if (result.status === 'error') {
          Alert.alert('Could not enable push', 'Please try again in a moment.');
        }
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!support) return;
    if (!support.ok) {
      Alert.alert(
        support.reason === 'ios-not-standalone' ? 'Open from Home Screen' : 'Not supported',
        (support as any).hint ||
          'Your browser does not support web push. Try Chrome on Android, or Safari 16.4+ on iPhone with the app installed to your Home Screen.',
      );
      return;
    }
    if (blocked) {
      Alert.alert(
        'Permission blocked',
        'Notifications are blocked in your browser settings. Enable them for this site, then try again.',
      );
      return;
    }
    setBusy(true);
    try {
      if (enabled) {
        await disablePush(uid, token);
        setToken(null);
      } else {
        const r = await enablePushDetailed(uid);
        if (r.ok) {
          setToken(r.token);
          setPermission('granted');
        } else {
          // Update permission state either way.
          setPermission(currentPushPermission() as any);
          const msgByReason: Record<string, string> = {
            'no-vapid-key': 'Server not fully configured yet. Ask the admin to set the VAPID key.',
            'denied': 'You said no to the browser prompt. Tap the lock icon in the address bar to allow notifications, then try again.',
            'sw-registration-failed':
              'Could not register the background worker. If you just installed the app to your Home Screen, close and reopen it from there and try again.',
            'token-failed':
              'We could not get a push token. On iPhone, make sure you opened MaaMitra from the Home Screen icon (not Safari).',
            'firestore-failed': 'Network error while saving your preference. Check connection and retry.',
            'not-configured': 'Server not configured — admins need to finish setup.',
            'unsupported': r.detail || 'Push is not available here.',
          };
          Alert.alert('Could not enable push', msgByReason[r.reason] || 'Something went wrong. Please try again.');
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const togglePref = async (key: keyof NotifPrefs) => {
    if (!uid) return;
    const next = !prefs[key];
    setPrefs((p) => ({ ...p, [key]: next })); // optimistic
    try {
      await updateNotifPref(uid, key, next);
    } catch {
      setPrefs((p) => ({ ...p, [key]: !next })); // revert
    }
  };

  if (!support) return null;

  return (
    <View style={s.card}>
      <TouchableOpacity
        style={s.notifRow}
        onPress={busy ? undefined : handleToggle}
        activeOpacity={0.75}
        disabled={busy}
      >
        <View style={s.rowIcon}>
          <Ionicons name="notifications-outline" size={18} color={Colors.primary} />
        </View>
        <View style={s.rowContent}>
          <Text style={s.rowLabel}>Push notifications</Text>
          <Text style={s.rowValue}>{statusLine}</Text>
        </View>
        <View
          style={[s.toggleTrack, enabled && s.toggleTrackOn, (!supported || busy) && { opacity: 0.5 }]}
        >
          <View style={[s.toggleThumb, enabled && s.toggleThumbOn]} />
        </View>
      </TouchableOpacity>

      {/* Per-topic sub-toggles. Rendered inside the same card for visual
          hierarchy — indented + a divider separates them from the master
          toggle above. */}
      {showSubToggles && (
        <>
          <View style={[s.divider, { marginLeft: 0 }]} />
          {PREF_ROWS.map((row, idx) => (
            <React.Fragment key={row.key}>
              {idx > 0 && <View style={s.divider} />}
              <TouchableOpacity
                style={s.prefRow}
                onPress={() => togglePref(row.key)}
                activeOpacity={0.75}
              >
                <View style={s.prefContent}>
                  <Text style={s.prefLabel}>{row.label}</Text>
                  <Text style={s.prefSub}>{row.sub}</Text>
                </View>
                <View style={[s.toggleTrack, prefs[row.key] && s.toggleTrackOn]}>
                  <View style={[s.toggleThumb, prefs[row.key] && s.toggleThumbOn]} />
                </View>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </>
      )}
    </View>
  );
}

// ─── Accent colour picker ─────────────────────────────────────────────────────
// 10-swatch curated palette (see ACCENT_PRESETS in constants/theme.ts).
// Tap a swatch → writes to useThemeStore, syncs to Firestore, triggers a
// soft web reload so every StyleSheet.create() cache rebuilds.
function AccentPicker({
  uid,
  onChosen,
}: {
  uid?: string;
  onChosen: (hex: string) => void;
}) {
  const currentPrimary = useThemeStore((state) => state.primary);
  const setPrimary = useThemeStore((state) => state.setPrimary);

  const handlePick = async (hex: string) => {
    if (hex === currentPrimary) return;
    await setPrimary(hex, uid);
    onChosen(hex);
  };

  return (
    <View style={s.accentGrid}>
      {ACCENT_PRESETS.map((preset) => {
        const isActive = preset.hex.toLowerCase() === currentPrimary.toLowerCase();
        return (
          <TouchableOpacity
            key={preset.hex}
            onPress={() => handlePick(preset.hex)}
            activeOpacity={0.8}
            style={[s.accentSwatchWrap, isActive && s.accentSwatchWrapActive]}
            accessibilityLabel={`${preset.name} accent`}
          >
            <View style={[s.accentSwatch, { backgroundColor: preset.hex }]}>
              {isActive && <Ionicons name="checkmark" size={16} color="#ffffff" />}
            </View>
            <Text style={[s.accentSwatchLabel, isActive && s.accentSwatchLabelActive]}>
              {preset.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
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

// Expertise pool — common to every parent / caregiver. Role-specific
// suggestions get layered on top via getExpertiseOptions() so a father
// doesn't see "Breastfeeding / Lactation" and a grandparent doesn't see
// "Postpartum Recovery".
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
  if (parentGender === 'other')  return [...EXPERTISE_COMMON, ...EXPERTISE_OTHER];
  // Default to mother — covers '' and 'mother'.
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
  if (asset.base64) {
    return `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`;
  }
  if (typeof asset.uri === 'string' && asset.uri.startsWith('data:')) {
    return asset.uri;
  }
  throw new Error('Could not read image data from the selected file.');
}

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

  // Role-personalised expertise pool. Re-derived whenever the user picks
  // a different parent gender. Any currently-selected tag that ISN'T in
  // the new role's pool is appended at the end so we never drop the
  // user's existing choices when they switch roles.
  const expertiseOptions = useMemo(() => {
    const pool = getExpertiseOptions(gender);
    const extras = expertiseTags.filter((t) => !pool.includes(t));
    return [...pool, ...extras];
  }, [gender, expertiseTags]);
  const [imgError, setImgError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);

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
      // Storage upload only — never persist a base64 data URL into the
      // user doc (would push it past Firestore's 1 MB doc limit and
      // break the next save).
      const downloadUrl = await uploadAvatar(uid, dataUrl);
      setPhoto(downloadUrl);
      setImgError(false);
    } catch (error) {
      console.error('pick profile photo failed:', error);
      Alert.alert(
        'Could not save that photo',
        'Upload to Firebase Storage failed. Check your connection and try again.',
      );
    } finally {
      setPhotoLoading(false);
    }
  };

  const DIET_OPTIONS = ['vegetarian', 'eggetarian', 'non-vegetarian', 'vegan'];
  const FAMILY_OPTIONS = ['nuclear', 'joint', 'in-laws', 'single-parent'];
  const GENDER_OPTIONS: { key: ParentGender; label: string }[] = [
    { key: 'mother', label: 'Mother 👩' },
  ];

  const toggleExpertise = (tag: string) =>
    setExpertiseTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (name.trim()) setMotherName(name.trim());
      if (profile) setProfile({ ...profile, state: state.trim() || profile.state, diet: diet as any, familyType: familyType as any });
      setPhotoUrl(photo.trim());
      // parentGender is NOT written here — it's locked at signup. Writing it
      // back would let UI state drift overwrite the locked value if anything
      // ever sets `gender` to something different.
      setBio(bioText.trim());
      setExpertise(expertiseTags);

      // Persist ALL profile fields to Firestore so nothing is lost on next
      // login. We explicitly merge `photoUrl` onto users/{uid} as well so
      // the avatar survives cold starts even if a broader profile write is
      // delayed or partially rejected.
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
          // parentGender preserved from the already-hydrated store — this
          // screen never changes it, but saveFullProfile expects a value so
          // we read it from the live state (which was set at signup and
          // hasn't been touched since).
          parentGender: st.parentGender,
          bio: bioText.trim(),
          expertise: expertiseTags,
        });
        await saveUserProfile(user.uid, { photoUrl: photo.trim() });
      }

      onBack();
    } catch (error) {
      console.error('save profile failed:', error);
      Alert.alert('Could not save changes', 'Please try again once more.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={s.editContent} showsVerticalScrollIndicator={false}>

      {/* ── Profile Photo ── */}
      <Text style={s.editSectionTitle}>Profile Photo</Text>
      <View style={s.photoPickerWrap}>
        {/* Avatar preview */}
        <View style={s.photoPreviewCircle}>
          {photo && !imgError ? (
            <RNImage source={{ uri: photo }} style={{ width: 80, height: 80, borderRadius: 40 }} onError={() => setImgError(true)} />
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

      {/* Role is LOCKED at signup — the whole app is shaped around it
          (content, AI framing, schemes, yoga picks). Showing it read-only
          rather than editable so users can't accidentally switch roles
          and end up in a half-correct experience. If a user genuinely
          set the wrong role, they can reach out via Help & Support and
          we can reset it from the admin tool. */}
      <Text style={s.editSectionTitle}>I Am a</Text>
      <View style={s.lockedRoleBox}>
        <Text style={s.lockedRoleValue}>
          {GENDER_OPTIONS.find((g) => g.key === gender)?.label ?? '—'}
        </Text>
        <Ionicons name="lock-closed" size={14} color="#9ca3af" />
      </View>
      <Text style={s.lockedRoleHint}>
        MaaMitra is currently tailored for mothers in this launch phase.
      </Text>

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
      <MultiChipSelect options={expertiseOptions} selected={expertiseTags} onToggle={toggleExpertise} />

      <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.85}>
        <LinearGradient colors={[Colors.primary, Colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveBtnGrad}>
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
  const [photo, setPhoto] = useState(kid.photoUrl || '');
  const [photoLoading, setPhotoLoading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [saving, setSaving] = useState(false);

  const GENDER_OPTIONS = [
    { key: 'boy', label: 'Boy 👦' },
    { key: 'girl', label: 'Girl 👧' },
    { key: 'surprise', label: 'Surprise' },
  ];

  // Parent's relation to the child is captured at signup (mother / father /
  // guardian / …) and reused for every kid on the account. Re-asking it
  // here would let the user contradict their own profile, so the chip
  // strip is intentionally absent.

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
      // Always go via Firebase Storage. Saving a base64 data URL into the
      // user doc instead would push the kids[] field past Firestore's 1 MB
      // doc limit and surface as "Could not save changes".
      const downloadUrl = await uploadKidAvatar(uid, kid.id, dataUrl);
      setPhoto(downloadUrl);
      setImgError(false);
    } catch (error) {
      console.error('pick child photo failed:', error);
      Alert.alert(
        'Could not save that photo',
        'Upload to Firebase Storage failed. Check your connection and try again.',
      );
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
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
      updates.photoUrl = photo.trim();
      updateKid(kid.id, updates);

      // Persist to Firestore before closing so a cold app restart can't
      // rehydrate an older remote kids[] payload and wipe the new photo.
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
      // Surface the actual underlying error so we can debug. Most common
      // causes: Firestore rule denial, undefined field in setDoc, doc-size
      // overrun (>1 MB), or App Check rejection.
      const reason =
        (error?.code ? `[${error.code}] ` : '') +
        (error?.message || 'Unknown error');
      Alert.alert('Could not save changes', reason);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={s.editContent} showsVerticalScrollIndicator={false}>
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

      <Text style={s.editSectionTitle}>Child's Name</Text>
      <TextInput style={s.textInput} value={name} onChangeText={setName} placeholder="Name" placeholderTextColor="#9ca3af" />

      <Text style={s.editSectionTitle}>Date of Birth</Text>
      <DatePickerField value={dob} onChange={setDob} placeholder="Tap to pick date of birth" maxDate={new Date().toISOString().split('T')[0]} />

      <Text style={s.editSectionTitle}>Child's Gender</Text>
      <ChipSelect
        options={GENDER_OPTIONS.map((g) => g.label)}
        selected={GENDER_OPTIONS.find((g) => g.key === gender)?.label ?? 'Surprise'}
        onSelect={(v) => { const found = GENDER_OPTIONS.find((g) => g.label === v); if (found) setGender(found.key as 'boy' | 'girl' | 'surprise'); }}
      />

      <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.85}>
        <LinearGradient colors={[Colors.primary, Colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveBtnGrad}>
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

  const confirmationRef = useRef<PhoneOtpHandle | null>(null);
  const e164 = `+91${digits.replace(/\D/g, '')}`;

  // Removing a saved number entirely is admin-only. Regular users must
  // always have a verified phone on file (anti-abuse + recoverability) — if
  // they want a different number they go through the change-OTP flow above
  // which atomically swaps to a new verified number.
  const canRemove = isAdminEmail(user?.email);

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
      const handle = await sendPhoneOtp(e164);
      confirmationRef.current = handle;
      setStep('enter-code');
    } catch (e: any) {
      if (e?.code === PHONE_OTP_UNSUPPORTED) {
        // Hit on iOS until APNs key is uploaded to Firebase Console.
        setError('Phone OTP is not yet enabled on this device. Please use the web app or an Android device for now.');
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

  const handleRemove = async () => {
    if (!user?.uid) return;
    const ok = await confirmAction(
      'Remove mobile number?',
      `This will unlink ${currentPhone} from your account. You can add a new one any time. Continue?`,
      { confirmLabel: 'Remove' },
    );
    if (!ok) return;
    setError('');
    setBusy(true);
    try {
      await removePhoneFromAccount(user.uid);
      setPhone('');
      setPhoneVerified(false);
      infoAlert('Number removed', 'Your mobile number has been removed from your account.');
      onBack();
    } catch (e: any) {
      setError(e?.message ?? 'Could not remove the number. Please try again.');
    } finally {
      setBusy(false);
    }
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
          <SuccessCheck size={80} style={cp.successIcon} />
          <Text style={cp.successTitle}>Mobile verified</Text>
          <Text style={cp.successSub}>Your new number has been saved.</Text>
        </View>
      ) : (
        <>
          {/* Current number */}
          {currentPhone ? (
            <View style={cp.currentCard}>
              <View style={{ flex: 1 }}>
                <Text style={cp.currentLabel}>Current number</Text>
                <Text style={cp.currentValue}>{currentPhone}</Text>
              </View>
              {/* Remove is admin-only — regular users must keep a verified
                  number on file and use the change-OTP flow below to swap. */}
              {canRemove ? (
                <TouchableOpacity
                  onPress={handleRemove}
                  disabled={busy}
                  style={cp.removeBtn}
                  activeOpacity={0.75}
                  accessibilityLabel="Remove this number"
                >
                  <Ionicons name="trash-outline" size={14} color="#b91c1c" />
                  <Text style={cp.removeBtnText}>Remove</Text>
                </TouchableOpacity>
              ) : null}
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
              colors={[Colors.primary, Colors.primary]}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F5F0FF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EDE9F6',
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
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  removeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b91c1c',
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
  initialKidId,
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
  const notificationsAnchorY = useRef(0);
  const accountAnchorY = useRef(0);

  const scrollToAnchor = (anchor: React.MutableRefObject<number>) => {
    mainScrollRef.current?.scrollTo({
      y: Math.max(0, anchor.current - 18),
      animated: true,
    });
  };

  // When parent opens the modal and requests a specific sub-view or a scroll
  // target, honor that each time `visible` flips to true.
  useEffect(() => {
    if (!visible) return;
    setViewMode(initialView ?? 'main');
    setEditingKidId(initialView === 'edit-kid' ? (initialKidId ?? null) : null);
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
  }, [visible, initialView, initialKidId, scrollToPrivacy]);

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
      await deleteAccount();
      handleClose();
      router.replace('/(auth)/welcome');
    } catch (e: any) {
      console.error('deleteAccount failed:', e);
      // Firebase Auth deletion requires a recent sign-in — if the session is old,
      // the user must sign in again before their account can actually be deleted.
      const code = e?.code ?? '';
      const isStale = code === 'auth/requires-recent-login' ||
                      String(e?.message || '').includes('requires-recent-login');
      Alert.alert(
        'Could not delete account',
        isStale
          ? 'For security, please sign out and sign back in, then try deleting your account again.'
          : 'Something went wrong. Please check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const initials = (motherName || user?.name || 'M').slice(0, 1).toUpperCase();

  const headerTitle = viewMode === 'change-phone'
    ? (phone ? 'Change Mobile Number' : 'Add Mobile Number')
    : viewMode === 'edit-profile'
    ? 'Edit profile'
    : viewMode === 'edit-kid'
    ? `Edit ${editingKid?.name ?? 'Child'}`
    : 'Settings';

  const showBack = viewMode !== 'main';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[s.container, { paddingTop: insets.top }]}>
        {/* Light header — matches the rest of the refreshed UI. */}
        <View style={s.header}>
          <TouchableOpacity onPress={showBack ? handleBack : handleClose} style={s.closeBtn}>
            <Ionicons name={showBack ? 'arrow-back' : 'close'} size={20} color="#6b7280" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{headerTitle}</Text>
          <View style={s.closeBtn} />
        </View>

        {viewMode === 'main' && (
          <ScrollView
            ref={mainScrollRef}
            contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* ─── 1. Identity card ─── */}
            <View style={s.profileCard}>
              {photoUrl ? (
                <RNImage source={{ uri: photoUrl }} style={s.avatar} />
              ) : (
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{initials}</Text>
                </View>
              )}
              <View style={s.profileInfo}>
                <Text style={s.profileName} numberOfLines={1}>{motherName || user?.name || 'Mom'}</Text>
                <Text style={s.profileEmail} numberOfLines={1}>{user?.email || '—'}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setViewMode('edit-profile')}
                activeOpacity={0.75}
                style={s.identityEditBtn}
                accessibilityLabel="Edit profile"
              >
                <Ionicons name="create-outline" size={16} color={Colors.primary} />
                <Text style={s.identityEditText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={s.quickGrid}>
              <QuickSettingsTile
                icon="shield-checkmark-outline"
                label="Account"
                sub="Email, mobile"
                onPress={() => scrollToAnchor(accountAnchorY)}
              />
              <QuickSettingsTile
                icon="people-outline"
                label="Family"
                sub={kids.length > 0 ? `${kids.length} ${kids.length === 1 ? 'child' : 'children'}` : 'Add child'}
                onPress={() => {
                  handleClose();
                  router.push('/(tabs)/family');
                }}
              />
              <QuickSettingsTile
                icon="notifications-outline"
                label="Alerts"
                sub="Push topics"
                onPress={() => scrollToAnchor(notificationsAnchorY)}
              />
              <QuickSettingsTile
                icon="lock-closed-outline"
                label="Privacy"
                sub="Profile & posts"
                onPress={() => scrollToAnchor(privacyAnchorY)}
              />
            </View>

            <SectionHeader title="Personal details" subtitle="Used to tailor MaaMitra to your family" />
            <View style={s.card}>
              <SettingsRow
                icon="person-outline"
                label="Name"
                value={motherName || user?.name || '—'}
                onPress={() => setViewMode('edit-profile')}
              />
              {profile?.state ? (
                <>
                  <View style={s.divider} />
                  <SettingsRow
                    icon="location-outline"
                    label="State"
                    value={profile.state}
                    onPress={() => setViewMode('edit-profile')}
                  />
                </>
              ) : null}
              {profile?.diet ? (
                <>
                  <View style={s.divider} />
                  <SettingsRow
                    icon="restaurant-outline"
                    label="Diet"
                    value={profile.diet.charAt(0).toUpperCase() + profile.diet.slice(1)}
                    onPress={() => setViewMode('edit-profile')}
                  />
                </>
              ) : null}
              {profile?.familyType ? (
                <>
                  <View style={s.divider} />
                  <SettingsRow
                    icon="home-outline"
                    label="Family"
                    value={profile.familyType.charAt(0).toUpperCase() + profile.familyType.slice(1)}
                    onPress={() => setViewMode('edit-profile')}
                  />
                </>
              ) : null}
            </View>

            <SectionHeader title="Family" subtitle="Children are managed in one dedicated place" />
            <View style={s.card}>
              <SettingsRow
                icon="people-outline"
                label={kids.length > 0 ? 'Manage family' : 'Add your first child'}
                value={kids.length > 0 ? `${kids.length} ${kids.length === 1 ? 'child' : 'children'}` : 'Open family setup'}
                onPress={() => {
                  handleClose();
                  router.push('/(tabs)/family');
                }}
              />
            </View>

            <View
              onLayout={(e) => {
                accountAnchorY.current = e.nativeEvent.layout.y;
              }}
            >
              <SectionHeader title="Account" subtitle="Login details and verified contact" />
            </View>
            <View style={s.card}>
              <SettingsRow
                icon="mail-outline"
                label="Email"
                value={user?.email || '—'}
              />
              <View style={s.divider} />
              <SettingsRow
                icon="call-outline"
                label={phoneVerified ? 'Mobile (verified)' : 'Mobile'}
                value={phone || 'Not added'}
                onPress={() => setViewMode('change-phone')}
              />
            </View>

            <View
              onLayout={(e) => {
                notificationsAnchorY.current = e.nativeEvent.layout.y;
              }}
            >
              <SectionHeader
                title="Notifications"
                subtitle="Choose what deserves a push alert"
              />
            </View>
            <NotificationsPanel uid={user?.uid} />

            <View
              onLayout={(e) => {
                privacyAnchorY.current = e.nativeEvent.layout.y;
              }}
            >
              <SectionHeader
                title="Privacy"
                subtitle="Control what other parents can see"
              />
            </View>
            <View style={s.card}>
              <ToggleRow
                label="Number of children"
                value={visibilitySettings.showKids}
                onToggle={() => handlePrivacyToggle('showKids')}
              />
              <View style={s.divider} />
              <ToggleRow
                label="State"
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

            <TouchableOpacity
              style={s.privacyNoteCard}
              onPress={() => handlePrivacyToggle('postsFollowersOnly')}
              activeOpacity={0.75}
            >
              <View style={s.privacyNoteIcon}>
                <Ionicons name="people-outline" size={18} color={Colors.primary} />
              </View>
              <View style={s.privacyNoteContent}>
                <Text style={s.privacyNoteTitle}>Post visibility</Text>
                <Text style={s.privacyNoteText}>Limit every new post to followers only.</Text>
              </View>
              <View style={[s.toggleTrack, visibilitySettings.postsFollowersOnly && s.toggleTrackOn]}>
                <View style={[s.toggleThumb, visibilitySettings.postsFollowersOnly && s.toggleThumbOn]} />
              </View>
            </TouchableOpacity>

            <SectionHeader title="Account safety" subtitle="Sign out or permanently remove your data" />
            <View style={[s.card, s.safetyCard]}>
              <SettingsRow
                icon="log-out-outline"
                label={loading ? 'Signing out...' : 'Sign out'}
                value="Leave this device"
                onPress={loading ? undefined : () => setShowSignOutConfirm(true)}
              />
              <View style={s.divider} />
              <SettingsRow
                icon="trash-outline"
                label="Delete account"
                value="Permanent and cannot be undone"
                onPress={loading ? undefined : handleDeleteAccount}
                danger
              />
            </View>

            {/* Legal + informational footer.
                Visible on every Settings open so reviewers (and users) see
                the "not medical advice" framing plus quick links to Terms
                and Privacy — both required in-app references for Play Store. */}
            <Text style={s.medDisclaimer}>
              MaaMitra is a parenting companion, not a medical service. The AI, articles, and trackers provide information only — always consult a doctor for anything urgent or specific to your child.
            </Text>

            <View style={s.legalRow}>
              <TouchableOpacity
                onPress={() => { onClose(); router.push('/terms'); }}
                activeOpacity={0.7}
              >
                <Text style={s.legalLink}>Terms</Text>
              </TouchableOpacity>
              <Text style={s.legalDot}>·</Text>
              <TouchableOpacity
                onPress={() => { onClose(); router.push('/privacy'); }}
                activeOpacity={0.7}
              >
                <Text style={s.legalLink}>Privacy</Text>
              </TouchableOpacity>
            </View>

            {/* App info — plain, no emoji */}
            <Text style={s.version}>MaaMitra v1.0 · Made in India</Text>
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
              <LinearGradient colors={[Colors.primary, Colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.confirmIconCircle}>
                <Ionicons name="log-out-outline" size={26} color="#ffffff" />
              </LinearGradient>
            </View>
            <Text style={s.confirmTitle}>Sign Out?</Text>
            <Text style={s.confirmSubtitle}>You'll need to sign in again to access your account.</Text>
            <View style={s.confirmBtns}>
              <TouchableOpacity style={s.confirmCancel} onPress={() => setShowSignOutConfirm(false)} activeOpacity={0.8}>
                <Text style={s.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <LinearGradient colors={[Colors.primary, Colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.confirmSignOutBtn}>
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
  container: { flex: 1, backgroundColor: Colors.bgLight },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDF5',
  },
  headerTitle: {
    color: '#1C1033',
    fontSize: 18,
    fontFamily: Fonts.sansBold,
    letterSpacing: -0.2,
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 20 },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#F0EDF5',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontFamily: Fonts.sansBold,
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontSize: 16,
    fontFamily: Fonts.sansBold,
    color: '#1C1033',
    letterSpacing: -0.1,
  },
  profileEmail: {
    fontSize: 13,
    fontFamily: Fonts.sansRegular,
    color: '#6b7280',
    marginTop: 2,
  },
  // Identity-card Edit chip (replaces the old quick Sign Out chip which
  // duplicated the Sign Out row at the bottom).
  identityEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F5F0FF',
    borderWidth: 1,
    borderColor: '#EDE9F6',
  },
  identityEditText: {
    fontSize: 12,
    fontFamily: Fonts.sansBold,
    color: Colors.primary,
  },
  // Legacy aliases kept so no stale reference breaks at runtime if some
  // other file imports them — safe to remove once confirmed unused.
  signOutQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F5F0FF',
    borderWidth: 1,
    borderColor: '#EDE9F6',
  },
  signOutQuickText: {
    fontSize: 12,
    fontFamily: Fonts.sansBold,
    color: Colors.primary,
  },

  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  quickTile: {
    width: '48.5%',
    minHeight: 104,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0EDF5',
    padding: 12,
  },
  quickTileIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickTileLabel: {
    fontSize: 14,
    fontFamily: Fonts.sansBold,
    color: '#1C1033',
  },
  quickTileSub: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: Fonts.sansRegular,
    color: '#6b7280',
    marginTop: 3,
  },

  // Section header wrapper — title + optional helper subtitle under it.
  sectionHeaderWrap: {
    marginTop: 8,
    marginBottom: 8,
    paddingLeft: 4,
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: Fonts.sansBold,
    color: '#6b7280',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionSubtitle: {
    fontSize: 12,
    fontFamily: Fonts.sansRegular,
    color: '#9ca3af',
    marginTop: 3,
    letterSpacing: 0,
  },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#F0EDF5',
    overflow: 'hidden',
  },
  dangerCard: {
    borderColor: 'rgba(239,68,68,0.15)',
  },
  safetyCard: {
    borderColor: 'rgba(239,68,68,0.16)',
    marginBottom: 10,
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
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F5F0FF',
  },
  rowIconDanger: {
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  rowContent: { flex: 1 },
  rowLabel: {
    fontSize: 15,
    fontFamily: Fonts.sansSemiBold,
    color: '#1C1033',
  },
  rowLabelDanger: { color: '#ef4444' },
  rowValue: {
    fontSize: 13,
    fontFamily: Fonts.sansRegular,
    color: '#6b7280',
    marginTop: 2,
  },

  divider: {
    height: 1,
    backgroundColor: '#F0EDF5',
    marginLeft: 60,
  },

  version: {
    textAlign: 'center',
    fontSize: 11,
    fontFamily: Fonts.sansRegular,
    color: '#9ca3af',
    marginTop: 12,
    letterSpacing: 0.2,
  },

  medDisclaimer: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: Fonts.sansRegular,
    color: '#9ca3af',
    paddingHorizontal: 18,
    marginTop: 24,
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  legalLink: {
    fontSize: 12,
    fontFamily: Fonts.sansBold,
    color: Colors.primary,
  },
  legalDot: {
    fontSize: 12,
    color: '#9ca3af',
  },

  privacyNoteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0EDF5',
    padding: 14,
    marginBottom: 18,
  },
  privacyNoteIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyNoteContent: { flex: 1 },
  privacyNoteTitle: {
    fontSize: 15,
    fontFamily: Fonts.sansSemiBold,
    color: '#1C1033',
  },
  privacyNoteText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: Fonts.sansRegular,
    color: '#6b7280',
    marginTop: 2,
  },

  // Accent picker — 5-up grid of swatches.
  accentPickerWrap: {
    padding: 12,
  },
  accentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  accentSwatchWrap: {
    width: '18%',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    borderRadius: 10,
  },
  accentSwatchWrapActive: {
    backgroundColor: '#F5F0FF',
  },
  accentSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    // Subtle neutral lift so the swatches pop against the card bg.
    shadowColor: '#1C1033',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  accentSwatchLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
  },
  accentSwatchLabelActive: {
    color: '#1C1033',
    fontFamily: Fonts.sansBold,
  },

  // Notifications row — same shape as SettingsRow but with a toggle on
  // the right side so the whole row is tappable.
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  // Per-topic sub-toggle. Slightly indented + quieter copy so the
  // hierarchy reads as "master switch ↓ five specific switches".
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 60,
    paddingRight: 14,
    paddingVertical: 12,
    gap: 12,
  },
  prefContent: { flex: 1 },
  prefLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
    color: '#1C1033',
  },
  prefSub: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 1,
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
    borderColor: Colors.primary,
    backgroundColor: 'rgba(28, 16, 51, 0.048)',
  },
  chipText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  chipTextActive: { color: Colors.primary, fontWeight: '700' },

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
  lockedRoleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F0F8',
    borderWidth: 1,
    borderColor: '#EDE9F6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  lockedRoleValue: {
    fontSize: 15,
    color: '#4b3a72',
    fontWeight: '600',
  },
  lockedRoleHint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 6,
    lineHeight: 16,
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
    borderColor: '#F5F0FF',
    marginBottom: 4,
  },
  photoPreviewCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#F5F0FF',
  },
  photoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0EDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActions: { flex: 1, gap: 10 },
  photoUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
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
  toggleTrackOn: { backgroundColor: Colors.primary },
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
    backgroundColor: '#F0EDF5',
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
