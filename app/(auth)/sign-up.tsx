import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  interpolate,
  interpolateColor,
} from 'react-native-reanimated';

const LOGO = require('../../assets/logo.png');
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/useAuthStore';
import { Fonts } from '../../constants/theme';
import GradientButton from '../../components/ui/GradientButton';
import {
  auth,
  signInWithPopup,
  signInWithRedirect,
  buildGoogleProvider,
} from '../../services/firebase';
import { Colors } from '../../constants/theme';

// ─── Password strength (tonal, not rainbow) ──────────────────────────────────
// Previously: red → orange → blue → green traffic-light colours competing
// with the rest of the UI. Now: brand purple at every strength, with the
// filled-segments count doing the signalling.
function getPasswordStrength(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length > 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  return Math.min(score, 4);
}
const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_FILL = Colors.primary;

// ─── Animated Field ───────────────────────────────────────────────────────────
interface AnimatedFieldProps {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  iconName: keyof typeof Ionicons.glyphMap;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'words' | 'sentences';
  autoCorrect?: boolean;
  returnKeyType?: 'next' | 'done';
  onSubmitEditing?: () => void;
  secureTextEntry?: boolean;
  rightElement?: React.ReactNode;
  hasError?: boolean;
}

function AnimatedField({
  label,
  value,
  onChangeText,
  iconName,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoCorrect = true,
  returnKeyType = 'next',
  onSubmitEditing,
  secureTextEntry,
  rightElement,
  hasError,
}: AnimatedFieldProps) {
  const [focused, setFocused] = useState(false);
  const focusAnim = useSharedValue(0);

  const handleFocus = () => {
    setFocused(true);
    focusAnim.value = withTiming(1, { duration: 180 });
  };
  const handleBlur = () => {
    setFocused(false);
    if (!value) focusAnim.value = withTiming(0, { duration: 180 });
  };

  const isFloated = focused || !!value;

  const labelAnimStyle = useAnimatedStyle(() => {
    const progress = value ? 1 : focusAnim.value;
    return {
      transform: [{ translateY: interpolate(progress, [0, 1], [0, -22]) }],
      fontSize: interpolate(progress, [0, 1], [15, 12]),
      color: interpolateColor(focusAnim.value, [0, 1], ['#6b7280', Colors.primary]),
    };
  });

  const underlineAnimStyle = useAnimatedStyle(() => ({
    borderBottomColor: hasError
      ? '#ef4444'
      : interpolateColor(focusAnim.value, [0, 1], ['#E5E1EE', Colors.primary]),
    borderBottomWidth: 1.5,
  }));

  const iconColor = hasError ? '#ef4444' : focused ? Colors.primary : '#9ca3af';

  return (
    <View style={fieldStyles.container}>
      <Animated.View style={[fieldStyles.inputRow, underlineAnimStyle]}>
        <Ionicons name={iconName} size={18} color={iconColor} style={fieldStyles.icon} />
        <View style={fieldStyles.inputWrap}>
          <Animated.Text
            style={[fieldStyles.floatLabel, labelAnimStyle]}
            pointerEvents="none"
          >
            {label}
          </Animated.Text>
          <TextInput
            style={fieldStyles.textInput}
            value={value}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={isFloated ? placeholder : undefined}
            placeholderTextColor="#c4b5d4"
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            autoCorrect={autoCorrect}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            secureTextEntry={secureTextEntry}
          />
        </View>
        {rightElement}
      </Animated.View>
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  container: { width: '100%', marginBottom: 24 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingBottom: 10,
  },
  icon: { marginRight: 12, marginBottom: 2 },
  inputWrap: { flex: 1, position: 'relative', justifyContent: 'flex-end' },
  floatLabel: {
    position: 'absolute',
    left: 0,
    bottom: 2,
    fontFamily: Fonts.sansRegular,
    pointerEvents: 'none',
  },
  textInput: {
    fontFamily: Fonts.sansRegular,
    fontSize: 15,
    color: '#1C1033',
    padding: 0,
    paddingTop: 4,
    height: 28,
  },
});

