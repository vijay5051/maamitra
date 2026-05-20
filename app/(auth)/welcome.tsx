
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SmartInputCard from '../../components/auth/SmartInputCard';
import { Illustration } from '../../components/ui/Illustration';
import type { IllustrationName } from '../../lib/illustrations';
import { Fonts, Colors } from '../../constants/theme';
import { useAuthStore } from '../../store/useAuthStore';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import { wipeAllLocalStorage } from '../../lib/storageEscape';
import { friendlyAuthError } from '../../lib/friendlyAuthError';
import { isAdminEmail } from '../../lib/admin';
import { logAuthEvent } from '../../lib/authObservability';
import { savePhoneVerification } from '../../lib/savePhoneVerification';
import { auth as firebaseAuth } from '../../services/firebase';

const LOGO = require('../../assets/logo.png');

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; illustration: IllustrationName; title: string; text: string }[] = [
  { icon: 'chatbubble-ellipses-outline', illustration: 'featureAi',        title: 'AI companion', text: 'Chat like texting a knowledgeable friend' },
  { icon: 'flag-outline',                illustration: 'featureIndia',     title: 'India-first',   text: 'India-specific foods, schemes & languages' },
  { icon: 'sparkles-outline',            illustration: 'featureGrowth',    title: 'Remembers you', text: 'Every detail about you and your baby' },
  { icon: 'shield-checkmark-outline',    illustration: 'featurePrivate',   title: 'Trusted info',  text: 'IAP and FOGSI aligned medical content' },
  { icon: 'people-outline',              illustration: 'featureLibrary',   title: 'Multi-child',   text: 'Separate profile for each of your children' },
  { icon: 'heart-circle-outline',        illustration: 'featureCommunity', title: 'Community',     text: 'Connect with Indian parents going through it too' },
];

const STEPS: { n: string; title: string; text: string }[] = [
  { n: '1', title: 'Sign up & tell us about your baby', text: 'Just a due date or DOB to start — add more whenever you like.' },
  { n: '2', title: 'Ask anything, anytime',              text: 'Feeding, fevers, milestones, government schemes — your mitra is awake at 2 a.m.' },
  { n: '3', title: 'Grow together',                      text: 'Milestone reminders, a private community, and content that speaks Indian.' },
];

// Web (maamitra.co.in) shows the full marketing landing page — required for
// Play Console's public Website URL, privacy/terms discoverability, and search
// engines. Installed mobile app users already *have* the app, so we keep the
// original compact welcome there: hero + SmartInputCard, no extra marketing scroll.
const IS_WEB = Platform.OS === 'web';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const { onGoogleCredential } = useAuthStore();
  const isLoading = useAuthStore((s) => s.isLoading);
  const { signIn: googleSignIn, ready: googleReady } = useGoogleSignIn();

  const [authError, setAuthError] = useState<string>('');
  const [showEscape, setShowEscape] = useState(false);

  // Plan A: 5-second cache-stuck escape hatch
  useEffect(() => {
    if (!isLoading) {
      setShowEscape(false);
      return;
    }
    const t = setTimeout(() => setShowEscape(true), 5000);
    return () => clearTimeout(t);
  }, [isLoading]);

  // Phone-primary path: SmartInputCard has already done the OTP. We just
  // persist the verified number and route onward.
  // Read uid from auth.currentUser first — the Firebase user from
  // signInWithPhoneNumber may not have flushed into Zustand yet.
  const handlePhoneVerified = useCallback(async (e164: string) => {
    const uid = firebaseAuth?.currentUser?.uid ?? useAuthStore.getState().user?.uid;
    if (!uid) {
      setAuthError('Could not establish your account. Please try again.');
      return;
    }
    const destination = await savePhoneVerification({ uid, e164, verified: true });
    // Admin shortcut: phone-verified admins skip onboarding and go straight to /admin.
    const email = firebaseAuth?.currentUser?.email ?? useAuthStore.getState().user?.email;
    if (isAdminEmail(email)) {
      router.replace('/admin');
      return;
    }
    router.replace(destination);
  }, [router]);

  const handleGoogle = async () => {
    setAuthError('');
    try {
      const credential = await googleSignIn();
      // Web uses signInWithRedirect — the browser navigates away to Google,
      // then back to our origin where `getGoogleRedirectResult()` in
      // useAuthStore resolves the credential on boot, and the global gate
      // in `app/index.tsx` does the destination routing. So on web we
      // never get a credential back here; just return and let the redirect
      // take over.
      if (!credential) return;
      const dest = await onGoogleCredential(credential);
      if (isAdminEmail(credential.user.email)) return router.replace('/admin');
      if (dest === 'tabs') return router.replace('/(tabs)');
      if (dest === 'phone') return router.replace('/(auth)/phone');
      return router.replace('/(auth)/onboarding');
    } catch (e: any) {
      logAuthEvent({ type: 'auth:method-cancelled', method: 'google' });
      setAuthError(friendlyAuthError(e, 'google'));
    }
  };

  // Apple is PARKED — SmartInputCard receives showApple={false} so this is never called.
  const handleApple = () => {};

  const handleEscape = () => {
    const confirmText = 'This will clear cached data and sign you out completely. Continue?';
    if (typeof window !== 'undefined') {
      if (window.confirm(confirmText)) void wipeAllLocalStorage();
    } else {
      Alert.alert('Reset local storage', confirmText, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => void wipeAllLocalStorage() },
      ]);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        IS_WEB ? styles.scroll : nativeStyles.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
      showsVerticalScrollIndicator={false}
      bounces
    >
      <View style={[styles.container, isWide && styles.containerWide]}>

        <View style={styles.hero}>
          <Illustration name="onboardingWelcome" style={styles.heroIllus} contentFit="contain" />
          <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
          <Text style={styles.wordmark}>MaaMitra</Text>
          <Text style={[styles.tagline, isWide && styles.taglineWide]}>
            Your AI companion for every step of parenthood.
          </Text>
          {IS_WEB && (
            <Text style={[styles.subTagline, isWide && styles.taglineWide]}>
              An India-first AI mitra for new and expecting mothers — answers your
              2 a.m. questions, remembers your baby, and connects you with parents
              going through the same thing.
            </Text>
          )}
        </View>

        <SmartInputCard
          onPhoneVerified={handlePhoneVerified}
          onPressGoogle={handleGoogle}
          onPressApple={handleApple}
          showApple={false}
          googleLoading={!googleReady}
          error={authError}
        />

        {!IS_WEB && (
          <Text style={nativeStyles.footer}>
            Protected under India's DPDP Act 2023 · IAP & FOGSI guidelines
          </Text>
        )}

        {showEscape && (
          <TouchableOpacity
            onPress={handleEscape}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Reset local storage"
            style={{ marginTop: 16, alignSelf: 'center' }}
          >
            <Text style={styles.escapeLink}>Trouble signing in? Reset local storage.</Text>
          </TouchableOpacity>
        )}

        {IS_WEB && <WebMarketingSection isWide={isWide} router={router} />}

      </View>
    </ScrollView>
  );
}

