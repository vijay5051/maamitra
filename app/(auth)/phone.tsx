import React, { useState } from 'react';
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
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore } from '../../store/useProfileStore';
import { saveUserProfile } from '../../services/firebase';
import { Fonts } from '../../constants/theme';

// Indian mobile numbers: 10 digits starting with 6-9.
// Stored as "+91XXXXXXXXXX" for E.164 compatibility.
function validateIndianMobile(digits: string): string | null {
  const clean = digits.replace(/\D/g, '');
  if (clean.length === 0) return 'Please enter your mobile number';
  if (clean.length !== 10) return 'Mobile number must be 10 digits';
  if (!/^[6-9]/.test(clean)) return 'Please enter a valid Indian mobile number';
  return null;
}

export default function PhoneScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const setPhone = useProfileStore((s) => s.setPhone);

  const [digits, setDigits] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
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
    setSaving(true);
    const clean = digits.replace(/\D/g, '');
    const e164 = `+91${clean}`;
    try {
      setPhone(e164);
      await saveUserProfile(user.uid, { phone: e164 });
      // If onboarding isn't complete yet, go there; otherwise straight to tabs
      const onboardingComplete = useProfileStore.getState().onboardingComplete;
      router.replace(onboardingComplete ? '/(tabs)/' : '/(auth)/onboarding');
    } catch (e: any) {
      setError(e?.message ?? 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangeDigits = (text: string) => {
    // Strip non-digits, cap at 10
    const clean = text.replace(/\D/g, '').slice(0, 10);
    setDigits(clean);
    if (error) setError('');
  };

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
          <View style={styles.iconCircle}>
            <Ionicons name="phone-portrait-outline" size={32} color="#ffffff" />
          </View>

          <Text style={styles.heading}>Add your mobile number</Text>
          <Text style={styles.subheading}>
            We'll use this to keep your account secure and send important updates about your baby's care. Your number stays private.
          </Text>

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
              onSubmitEditing={handleContinue}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            onPress={handleContinue}
            disabled={saving || digits.length < 10}
            activeOpacity={0.85}
            style={{ marginTop: 24 }}
          >
            <LinearGradient
              colors={['#ec4899', '#8b5cf6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.continueBtn,
                (saving || digits.length < 10) && styles.continueBtnDisabled,
              ]}
            >
              <Text style={styles.continueText}>
                {saving ? 'Saving…' : 'Continue'}
              </Text>
              {!saving && (
                <Ionicons name="arrow-forward" size={18} color="#ffffff" style={{ marginLeft: 6 }} />
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.privacyHint}>
            By continuing you agree to receive transactional messages on this number. Standard carrier rates may apply.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
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
  privacyHint: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 17,
    marginTop: 24,
  },
});
