import { useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore } from '../../store/useProfileStore';
import {
  saveUserProfile,
  sendPhoneOtp,
  verifyPhoneOtp,
  resetPhoneRecaptcha,
  removePhoneFromAccount,
  PHONE_OTP_CONTAINER_ID,
  PHONE_OTP_UNSUPPORTED,
  type PhoneOtpHandle,
} from '../../services/firebase';
import { confirmAction, infoAlert } from '../../lib/cross-platform-alerts';
import { isAdminEmail } from '../../lib/admin';
import SuccessCheck from '../../components/ui/SuccessCheck';
import { ScreenHeader } from '../../components/settings/ScreenHeader';
import { Card, Divider, SettingsRow } from '../../components/settings/SettingsPrimitives';
import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';

function validateIndianMobile(digits: string): string | null {
  const clean = digits.replace(/\D/g, '');
  if (clean.length === 0) return 'Please enter your mobile number';
  if (clean.length !== 10) return 'Mobile number must be 10 digits';
  if (!/^[6-9]/.test(clean)) return 'Please enter a valid Indian mobile number';
  return null;
}

function friendlyOtpError(e: any): string {
  const code = e?.code ?? '';
  switch (code) {
    case 'auth/invalid-phone-number': return 'That phone number format is invalid.';
    case 'auth/too-many-requests': return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/invalid-verification-code': return 'That code is incorrect. Please check and try again.';
    case 'auth/code-expired': return 'Code expired. Tap resend to get a new one.';
    case 'auth/credential-already-in-use':
    case 'auth/account-exists-with-different-credential':
      return 'This number is already linked to another MaaMitra account.';
    case 'auth/captcha-check-failed': return 'Security check failed. Please refresh the page and try again.';
    case 'auth/quota-exceeded': return 'SMS quota reached. Please try again later.';
    case 'auth/missing-phone-number': return 'Please enter your phone number.';
    default: return `${code ? code + ': ' : ''}${e?.message ?? 'Something went wrong.'}`;
  }
}

type ViewMode = 'overview' | 'change-phone';

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const phone = useProfileStore((st) => st.phone);
  const phoneVerified = useProfileStore((st) => st.phoneVerified);

  const [view, setView] = useState<ViewMode>('overview');

  const goBack = () => {
    if (view === 'change-phone') setView('overview');
    else router.back();
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScreenHeaderInline title={view === 'change-phone' ? (phone ? 'Change Mobile Number' : 'Add Mobile Number') : 'Account'} onBack={goBack} />
      {view === 'overview' ? (
        <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}>
          <Card>
            <SettingsRow icon="mail-outline" label="Email" value={user?.email || '—'} />
            <Divider />
            <SettingsRow
              icon="call-outline"
              label={phoneVerified ? 'Mobile (verified)' : 'Mobile'}
              value={phone || 'Not added'}
              onPress={() => setView('change-phone')}
            />
          </Card>
          <Text style={s.footnote}>
            Email is the login on file and can't be changed from inside the app. Contact support to change it.
          </Text>
        </ScrollView>
      ) : (
        <ChangePhoneView onDone={() => setView('overview')} insetsBottom={insets.bottom} />
      )}
    </View>
  );
}

// Small header that lets the parent control the back action so the
// change-phone sub-view can pop back to the overview without leaving the
// route stack.
function ScreenHeaderInline({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={hh.header}>
      <TouchableOpacity onPress={onBack} style={hh.btn} accessibilityRole="button" accessibilityLabel="Back">
        <Ionicons name="arrow-back" size={20} color={Colors.textLight} />
      </TouchableOpacity>
      <Text style={hh.title} numberOfLines={1}>{title}</Text>
      <View style={hh.btn} />
    </View>
  );
}

