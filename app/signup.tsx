import { Redirect } from 'expo-router';

// Alias for marketing emails / SMS / external links that use the more
// natural /signup path. Real screen lives at /(auth)/sign-up. Per Maamitra
// CLAUDE.md §5, mount-time navigation uses <Redirect>, never router.replace
// from a useEffect.
export default function SignupAlias() {
  return <Redirect href="/(auth)/sign-up" />;
}
