import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GradientButton from '../../components/ui/GradientButton';
import { Fonts } from '../../constants/theme';
import { Colors } from '../../constants/theme';

const LOGO = require('../../assets/logo.png');

// Feature list stays at six items but the icons are now monochrome and the
// tiles are a single neutral tint. Removes the rainbow-sticker look of the
// old welcome while keeping the same substance.
const FEATURES: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }[] = [
  {
    icon: 'chatbubble-ellipses-outline',
    title: 'AI companion',
    text: 'Chat like texting a knowledgeable friend',
  },
  {
    icon: 'flag-outline',
    title: 'India-first',
    text: 'India-specific foods, schemes & languages',
  },
  {
    icon: 'sparkles-outline',
    title: 'Remembers you',
    text: 'Every detail about you and your baby',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Trusted info',
    text: 'IAP and FOGSI aligned medical content',
  },
  {
    icon: 'people-outline',
    title: 'Multi-child',
    text: 'Separate profile for each of your children',
  },
  {
    icon: 'heart-circle-outline',
    title: 'Community',
    text: 'Connect with Indian parents going through it too',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>

        {/* ── Hero ── */}
        <View style={styles.hero}>
          <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
          <Text style={styles.wordmark}>MaaMitra</Text>
          <Text style={styles.tagline}>
            Your AI companion for every step of parenthood.
          </Text>
        </View>

        {/* ── Feature grid ── */}
        <View style={styles.featuresGrid}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureCard}>
              <View style={styles.iconBox}>
                <Ionicons name={f.icon} size={18} color={Colors.primary} />
              </View>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* ── CTA buttons ── */}
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

        <Text style={styles.footer}>
          Protected under India's DPDP Act 2023 · IAP & FOGSI guidelines
        </Text>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAFB' },

  container: {
    flex: 1,
    paddingHorizontal: 22,
    justifyContent: 'space-between',
  },

  // Hero
  hero: { alignItems: 'center', marginTop: 10 },
  logoImage: { width: 72, height: 72, marginBottom: 8 },
  wordmark: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 38,
    color: '#1C1033',
    letterSpacing: -0.6,
    marginBottom: 10,
  },
  tagline: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 21,
  },

  // Features 2-column grid — flat cards with a single neutral icon tile.
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginVertical: 6,
  },
  featureCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#F0EDF5',
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F0FF',
    marginBottom: 10,
  },
  featureTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 13,
    color: '#1C1033',
    marginBottom: 2,
    letterSpacing: 0.1,
  },
  featureText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 17,
  },

  // Buttons
  buttonsContainer: { gap: 6, marginTop: 4 },
  primaryButton: { width: '100%' },
  // Secondary CTA is a quiet text link now — no outline button competing
  // with the primary.
  textCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  textCtaLabel: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#6b7280',
  },
  textCtaAction: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: Colors.primary,
  },

  footer: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 15,
  },
});