function ChangePhoneView({ onDone, insetsBottom }: { onDone: () => void; insetsBottom: number }) {
  const { user } = useAuthStore();
  const currentPhone = useProfileStore((st) => st.phone);
  const setPhone = useProfileStore((st) => st.setPhone);
  const setPhoneVerified = useProfileStore((st) => st.setPhoneVerified);

  const [step, setStep] = useState<'enter-number' | 'enter-code'>('enter-number');
  const [digits, setDigits] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  const confirmationRef = useRef<PhoneOtpHandle | null>(null);
  const e164 = `+91${digits.replace(/\D/g, '')}`;
  const canRemove = isAdminEmail(user?.email);

  const handleSendOtp = async () => {
    const v = validateIndianMobile(digits);
    if (v) { setError(v); return; }
    if (!user?.uid) { setError('You are not signed in.'); return; }
    if (`+91${digits}` === currentPhone) {
      setError('This is already your current mobile number.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const handle = await sendPhoneOtp(e164);
      confirmationRef.current = handle;
      setStep('enter-code');
    } catch (e: any) {
      if (e?.code === PHONE_OTP_UNSUPPORTED) {
        setError('Phone OTP is not yet enabled on this device. Please use the web app or an Android device for now.');
      } else {
        setError(friendlyOtpError(e));
        resetPhoneRecaptcha();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    const clean = code.replace(/\D/g, '');
    if (clean.length !== 6) { setError('Enter the 6-digit code from the SMS.'); return; }
    if (!confirmationRef.current) {
      setError('Verification expired. Please request a new code.');
      setStep('enter-number');
      return;
    }
    if (!user?.uid) return;
    setError('');
    setBusy(true);
    try {
      await verifyPhoneOtp(confirmationRef.current, clean);
      setPhone(e164);
      setPhoneVerified(true);
      await saveUserProfile(user.uid, { phone: e164, phoneVerified: true });
      setSuccess(true);
      setTimeout(() => onDone(), 1200);
    } catch (e: any) {
      setError(friendlyOtpError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleResend = () => {
    confirmationRef.current = null;
    resetPhoneRecaptcha();
    setCode('');
    setError('');
    setStep('enter-number');
  };

  const handleRemove = async () => {
    if (!user?.uid) return;
    const ok = await confirmAction(
      'Remove mobile number?',
      `This will unlink ${currentPhone} from your account. You can add a new one any time. Continue?`,
      { confirmLabel: 'Remove' },
    );
    if (!ok) return;
    setError('');
    setBusy(true);
    try {
      await removePhoneFromAccount(user.uid);
      setPhone('');
      setPhoneVerified(false);
      infoAlert('Number removed', 'Your mobile number has been removed from your account.');
      onDone();
    } catch (e: any) {
      setError(e?.message ?? 'Could not remove the number. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const isStep1 = step === 'enter-number';

  return (
    <ScrollView
      contentContainerStyle={[s.content, { paddingBottom: insetsBottom + 32 }]}
      keyboardShouldPersistTaps="handled"
    >
      {success ? (
        <View style={cp.successCard}>
          <SuccessCheck size={80} style={cp.successIcon} />
          <Text style={cp.successTitle}>Mobile verified</Text>
          <Text style={cp.successSub}>Your new number has been saved.</Text>
        </View>
      ) : (
        <>
          {currentPhone ? (
            <View style={cp.currentCard}>
              <View style={{ flex: 1 }}>
                <Text style={cp.currentLabel}>Current number</Text>
                <Text style={cp.currentValue}>{currentPhone}</Text>
              </View>
              {canRemove ? (
                <TouchableOpacity
                  onPress={handleRemove}
                  disabled={busy}
                  style={cp.removeBtn}
                  activeOpacity={0.75}
                >
                  <Ionicons name="trash-outline" size={14} color="#b91c1c" />
                  <Text style={cp.removeBtnText}>Remove</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          <Text style={s.editSectionTitle}>
            {isStep1 ? 'New mobile number' : 'Enter the code we sent'}
          </Text>
          <Text style={cp.hint}>
            {isStep1
              ? "We'll send a one-time code to verify the new number. It stays private."
              : `A 6-digit code was sent to ${e164}. It may take a few seconds.`}
          </Text>

          {isStep1 ? (
            <View style={[cp.inputRow, error ? cp.inputRowError : null]}>
              <View style={cp.countryBox}>
                <Text style={cp.flag}>🇮🇳</Text>
                <Text style={cp.countryCode}>+91</Text>
              </View>
              <TextInput
                value={digits}
                onChangeText={(t) => { setDigits(t.replace(/\D/g, '').slice(0, 10)); setError(''); }}
                placeholder="98765 43210"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
                maxLength={10}
                style={cp.input}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSendOtp}
              />
            </View>
          ) : (
            <View style={[cp.codeRow, error ? cp.inputRowError : null]}>
              <TextInput
                value={code}
                onChangeText={(t) => { setCode(t.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                placeholder="• • • • • •"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                maxLength={6}
                style={cp.codeInput}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleVerifyOtp}
              />
            </View>
          )}

          {error ? <Text style={cp.errorText}>{error}</Text> : null}

          <TouchableOpacity
            onPress={isStep1 ? handleSendOtp : handleVerifyOtp}
            disabled={busy || (isStep1 ? digits.length < 10 : code.length < 6)}
            activeOpacity={0.85}
            style={{ marginTop: 20 }}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[cp.primaryBtn, (busy || (isStep1 ? digits.length < 10 : code.length < 6)) && cp.primaryBtnDisabled]}
            >
              <Text style={cp.primaryBtnText}>
                {busy ? (isStep1 ? 'Sending…' : 'Verifying…') : (isStep1 ? 'Send OTP' : 'Verify & Save')}
              </Text>
              {!busy && <Ionicons name="arrow-forward" size={16} color={Colors.white} style={{ marginLeft: 6 }} />}
            </LinearGradient>
          </TouchableOpacity>

          {!isStep1 && (
            <TouchableOpacity onPress={handleResend} activeOpacity={0.7} style={{ marginTop: 14, alignItems: 'center' }}>
              <Text style={cp.resendText}>Didn't get the code? Resend / change number</Text>
            </TouchableOpacity>
          )}

          <Text style={cp.legal}>
            By continuing you agree to receive transactional SMS on this number. Standard carrier rates may apply.
          </Text>
        </>
      )}

      {/* Firebase Phone Auth needs this anchor on web. */}
      <View nativeID={PHONE_OTP_CONTAINER_ID} style={cp.recaptcha} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl },
  editSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textLight,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  footnote: {
    fontSize: 12,
    fontFamily: Fonts.sansRegular,
    color: Colors.textMuted,
    lineHeight: 18,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
});

const hh = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  title: {
    color: Colors.textDark,
    fontSize: 18,
    fontFamily: Fonts.sansBold,
    letterSpacing: -0.2,
  },
  btn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});

const cp = StyleSheet.create({
  currentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.bgTint,
    borderRadius: Radius.sm,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EDE9F6',
    marginBottom: Spacing.xl,
  },
  currentLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 2 },
  currentValue: { fontSize: 16, fontWeight: '600', color: '#111827' },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.xs,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  removeBtnText: { fontSize: 12, fontWeight: '700', color: '#b91c1c' },
  hint: { fontSize: 13, color: Colors.textLight, lineHeight: 18, marginBottom: Spacing.lg },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  inputRowError: { borderColor: Colors.error },
  countryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    gap: 6,
  },
  flag: { fontSize: 18 },
  countryCode: { fontSize: 15, fontWeight: '600', color: '#111827' },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 10 : 12,
    fontSize: 17,
    color: '#111827',
    letterSpacing: 0.5,
  },
  codeRow: {
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  codeInput: {
    textAlign: 'center',
    paddingVertical: Platform.OS === 'web' ? 14 : 16,
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: 8,
  },
  errorText: { fontSize: 13, color: Colors.error, marginTop: 10, marginLeft: Spacing.xs },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Radius.sm,
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white, letterSpacing: 0.2 },
  resendText: {
    fontSize: 13,
    color: '#6d1a7a',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  legal: {
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 16,
    marginTop: Spacing.xl,
    textAlign: 'center',
  },
  recaptcha: { position: 'absolute', bottom: 0, left: 0, width: 1, height: 1, opacity: 0 },
  successCard: { alignItems: 'center', paddingTop: 48 },
  successIcon: { marginBottom: 12 },
  successTitle: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 4 },
  successSub: { fontSize: 14, color: Colors.textLight },
});
