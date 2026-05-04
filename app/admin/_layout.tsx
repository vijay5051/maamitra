import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
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
          screenOptions={{
            // AdminPage renders its own header (with back, hamburger, and
            // actions) on every screen, so kill the Stack header globally.
            // Avoids the double-header that made mobile feel cramped.
            headerShown: false,
            contentStyle: { backgroundColor: Colors.bgLight },
          }}
        />
      </AdminShell>
      {/* Floating command palette — Cmd/Ctrl-K on web, FAB everywhere else. */}
      <CommandPalette />
    </View>
  );
}
