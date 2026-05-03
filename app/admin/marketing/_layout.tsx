// Marketing module Stack layout.
//
// Routes nest under /admin/marketing/* and inherit the admin shell
// from the parent /admin/_layout.tsx — auth + role gating already
// happens upstream. This layout exists so each sub-screen gets its
// own native header title.

import { Stack } from 'expo-router';

export default function MarketingLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