// ─── Password strength bar ────────────────────────────────────────────────────
function PasswordStrengthBar({ password }: { password: string }) {
  const strength = getPasswordStrength(password);

  const seg1 = useSharedValue(0);
  const seg2 = useSharedValue(0);
  const seg3 = useSharedValue(0);
  const seg4 = useSharedValue(0);

  React.useEffect(() => {
    seg1.value = withTiming(strength >= 1 ? 1 : 0, { duration: 220 });
    seg2.value = withTiming(strength >= 2 ? 1 : 0, { duration: 260 });
    seg3.value = withTiming(strength >= 3 ? 1 : 0, { duration: 300 });
    seg4.value = withTiming(strength >= 4 ? 1 : 0, { duration: 340 });
  }, [strength]);

  const segStyle = (anim: ReturnType<typeof useSharedValue<number>>) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => ({
      backgroundColor: interpolateColor(anim.value, [0, 1], ['#EDE9F6', STRENGTH_FILL]),
    }));

  const s1Style = segStyle(seg1);
  const s2Style = segStyle(seg2);
  const s3Style = segStyle(seg3);
  const s4Style = segStyle(seg4);

  if (!password) return null;

  return (
    <View style={strStyles.container}>
      <View style={strStyles.bars}>
        <Animated.View style={[strStyles.segment, s1Style]} />
        <Animated.View style={[strStyles.segment, s2Style]} />
        <Animated.View style={[strStyles.segment, s3Style]} />
        <Animated.View style={[strStyles.segment, s4Style]} />
      </View>
      {strength > 0 && (
        <Text style={strStyles.label}>{STRENGTH_LABELS[strength]}</Text>
      )}
    </View>
  );
}

const strStyles = StyleSheet.create({
  container: { marginTop: 6, marginBottom: 4, gap: 4 },
  bars: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 3, borderRadius: 2 },
  label: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    color: Colors.primary,
    marginTop: 2,
  },
});

