import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';

// ─── Admin access: add your admin emails here ─────────────────────────────────
export const ADMIN_EMAILS = new Set([
  process.env.EXPO_PUBLIC_ADMIN_EMAIL ?? '',
  'admin@maamitra.app',
  'vijay@maamitra.app',
  'demo@maamitra.app', // preview / demo mode
].filter(Boolean));

export default function AdminLayout() {
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!user || !ADMIN_EMAILS.has(user.email)) {
      router.replace('/(tabs)/chat');
    }
  }, [user]);

  return (
    <Stack
      screenOptions={({ navigation }: any) => ({
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#7C3AED',
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
                <Ionicons name="chevron-back" size={26} color="#7C3AED" />
              </TouchableOpacity>
            )
          : undefined,
      })}
    />
  );
}
