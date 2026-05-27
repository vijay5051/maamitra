import { useCallback, useRef, useState } from 'react';
import {
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import GradientButton from '../ui/GradientButton';
import GoogleGIcon from '../ui/GoogleGIcon';
import AppleSignInButton from './AppleSignInButton';
import { Colors, Fonts } from '../../constants/theme';
import {
  auth as firebaseAuth,
  sendPhoneOtp,
  verifyPhoneOtp,
  resetPhoneRecaptcha,
  PHONE_OTP_CONTAINER_ID,
  PHONE_OTP_UNSUPPORTED,
  type PhoneOtpHandle,
} from '../../services/firebase';
import { logAuthEvent } from '../../lib/authObservability';
import { useAuthStore } from '../../store/useAuthStore';

// ─── Friendly OTP error mapper ────────────────────────────────────────────────
// Mirrors phone.tsx's friendlyOtpError so messages are consistent across both
// surfaces. If phone.tsx's mapping ever grows, keep these in sync.
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
      return 'Code expired. Tap "Change number" to send a new code.';
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
      return e?.message ?? 'Something went wrong. Please try again.';
  }
}

type Step = 'phone' | 'code';

interface Props {
  /**
   * Called after successful OTP verify. SmartInputCard hands the verified
   * e164 to the parent which calls savePhoneVerification + router.replace.
   */
  onPhoneVerified: (e164: string) => Promise<void> | void;
  onPressGoogle: () => void;
  onPressApple: () => void;
  /** Whether to render the Apple button. Hide on Android / web without Apple JS SDK. */
  showApple: boolean;
  /** True while the Google SDK isn't ready yet. Disables the button silently (no progress text). */
  googleLoading?: boolean;
  /**
   * True after the user has tapped "Continue with Google" and we're either
   * mid-redirect (web) or mid-native-prompt. Shows a "Continuing with Google…"
   * label so the user knows progress is happening — otherwise the button
   * looks dead during the ~1s before Google's redirect navigates away.
   */
  googleSubmitting?: boolean;
  /** Parent-controlled error (e.g. Google flow error). Shown alongside localError. */
  error?: string;
}

