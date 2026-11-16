// Android notification channel for MaaMitra pushes.
//
// Without our own channel, FCM posts into its default "Miscellaneous"
// channel at default importance, so notifications land silently in the
// tray instead of popping up at the top of the screen. A HIGH-importance
// channel gives heads-up banners with sound. The server sends every push
// with android.notification.channelId = ALERTS_CHANNEL_ID (functions/src/
// index.ts); on app builds that never created it, Android falls back to the
// default channel, so nothing breaks.

import { Platform } from 'react-native';

export const ALERTS_CHANNEL_ID = 'maamitra_alerts';

let ready: Promise<void> | null = null;

export function ensureAlertsChannel(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  if (ready) return ready;
  ready = (async () => {
    try {
      const Notifications = await import('expo-notifications');
      await Notifications.setNotificationChannelAsync(ALERTS_CHANNEL_ID, {
        name: 'MaaMitra alerts',
        description: 'Vaccine reminders, birthdays, new features and messages',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 150, 250],
        lightColor: '#7B5E9C',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      // Show notifications we post ourselves while the app is open.
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    } catch (err) {
      ready = null;
      console.warn('[push] could not create alerts channel', err);
    }
  })();
  return ready;
}

/**
 * FCM does not display a push while the app is in the foreground on Android,
 * so post it ourselves on the alerts channel.
 */
export async function showForegroundPush(remoteMessage: any): Promise<void> {
  if (Platform.OS !== 'android') return;
  const title = remoteMessage?.notification?.title;
  const body = remoteMessage?.notification?.body;
  if (!title && !body) return;
  try {
    await ensureAlertsChannel();
    const Notifications = await import('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: { title: title ?? 'MaaMitra', body: body ?? '', data: remoteMessage?.data ?? {}, sound: 'default' },
      trigger: { channelId: ALERTS_CHANNEL_ID },
    });
  } catch (err) {
    console.warn('[push] could not show foreground notification', err);
  }
}

/** Open the in-app screen a push points to (data.url, an app route such as "/pricing"). */
export function openPushTarget(data: Record<string, unknown> | undefined | null): void {
  const url = typeof data?.url === 'string' ? data.url : null;
  if (!url || !url.startsWith('/') || url.startsWith('//')) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { router } = require('expo-router');
    // Give the navigator a moment to mount when the tap launched the app.
    setTimeout(() => {
      try {
        router.push(url);
      } catch {
        /* route not available in this build */
      }
    }, 600);
  } catch {
    /* expo-router not ready */
  }
}
