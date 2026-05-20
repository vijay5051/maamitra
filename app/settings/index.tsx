import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore } from '../../store/useProfileStore';
import { useSignOut } from '../../hooks/useSignOut';
import { useDeleteAccount } from '../../hooks/useDeleteAccount';
import SignOutConfirmModal from '../../components/auth/SignOutConfirmModal';
import SignOutOverlay from '../../components/auth/SignOutOverlay';
import DeleteAccountConfirmModal from '../../components/auth/DeleteAccountConfirmModal';
import DeleteAccountOverlay from '../../components/auth/DeleteAccountOverlay';
import { IdentityStrip } from '../../components/ui/IdentityStrip';
import { ScreenHeader } from '../../components/settings/ScreenHeader';
import { Card, Divider, SectionHeader, SettingsRow } from '../../components/settings/SettingsPrimitives';
import { Colors, Fonts, Spacing } from '../../constants/theme';

// Settings index. One row per concern, each pushes a focused sub-screen.
// Deliberately short — the discoverable surface IS the navigation; no
// duplicate "quick grid" that just scrolls to anchors below.
//
// The avatar sheet and several deep-links route here via
// `router.push('/settings')` and `router.push('/settings/<sub>')`.
export default function SettingsIndex() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const { motherName, kids, photoUrl } = useProfileStore();
  const signOut = useSignOut();
  const deleteAccount = useDeleteAccount();

  const displayName = motherName || user?.name || 'Mom';
  const initials = displayName.charAt(0) || 'M';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <IdentityStrip
          name={displayName}
          subline={user?.email || undefined}
          photoUrl={photoUrl || undefined}
          initialsFallback={initials}
          variant="expanded"
          onEditPress={() => router.push('/settings/profile')}
        />

        <Card>
          <SettingsRow
            icon="person-outline"
            label="Profile"
            value="Name, photo, bio, state, diet"
            onPress={() => router.push('/settings/profile')}
          />
          <Divider />
          <SettingsRow
            icon="shield-checkmark-outline"
            label="Account"
            value="Email, mobile number"
            onPress={() => router.push('/settings/account')}
          />
          <Divider />
          <SettingsRow
            icon="people-outline"
            label="Family"
            value={kids.length > 0 ? `${kids.length} ${kids.length === 1 ? 'child' : 'children'}` : 'Add a child'}
            onPress={() => router.push('/(tabs)/family')}
          />
          <Divider />
          <SettingsRow
            icon="notifications-outline"
            label="Push notifications"
            value="Reactions, comments, DMs, follows"
            onPress={() => router.push('/settings/notifications')}
          />
          <Divider />
          <SettingsRow
            icon="lock-closed-outline"
            label="Privacy"
            value="What other parents can see"
            onPress={() => router.push('/settings/privacy')}
          />
          <Divider />
          <SettingsRow
            icon="information-circle-outline"
            label="About & legal"
            value="Terms, privacy policy, version"
            onPress={() => router.push('/settings/about')}
          />
        </Card>

        <SectionHeader title="Account safety" subtitle="Sign out or permanently remove your data" />
        <Card style={styles.safetyCard}>
          <SettingsRow
            icon="log-out-outline"
            label="Sign out"
            value="Leave this device"
            onPress={() => signOut.open()}
          />
          <Divider />
          <SettingsRow
            icon="trash-outline"
            label="Delete account"
            value="Permanent and cannot be undone"
            onPress={() => deleteAccount.open()}
            danger
            showChevron={false}
          />
        </Card>

        <Text style={styles.disclaimer}>
          MaaMitra is a parenting companion, not a medical service. The AI, articles, and trackers provide information only — always consult a doctor for anything urgent or specific to your child.
        </Text>
        <View style={styles.legalRow}>
          <TouchableOpacity onPress={() => router.push('/terms')} activeOpacity={0.7}>
            <Text style={styles.legalLink}>Terms</Text>
          </TouchableOpacity>
          <Text style={styles.legalDot}>·</Text>
          <TouchableOpacity onPress={() => router.push('/privacy')} activeOpacity={0.7}>
            <Text style={styles.legalLink}>Privacy</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.version}>MaaMitra v1.0 · Made in India</Text>
      </ScrollView>

      <SignOutConfirmModal
        visible={signOut.isConfirmOpen}
        onCancel={signOut.cancel}
        onConfirm={signOut.confirm}
      />
      <SignOutOverlay state={signOut.overlayState} />
      <DeleteAccountConfirmModal
        visible={deleteAccount.isConfirmOpen}
        onCancel={deleteAccount.cancel}
        onConfirm={deleteAccount.confirm}
      />
      <DeleteAccountOverlay state={deleteAccount.overlayState} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl },
  safetyCard: {
    borderColor: 'rgba(239,68,68,0.16)',
    marginBottom: 10,
  },
  disclaimer: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: Fonts.sansRegular,
    color: Colors.textMuted,
    paddingHorizontal: 18,
    marginTop: Spacing.xxl,
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 10,
  },
  legalLink: {
    fontSize: 12,
    fontFamily: Fonts.sansBold,
    color: Colors.primary,
  },
  legalDot: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  version: {
    textAlign: 'center',
    fontSize: 11,
    fontFamily: Fonts.sansRegular,
    color: Colors.textMuted,
    marginTop: Spacing.md,
    letterSpacing: 0.2,
  },
});
