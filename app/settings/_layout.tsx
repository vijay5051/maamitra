import { Stack } from 'expo-router';

// Settings stack. Each sub-screen is a real route so deep-links like
// /settings/privacy work, the platform back-stack is honoured, and screens
// can be reached from any tab without modal-on-modal stacking.
//
// The cream header inside each screen is rendered by the screen itself so
// we keep visual parity with the rest of the refreshed UI.
export default function SettingsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
