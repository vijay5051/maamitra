import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ConfirmationResult } from 'firebase/auth';
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore } from '../../store/useProfileStore';
import {
  saveUserProfile,
  sendPhoneOtp,
  verifyPhoneOtp,
  resetPhoneRecaptcha,
  PHONE_OTP_CONTAINER_ID,
  PHONE_OTP_UNSUPPORTED,
} from '../../services/firebase';
import { Fonts } from '../../constants/theme';

// Indian mobile numbers: 10 digits starting with 6-9.
function validateIndianMobile(digits: string): string | null {
  const clean = digits.replace(/\D/g, '');
  if (clean.length === 0) return 'Please enter your mobile number';
  if (clean.length !== 10) return 'Mobile number must be 10 digits';
  if (!/^[6-9]/.test(clean)) return 'Please enter a valid Indian mobile number';
  return null;
}

type Step = 'enter-number' | 'enter-code';

export default function PhoneScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const setPhone = useProfileStore((s) => s.setPhone);

  const [step, setStep] = useState<Step>('enter-number');
  const [digits, setDigits] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // The ConfirmationResult from Firebase must survive across re-renders;
  // it's a one-time handle to the pending SMS challenge.
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  const e164 = `+91${digits.replace(/\D/g, '')}`;

  // ─── Step 1: Send OTP ──────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    const validationError = validateIndianMobile(digits);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!user?.uid) {
      setError('You are not signed in.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const confirmation = await sendPhoneOtp(e164);
      confirmationRef.current = confirmation;
      setStep('enter-code');
    } catch (e: any) {
      if (e?.code === PHONE_OTP_UNSUPPORTED) {
        // Native platform — save unverified and continue. This keeps the
        // product usable until we wire native phone auth.
        await savePhoneAndContinue(e164, false);
        return;
      }
      setError(friendlyOtpError(e));
      // Any Firebase OTP error invalidates the recaptcha widget; reset so
      // the next attempt builds a fresh one.
      resetPhoneRecaptcha();
    } finally {
      setBusy(false);
    }
  };

  // ─── Step 2: Verify OTP ────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    const cleanCode = code.replace(/\D/g, '');
    if (cleanCode.length !== 6) {
      setError('Enter the 6-digit code from the SMS.');
      return;
    }
    if (!confirmationRef.current) {
      setError('Verification expired. Please request a new code.');
      setStep('enter-number');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await verifyPhoneOtp(confirmationRef.current, cleanCode);
      await savePhoneAndContinue(e164, true);
    } catch (e: any) {
      setError(friendlyOtpError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    confirmationRef.current = null;
    resetPhoneRecaptcha();
    setCode('');
    setError('');
    setStep('enter-number');
  };

  const savePhoneAndContinue = async (phoneE164: string, verified: boolean) => {
    if (!user?.uid) return;
    setPhone(phoneE164);
    try {
      await saveUserProfile(user.uid, {
        phone: phoneE164,
        phoneVerified: verified,
      });
    } catch (e) {
      console.error('saveUserProfile(phone) failed:', e);
    }
    const onboardingComplete = useProfileStore.getState().onboardingComplete;
    router.replace(onboardingComplete ? '/(tabs)/' : '/(auth)/onboarding');
  };

  const handleChangeDigits = (text: string) => {
    const clean = text.replace(/\D/g, '').slice(0, 10);
    setDigits(clean);
    if (error) setError('');
  };

  const handleChangeCode = (text: string) => {
    const clean = text.replace(/\D/g, '').slice(0, 6);
    setCode(clean);
    if (error) setError('');
  };

  const isEnterNumber = step === 'enter-number';

  return (
    <LinearGradient
      colors={['#1C1033', '#3b1060', '#6d1a7a']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.root, { paddingTop: insets.top + 24 }]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' || Platform.OS === 'web' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          {/* Back button — only on step 2 (step 1 is the start of this flow) */}
          {!isEnterNumber && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleResend}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={22} color="#ffffff" />
              <Text style={styles.backText}>Change number</Text>
            </TouchableOpacity>
          )}

          <View style={styles.iconCircle}>
            <Ionicons
              name={isEnterNumber ? 'phone-portrait-outline' : 'chatbubble-ellipses-outline'}
              size={32}
              color="#ffffff"
            />
          </View>

          <Text style={styles.heading}>
            {isEnterNumber ? 'Add your mobile number' : 'Enter the 6-digit code'}
          </Text>
          <Text style={styles.subheading}>
            {isEnterNumber
              ? "We'll send a one-time code to verify it's really you. Your number stays private."
              : `We sent a code to ${e164}. It may take a few seconds to arrive.`}
          </Text>

          {isEnterNumber ? (
            <View style={[styles.inputRow, error ? styles.inputRowError : null]}>
              <View style={styles.countryCodeBox}>
                <Text style={styles.flag}>🇮🇳</Text>
                <Text style={styles.countryCode}>+91</Text>
              </View>
              <TextInput
                value={digits}
                onChangeText={handleChangeDigits}
                placeholder="98765 43210"
                placeholderTextColor="rgba(255,255,255,0.4)"
                keyboardType="phone-pad"
                maxLength={10}
                style={styles.input}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSendOtp}
              />
            </View>
          ) : (
            <View style={[styles.codeInputRow, error ? styles.inputRowError : null]}>
              <TextInput
                value={code}
                onChangeText={handleChangeCode}
                placeholder="• • • • • •"
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="number-pad"
                maxLength={6}
                style={styles.codeInput}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleVerifyOtp}
              />
            </View>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            onPress={isEnterNumber ? handleSendOtp : handleVerifyOtp}
            disabled={busy || (isEnterNumber ? digits.length < 10 : code.length < 6)}
            activeOpacity={0.85}
            style={{ marginTop: 24 }}
          >
            <LinearGradient
              colors={['#ec4899', '#8b5cf6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.continueBtn,
                (busy || (isEnterNumber ? digits.length < 10 : code.length < 6)) && styles.continueBtnDisabled,
              ]}
            >
              <Text style={styles.continueText}>
                {busy
                  ? (isEnterNumber ? 'Sending…' : 'Verifying…')
                  : (isEnterNumber ? 'Send OTP' : 'Verify & Continue')}
              </Text>
              {!busy && (
                <Ionicons name="arrow-forward" size={18} color="#ffffff" style={{ marginLeft: 6 }} />
              )}
            </LinearGradient>
          </TouchableOpacity>

          {!isEnterNumber && (
            <TouchableOpacity onPress={handleResend} activeOpacity={0.7} style={styles.resendBtn}>
              <Text style={styles.resendText}>Didn't get the code? Resend</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.privacyHint}>
            By continuing you agree to receive transactional SMS on this number. Standard carrier rates may apply.
          </Text>
        </View>
      </KeyboardAvoidingView>

      {/* Invisible reCAPTCHA container — required by Firebase Phone Auth on web.
          React Native Web renders View as <div>, and nativeID becomes the HTML id. */}
      <View nativeID={PHONE_OTP_CONTAINER_ID} style={styles.recaptchaContainer} />
    </LinearGradient>
  );
}

