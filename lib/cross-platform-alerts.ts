import { Alert, Platform } from 'react-native';

/**
 * Cross-platform yes/no confirm dialog.
 *
 * RN's `Alert.alert` renders on react-native-web but its destructive-style
 * button onPress callbacks silently never fire — known long-standing bug.
 * On web we fall through to `window.confirm`, which is reliable on every
 * browser including Safari iPhone. On native we keep the native Alert.
 */
export function confirmAction(
  title: string,
  message: string,
  opts?: { confirmLabel?: string; cancelLabel?: string; destructive?: boolean },
): Promise<boolean> {
  const confirmLabel = opts?.confirmLabel ?? 'OK';
  const cancelLabel = opts?.cancelLabel ?? 'Cancel';
  const destructive = opts?.destructive ?? true;

  if (Platform.OS === 'web') {
    return Promise.resolve(
      typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`),
    );
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}

/**
 * Cross-platform single-button info alert (e.g. "Done" / "Failed").
 * Same RN-Web caveat as confirmAction — single-button alerts also fail to
 * render reliably in some Safari versions. Use window.alert on web.
 */
export function infoAlert(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(message ? `${title}\n\n${message}` : title);
    }
    return;
  }
  Alert.alert(title, message);
}
