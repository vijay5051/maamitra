import React from 'react';
import {
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
import GradientButton from '../../components/ui/GradientButton';
import { Illustration } from '../../components/ui/Illustration';
import type { IllustrationName } from '../../lib/illustrations';
import { Fonts, Colors } from '../../constants/theme';

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
// original compact welcome there: hero + features + CTAs, no extra marketing
// scroll.
const IS_WEB = Platform.OS === 'web';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  if (!IS_WEB) return <NativeWelcome router={router} insets={insets} />;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.scroll,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.container, isWide && styles.containerWide]}>

        <View style={styles.hero}>
          <Illustration name="onboardingWelcome" style={styles.heroIllus} contentFit="contain" />
          <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
          <Text style={styles.wordmark}>MaaMitra</Text>
          <Text style={[styles.tagline, isWide && styles.taglineWide]}>
            Your AI companion for every step of parenthood.
          </Text>
          <Text style={[styles.subTagline, isWide && styles.taglineWide]}>
            An India-first AI mitra for new and expecting mothers — answers your
            2 a.m. questions, remembers your baby, and connects you with parents
            going through the same thing.
          </Text>

          {/* Above-the-fold CTA — visible without scrolling. The full
              finalCta block stays at the bottom for visitors who scroll
              through the marketing first. */}
          <View style={[styles.buttonsContainer, styles.heroCta]}>
            <GradientButton
              title="Get started — it's free"
              onPress={() => router.push('/(auth)/sign-up')}
              style={styles.primaryButton}
            />
            <TouchableOpacity
              style={styles.textCta}
              onPress={() => router.push('/(auth)/sign-in')}
              activeOpacity={0.6}
            >
              <Text style={styles.textCtaLabel}>Already have an account?</Text>
              <Text style={styles.textCtaAction}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>

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

        <View style={styles.finalCta}>
          <Text style={styles.finalCtaTitle}>Millions of 2 a.m. questions,{'\n'}one trusted mitra.</Text>
          <View style={styles.buttonsContainer}>
            <GradientButton
              title="Get started — it's free"
              onPress={() => router.push('/(auth)/sign-up')}
              style={styles.primaryButton}
            />
            <TouchableOpacity
              style={styles.textCta}
              onPress={() => router.push('/(auth)/sign-in')}
              activeOpacity={0.6}
            >
              <Text style={styles.textCtaLabel}>Already have an account?</Text>
              <Text style={styles.textCtaAction}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => router.push('/privacy')}><Text style={styles.footerLink}>Privacy</Text></TouchableOpacity>
            <Text style={styles.footerDot}>·</Text>
            <TouchableOpacity onPress={() => router.push('/terms')}><Text style={styles.footerLink}>Terms</Text></TouchableOpacity>
            <Text style={styles.footerDot}>·</Text>
            <TouchableOpacity onPress={() => Linking.openURL('mailto:info@maamitra.co.in')}><Text style={styles.footerLink}>Contact</Text></TouchableOpacity>
          </View>
          <Text style={styles.footerMeta}>
            © {new Date().getFullYear()} MaaMitra · Made in India
          </Text>
        </View>

      </View>
    </ScrollView>
  );
}

