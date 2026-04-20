import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors } from '../../constants/theme';
import { isAdminEmail } from '../../lib/admin';

// Re-export the allow-list for callers that used to import it from here.
// New code should import { isAdminEmail } from '../../lib/admin' directly.
export { ADMIN_EMAILS } from '../../lib/admin';

export default function AdminLayout() {
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!user || !isAdminEmail(user.email)) {
      router.replace('/(auth)/welcome');
    }
  }, [user]);

  return (
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
  );
}
