// Wrap any subtree that should hide when a feature flag is off.
//
//   <FeatureGate feature="community">
//     <CommunityTab />
//   </FeatureGate>
//
// When the flag is off, renders the optional `fallback` (or nothing).
// Until the runtime config loads (`ready === false`) we render children
// to avoid a hidden→visible flicker.

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../constants/theme';
import { FeatureKey } from '../services/featureFlags';
import { useFeatureFlag } from '../lib/useFeatureFlag';

interface Props {
  feature: FeatureKey;
  /** Custom fallback. Defaults to a friendly "this is paused" card. */
  fallback?: React.ReactNode;
  /** Hide entirely when off (no fallback rendered). */
  hideWhenOff?: boolean;
  children: React.ReactNode;
}

export default function FeatureGate({ feature, fallback, hideWhenOff, children }: Props) {
  const { enabled } = useFeatureFlag(feature);
  if (enabled) return <>{children}</>;
  if (hideWhenOff) return null;
  if (fallback) return <>{fallback}</>;
  return <DefaultPausedCard feature={feature} />;
}

function DefaultPausedCard({ feature }: { feature: FeatureKey }) {
  return (
    <View style={styles.card}>
      <View style={styles.iconRing}>
        <Ionicons name="moon-outline" size={22} color={Colors.primary} />
      </View>
      <Text style={styles.title}>This section is paused</Text>
      <Text style={styles.body}>
        We're polishing this part of MaaMitra and will turn it back on shortly.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: Spacing.lg,
    padding: Spacing.xl,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.borderSoft,
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  iconRing: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textDark, textAlign: 'center' },
  body: { fontSize: FontSize.sm, color: Colors.textLight, textAlign: 'center', maxWidth: 360, lineHeight: 20 },
});
