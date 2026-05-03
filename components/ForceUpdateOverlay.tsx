// Full-screen "please update" overlay shown when the local build number
// is below `forceUpdate.minBuildNumber` set by an admin.
//
// Web has no build number — `forceUpdate` is for native only. The web
// build is updated atomically on every Firebase Hosting deploy, so the
// concept doesn't apply.

import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '../constants/theme';
import { useRuntimeConfigStore } from '../store/useRuntimeConfigStore';
import { useAuthStore } from '../store/useAuthStore';
import { isAdminEmail } from '../lib/admin';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.maamitra.app';
const APP_STORE_URL = 'https://apps.apple.com/app/maamitra/id0000000000';

function currentBuildNumber(): number {
  if (Platform.OS === 'android') {
    const v = (Constants.expoConfig?.android?.versionCode ?? 0) as number;
    return typeof v === 'number' ? v : 0;
  }
  if (Platform.OS === 'ios') {
    const raw = Constants.expoConfig?.ios?.buildNumber;
    const n = raw ? parseInt(String(raw), 10) : 0;
    return Number.isFinite(n) ? n : 0;
  }
  return Number.MAX_SAFE_INTEGER; // web is always "current"
}

export default function ForceUpdateOverlay() {
  const cfg = useRuntimeConfigStore((s) => s.config.forceUpdate);
  const ready = useRuntimeConfigStore((s) => s.ready);
  const user = useAuthStore((s) => s.user);

  if (!ready || !cfg.enabled) return null;
  if (Platform.OS === 'web') return null;
  if (isAdminEmail(user?.email)) return null;
  const cur = currentBuildNumber();
  if (cur >= cfg.minBuildNumber) return null;

  const onUpdate = () => {
    const url = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
    Linking.openURL(url).catch(() => { /* ignore */ });
  };

  return (
    <View style={styles.root}>
      <View style={styles.iconRing}>
        <Ionicons name="cloud-download-outline" size={32} color={Colors.primary} />
      </View>
      <Text style={styles.title}>{cfg.title}</Text>
      <Text style={styles.body}>{cfg.message}</Text>
      <Pressable style={styles.btn} onPress={onUpdate} accessibilityRole="button">
        <Text style={styles.btnText}>Update now</Text>
        <Ionicons name="arrow-forward" size={16} color={Colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.bgLight,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Spacing.xxxl,
    gap: Spacing.md,
    zIndex: 9998,
  },
  iconRing: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textDark, textAlign: 'center' },
  body: { fontSize: FontSize.md, color: Colors.textLight, textAlign: 'center', maxWidth: 480, lineHeight: 22 },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.xl, paddingVertical: 14,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    marginTop: Spacing.lg,
  },
  btnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
});