// ── Native (installed app) ── compact single-screen welcome: hero + 6-feature
// grid + CTA. Matches the pre-landing layout so app installs don't scroll
// through marketing copy they already bought into.
function NativeWelcome({
  router,
  insets,
}: {
  router: ReturnType<typeof useRouter>;
  insets: { top: number; bottom: number; left: number; right: number };
}) {
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        nativeStyles.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 },
      ]}
      showsVerticalScrollIndicator={false}
      bounces
    >
        <View style={styles.hero}>
          <Illustration name="onboardingWelcome" style={styles.heroIllus} contentFit="contain" />
          <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
          <Text style={styles.wordmark}>MaaMitra</Text>
          <Text style={nativeStyles.tagline}>
            Your AI companion for every step of parenthood.
          </Text>
        </View>

        <View style={[styles.buttonsContainer, nativeStyles.buttonsContainerTop]}>
          <GradientButton
            title="Get started — it's free"
            onPress={() => router.push('/(auth)/sign-up')}
            style={styles.primaryButton}
          />
          <TouchableOpacity
            style={styles.textCta}
            onPress={() => router.push('/(auth)/sign-in')}
            activeOpacity={0.6}
          >
            <Text style={styles.textCtaLabel}>Already have an account?</Text>
            <Text style={styles.textCtaAction}>Sign in</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.featuresGrid}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureCard}>
              <Illustration name={f.illustration} style={styles.featureIllus} contentFit="contain" />
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        <Text style={nativeStyles.footer}>
          Protected under India's DPDP Act 2023 · IAP & FOGSI guidelines
        </Text>
    </ScrollView>
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
  heroCta: { marginTop: 18, alignSelf: 'center' },
  heroIllus: { width: 220, height: 220, marginBottom: -8 },
  logoImage: { width: 56, height: 56, marginBottom: 6 },
  featureIllus: { width: 56, height: 56, marginBottom: 8, alignSelf: 'flex-start' },
  wordmark: {
    fontFamily: 'DMSans_700Bold', fontSize: 38, color: '#1C1033',
    letterSpacing: -0.6, marginBottom: 10,
  },
  tagline: {
    fontFamily: Fonts.sansBold, fontSize: 18, color: '#1C1033',
    textAlign: 'center', maxWidth: 340, lineHeight: 26, marginBottom: 8,
  },
  taglineWide: { maxWidth: 560, fontSize: 22, lineHeight: 30 },
  subTagline: {
    fontFamily: Fonts.sansRegular, fontSize: 14, color: '#6b7280',
    textAlign: 'center', maxWidth: 340, lineHeight: 21,
  },

  sectionHeader: { marginTop: 18, marginBottom: 10 },
  sectionTitle: { fontFamily: Fonts.sansBold, fontSize: 16, color: '#1C1033', letterSpacing: 0.2 },

  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  featureCard: {
    flexBasis: '48%', flexGrow: 1,
    backgroundColor: Colors.cardBg, borderRadius: 18,
    paddingVertical: 16, paddingHorizontal: 16,
    borderWidth: 1, borderColor: '#F0EDF5',
  },
  featureCardWide: { flexBasis: '31%', flexGrow: 0 },
  iconBox: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F5F0FF', marginBottom: 10,
  },
  featureTitle: {
    fontFamily: Fonts.sansBold, fontSize: 13, color: '#1C1033',
    marginBottom: 2, letterSpacing: 0.1,
  },
  featureText: {
    fontFamily: Fonts.sansRegular, fontSize: 12, color: '#6b7280', lineHeight: 17,
  },

  steps: { gap: 12 },
  step: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: Colors.cardBg, borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: '#F0EDF5',
  },
  stepBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#F5F0FF', alignItems: 'center', justifyContent: 'center',
  },
  stepBadgeText: { fontFamily: Fonts.sansBold, fontSize: 13, color: Colors.primary },
  stepTitle: { fontFamily: Fonts.sansBold, fontSize: 14, color: '#1C1033', marginBottom: 2 },
  stepText: { fontFamily: Fonts.sansRegular, fontSize: 13, color: '#6b7280', lineHeight: 19 },

  trustCard: {
    marginTop: 18, backgroundColor: '#ffffff', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: '#F0EDF5', gap: 8,
  },
  trustRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  trustText: {
    flex: 1, fontFamily: Fonts.sansRegular, fontSize: 12, color: '#4b5563', lineHeight: 18,
  },

  finalCta: { marginTop: 26, alignItems: 'center' },
  finalCtaTitle: {
    fontFamily: Fonts.sansBold, fontSize: 20, color: '#1C1033',
    textAlign: 'center', lineHeight: 28, marginBottom: 14,
  },
  buttonsContainer: { gap: 6, width: '100%', maxWidth: 360 },
  primaryButton: { width: '100%' },
  textCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, gap: 6,
  },
  textCtaLabel: { fontFamily: Fonts.sansRegular, fontSize: 14, color: '#6b7280' },
  textCtaAction: { fontFamily: Fonts.sansBold, fontSize: 14, color: Colors.primary },

  footer: { marginTop: 24, alignItems: 'center', gap: 8 },
  footerLinks: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerLink: { fontFamily: Fonts.sansBold, fontSize: 12, color: Colors.primary },
  footerDot: { color: '#9ca3af', fontSize: 12 },
  footerMeta: {
    fontFamily: Fonts.sansRegular, fontSize: 11, color: '#9ca3af', textAlign: 'center',
  },
});

const nativeStyles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 22,
    justifyContent: 'space-between',
  },
  buttonsContainerTop: {
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 18,
  },
  tagline: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 21,
  },
  footer: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 15,
  },
});