// ─── Spinner ──────────────────────────────────────────────────────────────────
function SpinnerIcon() {
  const rotation = useSharedValue(0);
  React.useEffect(() => {
    rotation.value = withRepeat(withTiming(1, { duration: 600 }), -1, false);
  }, []);
  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 360}deg` }],
  }));
  return (
    <Animated.View style={spinStyle}>
      <Ionicons name="reload-outline" size={20} color={Colors.primary} />
    </Animated.View>
  );
}

// ─── Validation ───────────────────────────────────────────────────────────────
function validate(name: string, email: string, password: string) {
  const errors: { name?: string; email?: string; password?: string } = {};
  if (!name.trim()) errors.name = 'Full name is required';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email.trim()) errors.email = 'Email is required';
  else if (!emailRegex.test(email.trim())) errors.email = 'Enter a valid email address';
  if (!password) errors.password = 'Password is required';
  else if (password.length < 6) errors.password = 'Password must be at least 6 characters';
  return errors;
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SignUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp, onGoogleCredential } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const shakeX = useSharedValue(0);
  const formAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const triggerShake = () => {
    shakeX.value = withSequence(
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 60 }),
      withTiming(-4, { duration: 60 }),
      withTiming(4, { duration: 60 }),
      withTiming(0, { duration: 70 }),
    );
  };

  const handleSubmit = async () => {
    const validationErrors = validate(name, email, password);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      triggerShake();
      return;
    }
    setErrors({});
    setApiError('');
    setLoading(true);
    try {
      await signUp(email.trim(), password.trim(), name.trim());
      router.replace('/(auth)/verify-email');
    } catch (e: any) {
      const code = e?.code ?? '';
      if (code === 'auth/email-already-in-use') setApiError('This email is already registered. Try signing in instead.');
      else if (code === 'auth/invalid-email') setApiError('Please enter a valid email address.');
      else if (code === 'auth/weak-password') setApiError('Password must be at least 6 characters.');
      else if (code === 'auth/network-request-failed') setApiError('No internet connection. Please try again.');
      else setApiError(e?.message ?? 'Something went wrong. Please try again.');
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  // iOS Safari: signInWithPopup must run in the same sync task as the user
  // gesture. Keep this handler non-async.
  const handleGoogleSignIn = () => {
    if (!auth) {
      setApiError('Authentication is not configured.');
      return;
    }
    setGoogleLoading(true);
    setApiError('');
    const provider = buildGoogleProvider();

    signInWithPopup(auth, provider)
      .then(async (credential) => {
        const destination = await onGoogleCredential(credential);
        if (destination === 'tabs') router.replace('/(tabs)/');
        else if (destination === 'phone') router.replace('/(auth)/phone');
        else router.replace('/(auth)/onboarding');
      })
      .catch((e: any) => {
        const code = e?.code ?? '';
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
          setApiError('Sign-in window closed before completing. Please try again.');
          triggerShake();
          return;
        }
        if (code === 'auth/popup-blocked') {
          setApiError('Popup blocked — redirecting to Google…');
          signInWithRedirect(auth!, provider).catch((redirectErr: any) => {
            setApiError(redirectErr?.message ?? 'Redirect sign-in failed.');
            triggerShake();
          });
          return;
        }
        if (code === 'auth/unauthorized-domain') {
          setApiError('This domain is not authorized for Google sign-in.');
        } else if (code === 'auth/network-request-failed') {
          setApiError('No internet connection. Please try again.');
        } else {
          setApiError(e?.message ?? 'Google sign-in failed. Please try again.');
        }
        triggerShake();
      })
      .finally(() => setGoogleLoading(false));
  };

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' || Platform.OS === 'web' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={22} color="#6b7280" />
          </TouchableOpacity>

          <View style={styles.titleBlock}>
            <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
            <Text style={styles.titleText}>Create your account</Text>
            <Text style={styles.subtitleText}>
              Set up in under a minute. Cancel anytime.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGoogleSignIn}
            disabled={googleLoading}
            activeOpacity={0.85}
          >
            <Text style={styles.googleG}>G</Text>
            <Text style={styles.googleText}>
              {googleLoading ? 'Signing in…' : 'Continue with Google'}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or sign up with email</Text>
            <View style={styles.dividerLine} />
          </View>

          <Animated.View style={[styles.form, formAnimStyle]}>
            <AnimatedField
              label="Full name"
              value={name}
              onChangeText={(t) => { setName(t); setErrors((e) => ({ ...e, name: undefined })); }}
              iconName="person-outline"
              placeholder="Priya Sharma"
              autoCapitalize="words"
              hasError={!!errors.name}
            />
            {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}

            <AnimatedField
              label="Email address"
              value={email}
              onChangeText={(t) => { setEmail(t); setErrors((e) => ({ ...e, email: undefined })); }}
              iconName="mail-outline"
              placeholder="priya@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              hasError={!!errors.email}
            />
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

            <AnimatedField
              label="Password"
              value={password}
              onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: undefined })); }}
              iconName="lock-closed-outline"
              placeholder="At least 6 characters"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              secureTextEntry={!showPassword}
              hasError={!!errors.password}
              rightElement={
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ marginLeft: 8, marginBottom: 2 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={18}
                    color="#9ca3af"
                  />
                </TouchableOpacity>
              }
            />
            <PasswordStrengthBar password={password} />
            {errors.password ? <Text style={[styles.errorText, { marginTop: 4 }]}>{errors.password}</Text> : null}

            {apiError ? (
              <View style={styles.apiErrorBox}>
                <Ionicons name="alert-circle" size={16} color="#ef4444" style={{ marginRight: 8 }} />
                <Text style={styles.apiErrorText}>{apiError}</Text>
              </View>
            ) : null}

            {loading ? (
              <View style={styles.loadingBtn}>
                <SpinnerIcon />
              </View>
            ) : (
              <GradientButton
                title="Create my account"
                onPress={handleSubmit}
                style={styles.cta}
              />
            )}
          </Animated.View>

          <Link href="/(auth)/sign-in" asChild>
            <TouchableOpacity style={styles.signInLink} activeOpacity={0.6}>
              <Text style={styles.signInText}>
                Already have an account?{' '}
                <Text style={styles.signInTextBold}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </Link>

          <Text style={styles.footer}>
            Protected under India's DPDP Act 2023 · IAP & FOGSI guidelines
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAFB' },
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 22,
    alignItems: 'stretch',
  },

  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    marginBottom: 8,
  },

  titleBlock: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 26,
  },
  logoImage: { width: 56, height: 56, marginBottom: 12 },
  titleText: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    color: '#1C1033',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  subtitleText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },

  googleBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#E5E1EE',
    marginBottom: 20,
  },
  googleG: { fontSize: 16, fontFamily: Fonts.sansBold, color: '#4285F4' },
  googleText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: '#1C1033' },

  divider: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 22,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E1EE' },
  dividerText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    color: '#9ca3af',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  form: { width: '100%', marginBottom: 16 },
  errorText: {
    fontFamily: Fonts.sansMedium,
    color: '#ef4444',
    fontSize: 12,
    marginTop: -16,
    marginBottom: 8,
    marginLeft: 30,
  },
  apiErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 14,
  },
  apiErrorText: {
    flex: 1,
    fontFamily: Fonts.sansMedium,
    color: '#b91c1c',
    fontSize: 13,
  },

  cta: { marginTop: 6 },
  loadingBtn: {
    marginTop: 6,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F0FF',
  },

  signInLink: { alignItems: 'center', paddingVertical: 14 },
  signInText: { fontFamily: Fonts.sansRegular, fontSize: 14, color: '#6b7280' },
  signInTextBold: { fontFamily: Fonts.sansBold, color: Colors.primary },

  footer: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 16,
  },
});
