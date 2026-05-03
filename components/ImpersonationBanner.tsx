// Sticky banner shown across the whole app while an admin is impersonating
// a user. Admin-only (non-admins never write to this store). Mounted in
// app/_layout.tsx.

import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Spacing } from '../constants/theme';
import { useAuthStore } from '../store/useAuthStore';
import { useImpersonationStore } from '../store/useImpersonationStore';

export default function ImpersonationBanner() {
  const targetName = useImpersonationStore((s) => s.targetName);
  const targetUid = useImpersonationStore((s) => s.targetUid);
  const end = useImpersonationStore((s) => s.end);
  const user = useAuthStore((s) => s.user);

  if (!targetUid) return null;

  return (
    <View style={[styles.bar, Platform.OS === 'web' && styles.barWeb]}>
      <Ionicons name="eye-outline" size={14} color={Colors.white} />
      <Text style={styles.text} numberOfLines={1}>
        Viewing as <Text style={styles.bold}>{targetName ?? 'user'}</Text>
      </Text>
      <Pressable
        onPress={() => user && end({ uid: user.uid, email: user.email })}
        style={styles.endBtn}
        accessibilityLabel="End impersonation"
      >
        <Text style={styles.endBtnText}>End</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.warning,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    zIndex: 10000,
  },
  barWeb: { position: 'sticky' as any, top: 0 },
  text: { flex: 1, color: Colors.white, fontSize: FontSize.xs, fontWeight: '600' },
  bold: { fontWeight: '800' },
  endBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  endBtnText: { color: Colors.white, fontSize: 11, fontWeight: '800' },
});
