import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text } from 'react-native';

import JustInTimePrompt from './JustInTimePrompt';
import { useAuthStore } from '../../store/useAuthStore';
import { getNotificationPermission, NotificationPermission } from '../../lib/notificationStatus';
import { requestNotificationPermission } from '../../lib/requestNotificationPermission';
import { Colors, Fonts, Spacing } from '../../constants/theme';

// "Not now" hides the card for the rest of the quarter, so we ask again at most every 3 months.
function quarterKey(): string {
  const d = new Date();
  return `notifOptIn-${d.getFullYear()}Q${Math.floor(d.getMonth() / 3) + 1}`;
}

export default function NotificationsPrompt() {
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void getNotificationPermission().then((p) => alive && setPermission(p));
    return () => {
      alive = false;
    };
  }, [uid]);

  // A browser that has blocked notifications cannot be asked again from the page.
  const canAsk = permission === 'default' || (permission === 'denied' && Platform.OS !== 'web');
  const visible = !!uid && canAsk;

  const turnOn = async () => {
    if (permission === 'denied') {
      await Linking.openSettings();
      return;
    }
    setBusy(true);
    try {
      await requestNotificationPermission(uid);
    } finally {
      setPermission(await getNotificationPermission());
      setBusy(false);
    }
  };

  return (
    <JustInTimePrompt
      promptKey={quarterKey()}
      question="Turn on notifications?"
      reason="Get vaccine due dates, monthly growth reminders, new recipes and app updates. You can choose which ones in Settings."
      visible={visible}
    >
      <Pressable style={styles.button} onPress={turnOn} disabled={busy} accessibilityRole="button">
        {busy ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.buttonText}>{permission === 'denied' ? 'Open phone settings' : 'Turn on'}</Text>
        )}
      </Pressable>
    </JustInTimePrompt>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    minWidth: 120,
    alignItems: 'center',
  },
  buttonText: { fontFamily: Fonts.sansBold, fontSize: 14, color: Colors.white },
});
