import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors } from '../../constants/theme';
import { isAdminEmail } from '../../lib/admin';
import { useAdminRole } from '../../lib/useAdminRole';
import CommandPalette from '../../components/admin/CommandPalette';

// Re-export the allow-list for callers that used to import it from here.
// New code should import { isAdminEmail } from '../../lib/admin' directly.
export { ADMIN_EMAILS } from '../../lib/admin';

export default function AdminLayout() {
  const { user } = useAuthStore();
  const router = useRouter();
  const role = useAdminRole();

  useEffect(() => {
    // Hard gate: must be signed in AND on the email allow-list OR have a
    // Firestore-stored adminRole. We resolve the role async via useAdminRole;
    // until it loads, the email check covers the founder case so they never
    // see a redirect flash. The redirect is wrapped in a microtask so it
    // fires after the navigator's first commit (otherwise expo-router warns
    // "Attempted to navigate before mounting the Root Layout component").
    function bounce() {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      requestAnimationFrame(() => router.replace('/(auth)/welcome'));
    }
    if (!user) {
      bounce();
      return;
    }
    if (!isAdminEmail(user.email) && role === null) {
      // Allow a beat for the role to load on cold start before bouncing.
      const t = setTimeout(() => {
        if (!isAdminEmail(user.email) && role === null) bounce();
      }, 1500);
      return () => clearTimeout(t);
    }
    // user / role check covers it; router is stable so omit from deps to
    // avoid effect re-runs when the router object changes identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={({ navigation }: any) => ({
          headerStyle: { backgroundColor: '#fff' },
          headerTintColor: Colors.primary,
          headerTitleStyle: { fontWeight: '700', color: '#1a1a2e' },
          headerShadowVisible: false,
          // Explicit back button — ensures it's visible on web where the default
          // tinted back icon can be invisible against the white header
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
      {/* Floating command palette — Cmd/Ctrl-K on web, FAB everywhere else. */}
      <CommandPalette />
    </View>
  );
}
