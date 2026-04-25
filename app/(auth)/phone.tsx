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
import GradientButton from '../../components/ui/GradientButton';
import { Fonts } from '../../constants/theme';
import { Colors } from '../../constants/theme';

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

  // Firebase ConfirmationResult — a one-time handle to the pending SMS
  // challenge. Kept in a ref so a re-render doesn't drop it.
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
      // Previously we used to silently save the unverified phone and route to
      // home when OTP was unsupported. That bypassed verification entirely
      // and stored an unverified number to the profile. Surface a clear
      // error and keep the user on this screen — never trust the number
      // until OTP succeeds.
      if (e?.code === PHONE_OTP_UNSUPPORTED) {
        setError("We couldn't send an SMS to this number right now. Please try again in a moment, or use a different number.");
      } else {
        setError(friendlyOtpError(e));
      }
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
    router.replace(onboardingComplete ? '/(tabs)' : '/(auth)/onboarding');
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
  const canContinue = !busy && (isEnterNumber ? digits.length === 10 : code.length === 6);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' || Platform.OS === 'web' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          {/* Top-left back — step 2 goes back to step 1, step 1 closes the flow */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={isEnterNumber ? () => router.back() : handleResend}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={22} color="#6b7280" />
            {!isEnterNumber && <Text style={styles.backText}>Change number</Text>}
          </TouchableOpacity>

          <View style={styles.iconCircle}>
            <Ionicons
              name={isEnterNumber ? 'phone-portrait-outline' : 'chatbubble-ellipses-outline'}
              size={24}
              color={Colors.primary}
            />
          </View>

          <Text style={styles.heading}>
            {isEnterNumber ? 'Add your mobile number' : 'Enter the 6-digit code'}
          </Text>
          <Text style={styles.subheading}>
            {isEnterNumber
              ? "We'll text a one-time code to verify it's you. Your number stays private."
              : `We sent a code to ${e164}. It may take a few seconds to arrive.`}
          </Text>

          {isEnterNumber ? (
            <View style={[styles.inputRow, error ? styles.inputRowError : null]}>
              <View style={styles.countryCodeBox}>
                <Text style={styles.countryCode}>🇮🇳 +91</Text>
              </View>
              <TextInput
                value={digits}
                onChangeText={handleChangeDigits}
                placeholder="98765 43210"
                placeholderTextColor="#c4b5d4"
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
                placeholderTextColor="#d4c9e8"
                keyboardType="number-pad"
                maxLength={6}
                style={styles.codeInput}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleVerifyOtp}
              />
            </View>
          )}

          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={14} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <GradientButton
            title={
              busy
                ? (isEnterNumber ? 'Sending…' : 'Verifying…')
                : (isEnterNumber ? 'Send OTP' : 'Verify & continue')
            }
            onPress={isEnterNumber ? handleSendOtp : handleVerifyOtp}
            disabled={!canContinue}
            style={styles.continueBtn}
          />

          {!isEnterNumber && (
            <TouchableOpacity onPress={handleResend} activeOpacity={0.6} style={styles.resendBtn}>
              <Text style={styles.resendText}>Didn't get the code? Resend</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.privacyHint}>
            By continuing you agree to receive transactional SMS on this number. Standard carrier rates may apply.
          </Text>
        </View>
      </KeyboardAvoidingView>

      {/* Invisible reCAPTCHA container — required by Firebase Phone Auth on
          web. React Native Web renders nativeID as the HTML id. */}
      <View nativeID={PHONE_OTP_CONTAINER_ID} style={styles.recaptchaContainer} />
    </View>
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
      return e?.message ?? 'Something went wrong.';
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAFB' },
  flex: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  backText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 2,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  heading: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    color: '#1C1033',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  subheading: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 28,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E1EE',
    paddingHorizontal: 4,
  },
  inputRowError: {
    borderColor: '#ef4444',
  },
  countryCodeBox: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: '#F0EDF5',
  },
  countryCode: {
    fontFamily: Fonts.sansMedium,
    fontSize: 15,
    color: '#1C1033',
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 12 : 14,
    fontFamily: Fonts.sansMedium,
    fontSize: 16,
    color: '#1C1033',
    letterSpacing: 0.3,
  },
  codeInputRow: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E1EE',
  },
  codeInput: {
    textAlign: 'center',
    paddingVertical: Platform.OS === 'web' ? 14 : 16,
    fontFamily: Fonts.sansBold,
    fontSize: 24,
    color: '#1C1033',
    letterSpacing: 8,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  errorText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#ef4444',
  },
  continueBtn: {
    marginTop: 24,
  },
  resendBtn: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 4,
  },
  resendText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    color: Colors.primary,
  },
  privacyHint: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: '#9ca3af',
    lineHeight: 17,
    marginTop: 24,
  },
  // reCAPTCHA container must exist in DOM — kept 1x1 and invisible.
  recaptchaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 1,
    height: 1,
    opacity: 0,
  },
});
