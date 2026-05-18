import { Redirect } from 'expo-router';

// Alias for marketing emails / SMS / external links that use the more
// natural /signin path. Real screen lives at /(auth)/sign-in. Per Maamitra
// CLAUDE.md §5, mount-time navigation uses <Redirect>, never router.replace
// from a useEffect.
export default function SigninAlias() {
  return <Redirect href="/(auth)/sign-in" />;
}