// ─── Error mapping ────────────────────────────────────────────────────────────
function friendlyOtpError(e: any): string {
  const code = e?.code ?? '';
  switch (code) {
    case 'auth/invalid-phone-number':
      return 'That phone number format is invalid.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/invalid-verification-code':
      return 'That code is incorrect. Please check and try again.';
    case 'auth/code-expired':
      return 'Code expired. Tap resend to get a new one.';
    case 'auth/credential-already-in-use':
    case 'auth/account-exists-with-different-credential':
      return 'This number is already linked to another MaaMitra account.';
    case 'auth/captcha-check-failed':
      return 'Security check failed. Please refresh the page and try again.';
    case 'auth/quota-exceeded':
      return 'SMS quota reached. Please try again later.';
    case 'auth/missing-phone-number':
      return 'Please enter your phone number.';
    default:
      return `${code ? code + ': ' : ''}${e?.message ?? 'Something went wrong.'}`;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  backText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    color: '#ffffff',
    marginLeft: 4,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  heading: {
    fontFamily: Fonts.serif,
    fontSize: 28,
    color: '#ffffff',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  subheading: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 20,
    marginBottom: 28,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  inputRowError: {
    borderColor: '#ff6b8a',
  },
  countryCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.12)',
    gap: 6,
  },
  flag: { fontSize: 18 },
  countryCode: {
    fontFamily: Fonts.sansMedium,
    fontSize: 16,
    color: '#ffffff',
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 10 : 12,
    fontFamily: Fonts.sansMedium,
    fontSize: 18,
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  codeInputRow: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  codeInput: {
    textAlign: 'center',
    paddingVertical: Platform.OS === 'web' ? 14 : 16,
    fontFamily: Fonts.sansBold,
    fontSize: 26,
    color: '#ffffff',
    letterSpacing: 8,
  },
  errorText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: '#ff6b8a',
    marginTop: 10,
    marginLeft: 4,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  continueBtnDisabled: {
    opacity: 0.45,
  },
  continueText: {
    fontFamily: Fonts.sansBold,
    fontSize: 16,
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  resendBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  resendText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    textDecorationLine: 'underline',
  },
  privacyHint: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 17,
    marginTop: 24,
  },
  // The reCAPTCHA container must exist in the DOM but can be invisible.
  // Don't display:none it — Firebase needs the element to render the widget.
  recaptchaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 1,
    height: 1,
    opacity: 0,
  },
});
