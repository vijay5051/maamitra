import { Platform } from 'react-native';

export type NotificationPermission = 'granted' | 'denied' | 'default' | 'unsupported';

/** Current OS/browser notification permission, without prompting. */
export async function getNotificationPermission(): Promise<NotificationPermission> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    const p = window.Notification.permission;
    return p === 'granted' || p === 'denied' ? p : 'default';
  }
  try {
    const messagingModule = await import('@react-native-firebase/messaging');
    const status = await messagingModule.default().hasPermission();
    const { AuthorizationStatus } = messagingModule;
    if (status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL) return 'granted';
    if (status === AuthorizationStatus.DENIED) return 'denied';
    return 'default';
  } catch {
    return 'unsupported';
  }
}
