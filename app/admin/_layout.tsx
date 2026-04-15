import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';

export default function AdminLayout() {
  const { user } = useAuthStore();
  const router = useRouter();
  const adminEmail = process.env.EXPO_PUBLIC_ADMIN_EMAIL;

  useEffect(() => {
    if (!user || user.email !== adminEmail) {
      router.replace('/(tabs)/chat');
    }
  }, [user]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#ec4899',
        headerTitleStyle: { fontWeight: '700', color: '#1a1a2e' },
        headerShadowVisible: false,
      }}
    />
  );
}
