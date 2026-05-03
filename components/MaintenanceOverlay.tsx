// Full-screen overlay shown when admin flips `maintenance.enabled = true`
// in app_config/runtime. Mounted in the root layout so it covers every
// screen.
//
// Two modes:
//   - Hard maintenance: blocks ALL of the app. Only escape: admin.
//   - Read-only maintenance: app loads but write paths show a small
//     "read-only" badge. Implementation of write blocking lives in the
//     individual mutators (they consult useRuntimeConfigStore).
//
// Admins ALWAYS bypass — the support team must be able to fix what's
// broken without flipping the switch off first.

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Spacing } from '../constants/theme';
import { useAuthStore } from '../store/useAuthStore';
import { useMaintenanceMode } from '../lib/useFeatureFlag';
import { isAdminEmail } from '../lib/admin';

export default function MaintenanceOverlay() {
  const { enabled, title, message, allowReadOnly } = useMaintenanceMode();
  const user = useAuthStore((s) => s.user);

  // Hide for admins (always) and when not in hard maintenance.
  if (!enabled) return null;
  if (allowReadOnly) return null;
  if (isAdminEmail(user?.email)) return null;

  return (
    <View style={styles.root}>
      <View style={styles.iconRing}>
        <Ionicons name="construct-outline" size={32} color={Colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{message}</Text>
      <Text style={styles.hint}>You'll be able to use MaaMitra again automatically once we're done.</Text>
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
    zIndex: 9999,
  },
  iconRing: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textDark, textAlign: 'center' },
  body: { fontSize: FontSize.md, color: Colors.textLight, textAlign: 'center', maxWidth: 480, lineHeight: 22 },
  hint: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.md },
});
