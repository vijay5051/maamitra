import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sendVerificationEmail, checkEmailVerified } from '../../services/firebase';
import GradientButton from '../../components/ui/GradientButton';

const RESEND_COOLDOWN = 60; // seconds

export default function VerifyEmailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');

  // Start cooldown on mount (email was just sent by sign-up)
  useEffect(() => {
    setCooldown(RESEND_COOLDOWN);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    setSending(true);
    setError('');
    try {
      await sendVerificationEmail();
      setCooldown(RESEND_COOLDOWN);
    } catch (e: any) {
      setError(e?.message ?? 'Could not send email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleContinue = async () => {
    setChecking(true);
    setError('');
    try {
      const verified = await checkEmailVerified();
      if (verified) {
        router.replace('/(auth)/onboarding');
      } else {
        setError('Email not verified yet. Please click the link in your email, then try again.');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Could not verify. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <LinearGradient
      colors={['#fdf2f8', '#ede9fe', '#fdf6ff']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
    >
      {/* Icon */}
      <LinearGradient
        colors={['#ec4899', '#8b5cf6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.iconCircle}
      >
        <Ionicons name="mail-open-outline" size={36} color="#ffffff" />
      </LinearGradient>

      <Text style={styles.title}>Check your email 📬</Text>
      <Text style={styles.body}>
        We've sent a verification link to your email address. Click the link in the email to verify your account.
      </Text>

      <View style={styles.stepCard}>
        <View style={styles.step}>
          <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
          <Text style={styles.stepText}>Open the email from MaaMitra</Text>
        </View>
        <View style={styles.step}>
          <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
          <Text style={styles.stepText}>Click "Verify my email" in the email</Text>
        </View>
        <View style={styles.step}>
          <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
          <Text style={styles.stepText}>Come back here and tap "I've verified"</Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <GradientButton
        title={checking ? 'Checking…' : "I've verified my email →"}
        onPress={handleContinue}
        loading={checking}
        disabled={checking || sending}
        style={styles.continueBtn}
      />

      <TouchableOpacity
        onPress={handleResend}
        disabled={cooldown > 0 || sending}
        style={styles.resendBtn}
        activeOpacity={0.7}
      >
        <Text style={[styles.resendText, (cooldown > 0 || sending) && styles.resendTextDisabled]}>
          {sending
            ? 'Sending…'
            : cooldown > 0
            ? `Resend email in ${cooldown}s`
            : 'Resend verification email'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.replace('/(auth)/sign-in')}
        style={styles.signInLink}
        activeOpacity={0.7}
      >
        <Text style={styles.signInText}>Wrong email? <Text style={styles.signInTextBold}>Sign in with different account</Text></Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
    boxShadow: '0px 4px 12px rgba(236, 72, 153, 0.25)',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a2e',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 28,
    maxWidth: 320,
  },
  stepCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#f3e8ff',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(139,92,246,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8b5cf6',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  errorBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff5f5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#ef4444',
    lineHeight: 19,
  },
  continueBtn: {
    width: '100%',
    marginBottom: 14,
  },
  resendBtn: {
    paddingVertical: 8,
    marginBottom: 12,
  },
  resendText: {
    fontSize: 14,
    color: '#8b5cf6',
    fontWeight: '600',
    textAlign: 'center',
  },
  resendTextDisabled: {
    color: '#9ca3af',
    fontWeight: '400',
  },
  signInLink: {
    paddingVertical: 8,
  },
  signInText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
  signInTextBold: {
    color: '#ec4899',
    fontWeight: '700',
  },
});
