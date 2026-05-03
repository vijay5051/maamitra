import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors } from '../../constants/theme';
import { isAdminEmail, AdminRole } from '../../lib/admin';
import { useAdminRole } from '../../lib/useAdminRole';
import CommandPalette from '../../components/admin/CommandPalette';
import { AdminShell } from '../../components/admin/ui';

// Re-export the allow-list for callers that used to import it from here.
// New code should import { isAdminEmail } from '../../lib/admin' directly.
export { ADMIN_EMAILS } from '../../lib/admin';

export default function AdminLayout() {
  const { user } = useAuthStore();
  const router = useRouter();
  const role = useAdminRole();
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= 1100;

  useEffect(() => {
    function bounce() {
      requestAnimationFrame(() => router.replace('/(auth)/welcome'));
    }
    if (!user) {
      bounce();
      return;
    }
    if (!isAdminEmail(user.email) && role === null) {
      const t = setTimeout(() => {
        if (!isAdminEmail(user.email) && role === null) bounce();
      }, 1500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  // Resolve effective role for the shell (founder bootstrap → 'super').
  const effectiveRole: AdminRole | null = isAdminEmail(user?.email) ? 'super' : role;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bgLight }}>
      <AdminShell role={effectiveRole} email={user?.email}>
        <Stack
          screenOptions={({ navigation }: any) => ({
            // On wide-web with sidebar, kill the redundant Stack header — the
            // AdminPage component renders its own. On native/narrow, keep the
            // header so screens that haven't migrated yet still have one.
            headerShown: !isWide,
            headerStyle: { backgroundColor: Colors.cardBg },
            headerTintColor: Colors.primary,
            headerTitleStyle: { fontWeight: '700', color: Colors.textDark },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: Colors.bgLight },
            headerLeft: navigation.canGoBack()
              ? () => (
                  <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={{ paddingHorizontal: 8, paddingVertical: 6 }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="chevron-back" size={26} color={Colors.primary} />
                  </TouchableOpacity>
                )
              : undefined,
          })}
        />
      </AdminShell>
      {/* Floating command palette — Cmd/Ctrl-K on web, FAB everywhere else. */}
      <CommandPalette />
    </View>
  );
}