export default function SmartInputCard({
  onPhoneVerified,
  onPressGoogle,
  onPressApple,
  showApple,
  googleLoading,
  googleSubmitting,
  error,
}: Props) {
  // ── Phone step state ─────────────────────────────────────────────────────
  const [digits, setDigits] = useState('');
  const clean = digits.replace(/\D/g, '').slice(0, 10);
  const validPhone = clean.length === 10 && /^[6-9]/.test(clean);
  const e164 = `+91${clean}`;

  // ── OTP step state ───────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('phone');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const confirmationRef = useRef<PhoneOtpHandle | null>(null);

  // ── Hardware back on step 2: go to step 1, not exit the screen ───────────
  useFocusEffect(
    useCallback(() => {
      if (step !== 'code') return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        handleChangeNumber();
        return true; // consumed — do NOT exit
      });
      return () => sub.remove();
    }, [step]) // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Send OTP ─────────────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (!validPhone || busy) return;
    setLocalError('');
    setBusy(true);
    try {
      const handle = await sendPhoneOtp(e164);
      confirmationRef.current = handle;
      setStep('code');
      logAuthEvent({
        type: 'auth:phone-otp-sent',
        e164Masked: e164.slice(0, 6) + '****',
      });
    } catch (e: any) {
      if (e?.code === PHONE_OTP_UNSUPPORTED) {
        setLocalError("We couldn't send an SMS to this number right now. Please try again in a moment, or use a different number.");
      } else {
        setLocalError(friendlyOtpError(e));
      }
      logAuthEvent({
        type: 'auth:phone-otp-failed',
        reason: String(e?.code ?? e?.message ?? 'unknown'),
      });
      resetPhoneRecaptcha();
    } finally {
      setBusy(false);
    }
  };

  // ── Verify OTP ────────────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    const cleanCode = code.replace(/\D/g, '');
    if (cleanCode.length !== 6) {
      setLocalError('Enter the 6-digit code from the SMS.');
      return;
    }
    if (!confirmationRef.current) {
      setLocalError('Verification expired. Please tap "Change number" to start over.');
      setStep('phone');
      return;
    }
    setLocalError('');
    setBusy(true);
    try {
      await verifyPhoneOtp(confirmationRef.current, cleanCode);
      // Firebase may not have flushed the new user into Zustand yet — read
      // auth.currentUser directly (the source of truth at this moment).
      const uid = firebaseAuth?.currentUser?.uid ?? useAuthStore.getState().user?.uid;
      logAuthEvent({
        type: 'auth:phone-otp-verified',
        uid: uid ?? '',
      });
      await onPhoneVerified(e164);
    } catch (e: any) {
      setLocalError(friendlyOtpError(e));
      logAuthEvent({
        type: 'auth:phone-otp-failed',
        reason: String(e?.code ?? e?.message ?? 'unknown'),
      });
    } finally {
      setBusy(false);
    }
  };

  // ── Change number ─────────────────────────────────────────────────────────
  const handleChangeNumber = () => {
    confirmationRef.current = null;
    setCode('');
    setLocalError('');
    resetPhoneRecaptcha();
    setStep('phone');
  };

  // ── Render ────────────────────────────────────────────────────────────────
  // Show whichever error is non-empty (local OTP error takes priority).
  const displayError = localError || error || '';

  if (step === 'code') {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Enter the 6-digit code</Text>
        <Text style={styles.sub}>
          {`We sent it to ${e164}. May take a few seconds.`}
        </Text>

        <View style={styles.inputRow}>
          <TextInput
            value={code}
            onChangeText={(t) => {
              setCode(t.replace(/\D/g, '').slice(0, 6));
              if (localError) setLocalError('');
            }}
            placeholder="• • • • • •"
            placeholderTextColor={Colors.textLight}
            keyboardType="number-pad"
            maxLength={6}
            style={[styles.input, styles.codeInput]}
            accessibilityLabel="One-time code"
            inputMode="numeric"
            autoComplete="one-time-code"
            returnKeyType="done"
            onSubmitEditing={handleVerifyOtp}
            autoFocus
          />
        </View>

        {displayError ? <Text style={styles.errorText}>{displayError}</Text> : null}

        <GradientButton
          title={busy ? 'Verifying…' : 'Verify'}
          onPress={handleVerifyOtp}
          style={styles.cta}
          disabled={code.replace(/\D/g, '').length !== 6 || busy}
        />

        <Pressable
          onPress={handleChangeNumber}
          style={styles.changeNumberBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Change my phone number"
        >
          <Text style={styles.changeNumberText}>Change number</Text>
        </Pressable>

        {/* Invisible reCAPTCHA container — must exist in DOM before sendPhoneOtp is called */}
        <View nativeID={PHONE_OTP_CONTAINER_ID} style={styles.recaptchaContainer} />
      </View>
    );
  }

  // ── Step 1: phone input ───────────────────────────────────────────────────
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Let's get you in</Text>
      <Text style={styles.sub}>Just your number. We'll figure out the rest.</Text>

      <View style={styles.inputRow}>
        <Text style={styles.prefix}>🇮🇳 +91</Text>
        <TextInput
          value={clean}
          onChangeText={(t) => {
            setDigits(t);
            if (localError) setLocalError('');
          }}
          placeholder="Mobile number"
          placeholderTextColor={Colors.textLight}
          keyboardType="phone-pad"
          maxLength={10}
          style={styles.input}
          accessibilityLabel="Indian mobile number"
          returnKeyType="done"
          onSubmitEditing={handleSendOtp}
        />
      </View>

      {displayError ? <Text style={styles.errorText}>{displayError}</Text> : null}

      <GradientButton
        title={busy ? 'Sending OTP…' : 'Continue'}
        onPress={handleSendOtp}
        style={styles.cta}
        disabled={!validPhone || busy}
      />

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>faster sign-in</Text>
        <View style={styles.dividerLine} />
      </View>

      <Pressable
        style={[styles.googleBtn, (googleLoading || googleSubmitting) && styles.googleBtnDisabled]}
        onPress={googleLoading || googleSubmitting ? undefined : onPressGoogle}
        accessibilityRole="button"
        accessibilityLabel={googleSubmitting ? 'Continuing with Google' : 'Continue with Google'}
        accessibilityState={{ disabled: !!(googleLoading || googleSubmitting) }}
      >
        <GoogleGIcon size={18} />
        <Text style={styles.googleText}>
          {googleSubmitting ? 'Continuing with Google…' : 'Continue with Google'}
        </Text>
      </Pressable>

      {showApple && (
        <View style={{ marginTop: 8 }}>
          <AppleSignInButton onPress={onPressApple} />
        </View>
      )}

      <Text style={styles.footnote}>
        Returning user? Same screen — we'll detect your account.
      </Text>

      {/* Invisible reCAPTCHA container — must exist in DOM before sendPhoneOtp is called */}
      <View nativeID={PHONE_OTP_CONTAINER_ID} style={styles.recaptchaContainer} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 380, alignSelf: 'center' },
  title: { fontFamily: Fonts.serif, fontSize: 24, color: Colors.textDark, textAlign: 'center', marginBottom: 4 },
  sub: { fontFamily: Fonts.sansRegular, fontSize: 13, color: Colors.textLight, textAlign: 'center', marginBottom: 18, lineHeight: 19 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F9F7FD',
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
  },
  prefix: { fontFamily: Fonts.sansBold, fontSize: 14, color: Colors.textDark },
  input: { flex: 1, fontFamily: Fonts.sansRegular, fontSize: 16, color: Colors.textDark, paddingVertical: 0 },
  codeInput: {
    textAlign: 'center',
    fontFamily: Fonts.sansBold,
    fontSize: 22,
    letterSpacing: 6,
    paddingVertical: Platform.OS === 'web' ? 4 : 2,
  },
  errorText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.error, marginTop: 6 },
  cta: { marginTop: 12 },
  changeNumberBtn: {
    alignSelf: 'center',
    marginTop: 14,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  changeNumberText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontFamily: Fonts.sansMedium, fontSize: 11, color: Colors.textLight, letterSpacing: 0.5, textTransform: 'uppercase' },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.white,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 44,
  },
  googleBtnDisabled: { opacity: 0.5 },
  googleText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: Colors.textDark },
  footnote: { fontFamily: Fonts.sansRegular, fontSize: 11, color: Colors.textLight, textAlign: 'center', marginTop: 14, lineHeight: 16 },
  // Invisible reCAPTCHA anchor — must be in the DOM before sendPhoneOtp fires.
  recaptchaContainer: {
    position: 'absolute',
    width: 0,
    height: 0,
  },
});
