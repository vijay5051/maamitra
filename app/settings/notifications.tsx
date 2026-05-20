import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/useAuthStore';
import { ScreenHeader } from '../../components/settings/ScreenHeader';
import { Card, SectionHeader } from '../../components/settings/SettingsPrimitives';
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
import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';

const PREF_ROWS: Array<{ key: keyof NotifPrefs; label: string; sub: string }> = [
  { key: 'reactions',     label: 'Reactions',       sub: 'When someone reacts to your post' },
  { key: 'comments',      label: 'Comments',        sub: 'When someone comments on your post' },
  { key: 'dms',           label: 'Direct messages', sub: 'New chat messages' },
  { key: 'follows',       label: 'Follows',         sub: 'Follow requests & accepts' },
  { key: 'announcements', label: 'Announcements',   sub: 'Broadcasts from MaaMitra' },
];

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const uid = user?.uid;

  const [support, setSupport] = useState<PushSupportStatus | null>(null);
  const [permission, setPermission] = useState<'unsupported' | 'default' | 'granted' | 'denied'>('default');
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (Platform.OS !== 'web') {
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
                if (uid) await registerFcmToken(uid, nativeToken);
                if (!cancelled) setToken(nativeToken);
              } else if (!cancelled) setToken(null);
            } catch {
              if (!cancelled) setToken(null);
            }
          } else if (status === AuthorizationStatus.DENIED) setPermission('denied');
          else setPermission('default');
        } catch {
          if (!cancelled) setPermission('default');
        }
      })();
      return () => { cancelled = true; };
    }
    checkPushSupportDetailed().then((s) => {
      if (cancelled) return;
      setSupport(s);
      setPermission(currentPushPermission() as any);
    });
    return () => { cancelled = true; };
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    loadNotifPrefs(uid).then((p) => {
      if (!cancelled) {
        setPrefs(p);
        setPrefsLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, [uid]);

  const supported = support?.ok === true;
  const enabled = permission === 'granted' && !!token;
  const blocked = permission === 'denied';
  const showSubToggles = enabled && prefsLoaded;

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
    if (Platform.OS !== 'web') {
      setBusy(true);
      try {
        if (enabled) {
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
            "You declined the system prompt. Open device settings to enable them whenever you're ready.",
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
    setPrefs((p) => ({ ...p, [key]: next }));
    try {
      await updateNotifPref(uid, key, next);
    } catch {
      setPrefs((p) => ({ ...p, [key]: !next }));
    }
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Push notifications" />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}>
        <SectionHeader title="Push" subtitle="Choose what deserves a push alert on this device" />
        {support ? (
          <Card>
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
              <View style={[s.toggleTrack, enabled && s.toggleTrackOn, (!supported || busy) && { opacity: 0.5 }]}>
                <View style={[s.toggleThumb, enabled && s.toggleThumbOn]} />
              </View>
            </TouchableOpacity>

            {showSubToggles && (
              <>
                <View style={s.divider} />
                {PREF_ROWS.map((row, idx) => (
                  <React.Fragment key={row.key}>
                    {idx > 0 && <View style={s.prefDivider} />}
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
          </Card>
        ) : null}
        <Text style={s.footnote}>
          You can still see reactions, comments, and DMs in your Activity and Messages inbox even if push is off.
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: Spacing.md,
  },
  rowIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.bgTint,
    alignItems: 'center', justifyContent: 'center',
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, fontFamily: Fonts.sansSemiBold, color: Colors.textDark },
  rowValue: { fontSize: 13, fontFamily: Fonts.sansRegular, color: Colors.textLight, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.borderSoft },
  prefDivider: { height: 1, backgroundColor: Colors.borderSoft, marginLeft: 60 },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 60,
    paddingRight: 14,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  prefContent: { flex: 1 },
  prefLabel: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: Colors.textDark },
  prefSub: { fontFamily: Fonts.sansRegular, fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  toggleTrack: {
    width: 44, height: 26, borderRadius: 13,
    backgroundColor: '#e5e7eb', padding: 3,
  },
  toggleTrackOn: { backgroundColor: Colors.primary },
  toggleThumb: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15, shadowRadius: 2, elevation: 2,
  },
  toggleThumbOn: { transform: [{ translateX: 18 }] },
  footnote: {
    fontSize: 12,
    fontFamily: Fonts.sansRegular,
    color: Colors.textMuted,
    lineHeight: 18,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
});
