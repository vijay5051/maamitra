import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#fdf6ff' },
        animation: 'slide_from_right',
      }}
    />
  );
}