function WebMarketingSection({
  isWide,
  router,
}: {
  isWide: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <>
      {/* Why MaaMitra section + FEATURES grid */}
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Why MaaMitra</Text></View>
      <View style={styles.featuresGrid}>
        {FEATURES.map((f, i) => (
          <View key={i} style={[styles.featureCard, isWide && styles.featureCardWide]}>
            <Illustration name={f.illustration} style={styles.featureIllus} contentFit="contain" />
            <Text style={styles.featureTitle}>{f.title}</Text>
            <Text style={styles.featureText}>{f.text}</Text>
          </View>
        ))}
      </View>

      {/* How it works STEPS */}
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>How it works</Text></View>
      <View style={styles.steps}>
        {STEPS.map((s) => (
          <View key={s.n} style={styles.step}>
            <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{s.n}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>{s.title}</Text>
              <Text style={styles.stepText}>{s.text}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Trust card */}
      <View style={styles.trustCard}>
        <View style={styles.trustRow}>
          <Ionicons name="shield-checkmark-outline" size={16} color={Colors.primary} />
          <Text style={styles.trustText}>Protected under India's DPDP Act, 2023</Text>
        </View>
        <View style={styles.trustRow}>
          <Ionicons name="medkit-outline" size={16} color={Colors.primary} />
          <Text style={styles.trustText}>Medical content aligned with IAP & FOGSI guidelines</Text>
        </View>
        <View style={styles.trustRow}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
          <Text style={styles.trustText}>
            Not a substitute for a doctor — always consult for medical emergencies (108 / 102).
          </Text>
        </View>
      </View>

      {/* Footer: Privacy / Terms / contact / copyright. No duplicate auth CTAs — SmartInputCard above handles sign-in. */}
      <View style={styles.footer}>
        <View style={styles.footerLinks}>
          <TouchableOpacity
            onPress={() => router.push('/privacy')}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            accessibilityRole="link"
            accessibilityLabel="Privacy policy"
          >
            <Text style={styles.footerLink}>Privacy</Text>
          </TouchableOpacity>
          <Text style={styles.footerDot}>·</Text>
          <TouchableOpacity
            onPress={() => router.push('/terms')}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            accessibilityRole="link"
            accessibilityLabel="Terms of service"
          >
            <Text style={styles.footerLink}>Terms</Text>
          </TouchableOpacity>
        </View>
        {/* Always-visible contact email — `mailto:` silently no-ops in
            browsers without a configured handler, so we render the
            address itself as copyable text and only attempt mailto on tap. */}
        <TouchableOpacity
          onPress={() => Linking.openURL('mailto:info@maamitra.co.in')}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          accessibilityRole="link"
          accessibilityLabel="Email MaaMitra at info@maamitra.co.in"
        >
          <Text style={styles.footerContact}>
            Contact: <Text style={styles.footerContactEmail} selectable>info@maamitra.co.in</Text>
          </Text>
        </TouchableOpacity>
        <Text style={styles.footerMeta}>
          © {new Date().getFullYear()} MaaMitra · Made in India
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgLight },
  scroll: { flexGrow: 1 },
  container: { paddingHorizontal: 22, alignSelf: 'stretch' },
  containerWide: {
    maxWidth: 960, alignSelf: 'center', width: '100%', paddingHorizontal: 32,
  },

  hero: { alignItems: 'center', marginTop: 10, marginBottom: 24 },
  heroIllus: { width: 220, height: 220, marginBottom: -8 },
  logoImage: { width: 56, height: 56, marginBottom: 6 },
  featureIllus: { width: 56, height: 56, marginBottom: 8, alignSelf: 'flex-start' },
  wordmark: {
    // Lora (Fonts.serif) is the brand's headline face — pairs the welcome
    // wordmark with the "Welcome back" / "Create your account" headings on
    // the sign-in/sign-up screens. Previously this was DMSans 700, which
    // made the wordmark feel different from every adjacent screen.
    fontFamily: Fonts.serif, fontSize: 40, color: Colors.textDark,
    letterSpacing: -0.4, marginBottom: 10,
  },
  tagline: {
    fontFamily: Fonts.sansBold, fontSize: 18, color: Colors.textDark,
    textAlign: 'center', maxWidth: 340, lineHeight: 26, marginBottom: 8,
  },
  taglineWide: { maxWidth: 560, fontSize: 22, lineHeight: 30 },
  subTagline: {
    fontFamily: Fonts.sansRegular, fontSize: 14, color: '#6b7280',
    textAlign: 'center', maxWidth: 340, lineHeight: 21,
  },

  sectionHeader: { marginTop: 18, marginBottom: 10 },
  sectionTitle: { fontFamily: Fonts.sansBold, fontSize: 16, color: Colors.textDark, letterSpacing: 0.2 },

  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  featureCard: {
    flexBasis: '48%', flexGrow: 1,
    backgroundColor: Colors.cardBg, borderRadius: 18,
    paddingVertical: 16, paddingHorizontal: 16,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  featureCardWide: { flexBasis: '31%', flexGrow: 0 },
  iconBox: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F5F0FF', marginBottom: 10,
  },
  featureTitle: {
    fontFamily: Fonts.sansBold, fontSize: 13, color: Colors.textDark,
    marginBottom: 2, letterSpacing: 0.1,
  },
  featureText: {
    fontFamily: Fonts.sansRegular, fontSize: 12, color: '#6b7280', lineHeight: 17,
  },

  steps: { gap: 12 },
  step: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: Colors.cardBg, borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  stepBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#F5F0FF', alignItems: 'center', justifyContent: 'center',
  },
  stepBadgeText: { fontFamily: Fonts.sansBold, fontSize: 13, color: Colors.primary },
  stepTitle: { fontFamily: Fonts.sansBold, fontSize: 14, color: Colors.textDark, marginBottom: 2 },
  stepText: { fontFamily: Fonts.sansRegular, fontSize: 13, color: '#6b7280', lineHeight: 19 },

  trustCard: {
    marginTop: 18, backgroundColor: Colors.white, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: Colors.borderSoft, gap: 8,
  },
  trustRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  trustText: {
    flex: 1, fontFamily: Fonts.sansRegular, fontSize: 12, color: '#4b5563', lineHeight: 18,
  },

  footer: { marginTop: 24, alignItems: 'center', gap: 8 },
  footerLinks: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerLink: { fontFamily: Fonts.sansBold, fontSize: 12, color: Colors.primary, paddingVertical: 4 },
  footerDot: { color: Colors.textLight, fontSize: 12 },
  footerContact: {
    fontFamily: Fonts.sansRegular, fontSize: 12, color: Colors.textLight, textAlign: 'center',
  },
  footerContactEmail: { fontFamily: Fonts.sansBold, color: Colors.primary },
  footerMeta: {
    fontFamily: Fonts.sansRegular, fontSize: 11, color: Colors.textLight, textAlign: 'center',
  },
  escapeLink: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    color: Colors.textLight,
    textDecorationLine: 'underline',
    marginTop: 8,
    textAlign: 'center',
  },
});

const nativeStyles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 22,
    justifyContent: 'space-between',
  },
  footer: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 20,
  },
});
