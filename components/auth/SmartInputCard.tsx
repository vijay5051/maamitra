import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import GradientButton from '../ui/GradientButton';
import GoogleGIcon from '../ui/GoogleGIcon';
import AppleSignInButton from './AppleSignInButton';
import { Colors, Fonts } from '../../constants/theme';

interface Props {
  /** Caller wires this to navigate the user to /(auth)/phone with the e164 param. */
  onSubmitPhone: (e164: string) => void;
  onPressGoogle: () => void;
  onPressApple: () => void;
  /** Whether to render the Apple button. Hide on Android, on web without Apple JS SDK, etc. */
  showApple: boolean;
  /** Disables the Continue button while the OTP send is in flight. */
  loading?: boolean;
  /** User-facing error from the parent (e.g. "couldn't send OTP, try again"). */
  error?: string;
}

export default function SmartInputCard({
  onSubmitPhone, onPressGoogle, onPressApple, showApple, loading, error,
}: Props) {
  const [digits, setDigits] = useState('');
  const clean = digits.replace(/\D/g, '').slice(0, 10);
  const valid = clean.length === 10 && /^[6-9]/.test(clean);

  const handleSubmit = () => {
    if (valid && !loading) onSubmitPhone(`+91${clean}`);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Let's get you in</Text>
      <Text style={styles.sub}>Just your number. We'll figure out the rest.</Text>

      <View style={styles.inputRow}>
        <Text style={styles.prefix}>🇮🇳 +91</Text>
        <TextInput
          value={clean}
          onChangeText={setDigits}
          placeholder="Mobile number"
          placeholderTextColor={Colors.textLight}
          keyboardType="phone-pad"
          maxLength={10}
          style={styles.input}
          accessibilityLabel="Indian mobile number"
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <GradientButton
        title={loading ? 'Sending OTP…' : 'Continue'}
        onPress={handleSubmit}
        style={styles.cta}
        disabled={!valid || loading}
      />

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>faster sign-in</Text>
        <View style={styles.dividerLine} />
      </View>

      <Pressable
        style={styles.googleBtn}
        onPress={onPressGoogle}
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
      >
        <GoogleGIcon size={18} />
        <Text style={styles.googleText}>Continue with Google</Text>
      </Pressable>

      {showApple && (
        <View style={{ marginTop: 8 }}>
          <AppleSignInButton onPress={onPressApple} />
        </View>
      )}

      <Text style={styles.footnote}>
        Returning user? Same screen — we'll detect your account.
      </Text>
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
    // '#F9F7FD' = brand-tinted input background (warmer than pure white, cooler than bgLight).
    // Not yet a design token — should become Colors.inputBg when the theme is next expanded.
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
  errorText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.error, marginTop: 6 },
  cta: { marginTop: 12 },
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
  googleText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: Colors.textDark },
  footnote: { fontFamily: Fonts.sansRegular, fontSize: 11, color: Colors.textLight, textAlign: 'center', marginTop: 14, lineHeight: 16 },
});
