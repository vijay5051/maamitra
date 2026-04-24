import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts, Colors } from '../../constants/theme';
import GradientButton from '../../components/ui/GradientButton';
import { sendPasswordReset } from '../../services/firebase';

// ─── Forgot password ──────────────────────────────────────────────────────────
// One-screen flow: enter email → tap "Send reset link" → see a confirmation
// that doesn't reveal whether the email actually exists (Firebase's own
// response doesn't reveal it either, but we explicitly mirror that phrasing
// so a successful-looking UI isn't an oracle for user enumeration).

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const canSubmit = email.trim().length > 0 && !loading;

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter the email you signed up with.');
      return;
    }
    // Lightweight client-side validation before hitting Firebase.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("That doesn't look like a valid email.");
      return;
    }
    setError('');
    setLoading(true);
    try {
      await sendPasswordReset(trimmed);
      // Always succeed from the UI's perspective (don't leak whether the
      // email exists). Firebase will silently skip the send for missing
      // addresses or non-email providers (Google accounts).
      setSent(true);
    } catch (e: any) {
      const code = e?.code ?? '';
      if (code === 'auth/invalid-email') {
        setError("That doesn't look like a valid email.");
      } else if (code === 'auth/network-request-failed') {
        setError('No internet connection. Please try again.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait a few minutes and try again.');
      } else {
        // Even for generic errors, prefer the neutral success state so a
        // network blip doesn't reveal that the email is registered.
        setSent(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={22} color="#1C1033" />
          </TouchableOpacity>

          <View style={styles.titleBlock}>
            <View style={styles.iconBubble}>
              <Ionicons name="lock-closed-outline" size={26} color={Colors.primary} />
            </View>
            <Text style={styles.titleText}>Reset your password</Text>
            <Text style={styles.subtitleText}>
              Enter the email you used to sign up.{'\n'}We'll send you a secure link to set a new password.
            </Text>
          </View>

          {sent ? (
            <View style={styles.successCard}>
              <View style={styles.successIconWrap}>
                <Ionicons name="checkmark-circle" size={24} color="#10b981" />
              </View>
              <Text style={styles.successTitle}>Check your inbox</Text>
              <Text style={styles.successText}>
                If an account exists for{' '}
                <Text style={styles.successEmail}>{email.trim()}</Text>, a password-reset link is on its way.
                It usually arrives within a minute — check the Spam or Promotions folder if you don't see it.
              </Text>
              <Text style={styles.successHint}>
                Signed in with Google? There's no password to reset — just use{' '}
                <Text style={{ fontFamily: Fonts.sansBold }}>Continue with Google</Text> on the sign-in screen.
              </Text>
              <GradientButton title="Back to sign in" onPress={() => router.replace('/(auth)/sign-in')} style={{ marginTop: 16 }} />
              <TouchableOpacity onPress={() => { setSent(false); setEmail(''); }} style={styles.resendBtn} activeOpacity={0.7}>
                <Text style={styles.resendBtnText}>Send to a different email</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.fieldWrap}>
                <Ionicons name="mail-outline" size={18} color={Colors.primary} style={styles.fieldIcon} />
                <TextInput
                  value={email}
                  onChangeText={(t) => { setEmail(t); if (error) setError(''); }}
                  placeholder="priya@example.com"
                  placeholderTextColor="#9ca3af"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  returnKeyType="send"
                  onSubmitEditing={handleSubmit}
                  style={styles.fieldInput}
                />
              </View>
              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={14} color="#ef4444" style={{ marginRight: 6 }} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <GradientButton
                title={loading ? 'Sending\u2026' : 'Send reset link'}
                onPress={handleSubmit}
                disabled={!canSubmit}
                style={{ marginTop: 14 }}
              />

              <TouchableOpacity style={styles.signInLink} onPress={() => router.replace('/(auth)/sign-in')} activeOpacity={0.6}>
                <Text style={styles.signInText}>
                  Remembered it?{' '}
                  <Text style={styles.signInTextBold}>Sign in</Text>
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAFB' },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 22 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 6 },
  titleBlock: { alignItems: 'center', marginTop: 8, marginBottom: 28 },
  iconBubble: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primarySoft, marginBottom: 14,
    borderWidth: 1, borderColor: Colors.primaryAlpha20,
  },
  titleText: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    color: '#1C1033',
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitleText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13.5,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  fieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 12 : 14,
    gap: 10,
  },
  fieldIcon: { marginRight: 2 },
  fieldInput: {
    flex: 1,
    fontFamily: Fonts.sansMedium,
    fontSize: 15,
    color: '#1C1033',
    padding: 0,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: 10,
  },
  errorText: {
    flex: 1,
    fontFamily: Fonts.sansMedium,
    color: '#b91c1c',
    fontSize: 12.5,
  },
  signInLink: { alignSelf: 'center', marginTop: 22 },
  signInText: { fontFamily: Fonts.sansRegular, fontSize: 13, color: '#6b7280' },
  signInTextBold: { fontFamily: Fonts.sansBold, color: Colors.primary },

  successCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    alignItems: 'center',
  },
  successIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(16,185,129,0.10)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)',
  },
  successTitle: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    color: '#1C1033',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  successText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13.5,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 20,
  },
  successEmail: { fontFamily: Fonts.sansBold, color: '#1C1033' },
  successHint: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 17,
  },
  resendBtn: { marginTop: 10 },
  resendBtnText: { fontFamily: Fonts.sansBold, fontSize: 13, color: Colors.primary },
});
