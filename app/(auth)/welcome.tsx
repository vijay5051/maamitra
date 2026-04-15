import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GradientButton from '../../components/ui/GradientButton';

const FEATURES = [
  { emoji: '💬', text: 'Chat-first — like texting a knowledgeable friend' },
  { emoji: '🇮🇳', text: 'India-specific — local foods, schemes & languages' },
  { emoji: '🧠', text: 'Self-learning — remembers every detail about you' },
  { emoji: '🏥', text: 'IAP & FOGSI aligned medical content' },
  { emoji: '👨‍👩‍👧', text: 'Multi-child profiles — including expecting' },
  { emoji: '👥', text: 'Community of Indian mothers — real support' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={['#fdf2f8', '#ede9fe', '#fdf6ff']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.gradient}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo circle */}
        <LinearGradient
          colors={['#ec4899', '#8b5cf6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logoCircle}
        >
          <Text style={styles.logoEmoji}>🤱</Text>
        </LinearGradient>

        {/* App name */}
        <Text style={styles.appName}>MaaMitra</Text>
        <Text style={styles.tagline}>
          Your AI-powered companion for every step of motherhood — from bump to toddler and beyond
        </Text>

        {/* Feature cards */}
        <View style={styles.featuresContainer}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Text style={styles.featureEmoji}>{f.emoji}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* CTA buttons */}
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

        {/* Footer */}
        <Text style={styles.footer}>
          Protected under India's DPDP Act 2023 · IAP & FOGSI guidelines
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 24,
    boxShadow: '0px 8px 20px rgba(236, 72, 153, 0.30)',
  },
  logoEmoji: {
    fontSize: 52,
    lineHeight: 60,
    textAlign: 'center',
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#be185d',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  tagline: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 24,
    marginBottom: 32,
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 36,
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    boxShadow: '0px 2px 8px rgba(139, 92, 246, 0.06)',
  },
  featureEmoji: {
    fontSize: 22,
    marginRight: 14,
    width: 28,
    textAlign: 'center',
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    lineHeight: 20,
  },
  buttonsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 28,
  },
  primaryButton: {
    width: '100%',
  },
  outlineButton: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#ec4899',
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  outlineButtonText: {
    color: '#ec4899',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  footer: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 280,
  },
});
