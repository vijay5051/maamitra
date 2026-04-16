import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GradientButton from '../../components/ui/GradientButton';
import { Fonts } from '../../constants/theme';

const LOGO = require('../../assets/logo.png');

const FEATURES = [
  { emoji: '💬', title: 'AI Companion', text: 'Chat like texting a knowledgeable friend' },
  { emoji: '🇮🇳', title: 'India-First', text: 'India-specific foods, schemes & languages' },
  { emoji: '🧠', title: 'Remembers You', text: 'Remembers every detail about you & baby' },
  { emoji: '🏥', title: 'Trusted Info', text: 'IAP & FOGSI aligned medical content' },
  { emoji: '👨‍👩‍👧', title: 'Multi-Child', text: 'Profiles for all your children' },
  { emoji: '👥', title: 'Community', text: 'Connect with Indian mothers' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={['#1C1033', '#3b1060', '#6d1a7a']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      {/* Glow blobs */}
      <View style={styles.glowTopRight} pointerEvents="none" />
      <View style={styles.glowBottomLeft} pointerEvents="none" />
      <View style={styles.glowCenter} pointerEvents="none" />

      <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>

        {/* ── Hero ── */}
        <View style={styles.hero}>
          <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
          <Text style={styles.wordmark}>MaaMitra</Text>
          <Text style={styles.tagline}>
            Your AI companion for every step of motherhood
          </Text>
        </View>

        {/* ── Feature grid ── */}
        <View style={styles.featuresGrid}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureCard}>
              <Text style={styles.featureEmoji}>{f.emoji}</Text>
              <View style={styles.featureTextWrap}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── CTA buttons ── */}
        <View style={styles.buttonsContainer}>
          <GradientButton
            title="Get Started — It's Free ✨"
            onPress={() => router.push('/(auth)/sign-up')}
            style={styles.primaryButton}
          />
          <TouchableOpacity
            style={styles.outlineButton}
            onPress={() => router.push('/(auth)/sign-in')}
            activeOpacity={0.75}
          >
            <Text style={styles.outlineButtonText}>I already have an account</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          Protected under India's DPDP Act 2023 · IAP & FOGSI guidelines
        </Text>

      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },

  // Glow blobs
  glowTopRight: {
    position: 'absolute', width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(232,72,122,0.2)', top: -80, right: -80,
  },
  glowBottomLeft: {
    position: 'absolute', width: 240, height: 240, borderRadius: 120,
    backgroundColor: 'rgba(124,58,237,0.18)', bottom: 80, left: -80,
  },
  glowCenter: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(232,72,122,0.08)', top: '35%', right: -60,
  },

  container: {
    flex: 1,
    paddingHorizontal: 22,
    justifyContent: 'space-between',
  },

  // Hero
  hero: { alignItems: 'center' },
  logoImage: { width: 100, height: 100, marginBottom: 4 },
  wordmark: {
    fontFamily: Fonts.serif,
    fontSize: 38,
    color: '#ffffff',
    letterSpacing: -1,
    textShadowColor: 'rgba(232,72,122,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 16,
    marginBottom: 8,
  },
  tagline: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 21,
  },

  // Features 2-column grid
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureCard: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  } as any,
  featureEmoji: { fontSize: 20, width: 24, textAlign: 'center', marginTop: 1 },
  featureTextWrap: { flex: 1 },
  featureTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 2,
  },
  featureText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 16,
  },

  // Buttons
  buttonsContainer: { gap: 10 },
  primaryButton: { width: '100%' },
  outlineButton: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  outlineButtonText: {
    fontFamily: Fonts.sansBold,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    letterSpacing: 0.2,
  },

  footer: {
    fontFamily: Fonts.sansRegular,
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    lineHeight: 15,
  },
});
