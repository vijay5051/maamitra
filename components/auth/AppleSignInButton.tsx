import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, Colors } from '../../constants/theme';

interface Props {
  onPress: () => void;
  disabled?: boolean;
}

/**
 * STUB component. Task 4 will wire it to the actual Apple Sign-In flow
 * (via expo-apple-authentication on iOS, OAuthProvider('apple.com') on web).
 * Until then this just renders the button — wiring happens in Task 4 +
 * Task 10's welcome screen.
 */
export default function AppleSignInButton({ onPress, disabled }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.btn, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel="Continue with Apple"
    >
      <Ionicons name="logo-apple" size={18} color={Colors.white} />
      <Text style={styles.text}>Continue with Apple</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: '#000', // Apple HIG requirement — SIWA button MUST be black with white text (or inverse white variant). Brand-compliance exception to design-tokens-only rule.
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
    minHeight: 44,
  },
  disabled: { opacity: 0.6 },
  text: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: Colors.white },
});
