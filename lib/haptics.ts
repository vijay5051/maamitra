import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Light tap — primary buttons, card presses, tab switches. ~5ms pulse. */
export function lightTap(): void {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Medium tap — confirmation actions (Save, Done, Submit). */
export function mediumTap(): void {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Success bump — celebration moments (mood logged, vaccine logged,
 *  milestone reached, yoga session done). Pairs with confetti visually. */
export function successBump(): void {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Selection change — segmented controls, tab pill changes. Subtle click. */
export function selectionTick(): void {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync().catch(() => {});
}
