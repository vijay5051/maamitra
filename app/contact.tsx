import { Redirect } from 'expo-router';

// Contact lives inside the privacy/terms-style legal pages. Until a
// dedicated contact screen exists, send /contact to /privacy which lists
// the support email in the "How to reach us" section. Per Maamitra
// CLAUDE.md §5, mount-time navigation uses <Redirect>, never router.replace
// from a useEffect.
export default function ContactAlias() {
  return <Redirect href="/privacy" />;
}
