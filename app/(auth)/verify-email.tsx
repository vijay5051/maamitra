import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sendVerificationEmail, checkEmailVerified } from '../../services/firebase';
import GradientButton from '../../components/ui/GradientButton';
import { Fonts } from '../../constants/theme';

const RESEND_COOLDOWN = 60; // seconds

export default function VerifyEmailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    setCooldown(RESEND_COOLDOWN);
  }, []);

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
    <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.iconCircle}>
        <Ionicons name="mail-outline" size={28} color="#7C3AED" />
      </View>

      <Text style={styles.title}>Check your email</Text>
      <Text style={styles.body}>
        We've sent a verification link to your email. Click the link, then come back here to continue.
      </Text>

      <View style={styles.stepCard}>
        {[
          'Open the email from MaaMitra',
          'Click "Verify my email" in the email',
          "Come back here and tap I've verified",
        ].map((text, i) => (
          <View key={i} style={styles.step}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepText}>{text}</Text>
          </View>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <GradientButton
        title={checking ? 'Checking…' : "I've verified my email"}
        onPress={handleContinue}
        loading={checking}
        disabled={checking || sending}
        style={styles.continueBtn}
      />

      <TouchableOpacity
        onPress={handleResend}
        disabled={cooldown > 0 || sending}
        style={styles.resendBtn}
        activeOpacity={0.6}
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
        activeOpacity={0.6}
      >
        <Text style={styles.signInText}>
          Wrong email?{' '}
          <Text style={styles.signInTextBold}>Sign in with a different account</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 22,
    backgroundColor: '#FAFAFB',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    color: '#1C1033',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 26,
    maxWidth: 320,
  },
  stepCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    gap: 14,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#F0EDF5',
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    fontFamily: Fonts.sansBold,
    fontSize: 12,
    color: '#7C3AED',
  },
  stepText: {
    flex: 1,
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  errorBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    flex: 1,
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#b91c1c',
    lineHeight: 18,
  },
  continueBtn: {
    width: '100%',
    marginBottom: 12,
  },
  resendBtn: {
    paddingVertical: 10,
    marginBottom: 8,
  },
  resendText: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: '#7C3AED',
    textAlign: 'center',
  },
  resendTextDisabled: {
    color: '#9ca3af',
    fontFamily: Fonts.sansMedium,
  },
  signInLink: {
    paddingVertical: 8,
  },
  signInText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
  signInTextBold: {
    fontFamily: Fonts.sansBold,
    color: '#7C3AED',
  },
});
