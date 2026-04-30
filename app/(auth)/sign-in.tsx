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
import { useProfileStore } from '../../store/useProfileStore';
import { isAdminEmail } from '../../lib/admin';
import { Fonts } from '../../constants/theme';
import GradientButton from '../../components/ui/GradientButton';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import { Colors } from '../../constants/theme';

// ─── Animated Field ───────────────────────────────────────────────────────────
// Floating-label TextInput. Label lifts and colours to brand purple on focus.

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
      color: interpolateColor(
        focusAnim.value,
        [0, 1],
        ['#6b7280', Colors.primary],
      ),
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
  container: {
    width: '100%',
    marginBottom: 24,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingBottom: 10,
  },
  icon: {
    marginRight: 12,
    marginBottom: 2,
  },
  inputWrap: {
    flex: 1,
    position: 'relative',
    justifyContent: 'flex-end',
  },
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

// ─── Spinner (kept, but now brand purple) ─────────────────────────────────────
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
function validate(email: string, password: string) {
  const errors: { email?: string; password?: string } = {};
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email.trim()) errors.email = 'Email is required';
  else if (!emailRegex.test(email.trim())) errors.email = 'Enter a valid email address';
  if (!password) errors.password = 'Password is required';
  return errors;
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn, onGoogleCredential } = useAuthStore();
  const { signIn: signInWithGoogle, ready: googleReady } = useGoogleSignIn();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  // Shake animation when validation fails
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

  const routeAfterSignIn = () => {
    // Admin accounts skip onboarding and phone-verify — they go straight
    // into the management dashboard. Check by email (Firebase custom claim
    // `admin: true` is the preferred long-term signal, but the email
    // allow-list in lib/admin.ts doubles as a bootstrap).
    const currentEmail = useAuthStore.getState().user?.email;
    if (isAdminEmail(currentEmail)) {
      router.replace('/admin');
      return;
    }
    const { onboardingComplete, phone } = useProfileStore.getState();
    if (!onboardingComplete) router.replace('/(auth)/onboarding');
    else if (!phone) router.replace('/(auth)/phone');
    else router.replace('/(tabs)');
  };

  const handleSubmit = async () => {
    const validationErrors = validate(email, password);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      triggerShake();
      return;
    }
    setErrors({});
    setApiError('');
    setLoading(true);
    try {
      await signIn(email.trim(), password.trim());
      routeAfterSignIn();
    } catch (e: any) {
      const code = e?.code ?? '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setApiError('Incorrect email or password. Please try again.');
      } else if (code === 'auth/too-many-requests') {
        setApiError('Too many attempts. Please wait a moment and try again.');
      } else if (code === 'auth/network-request-failed') {
        setApiError('No internet connection. Please try again.');
      } else {
        setApiError(e?.message ?? 'Sign in failed. Please try again.');
      }
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  // Web: signInWithPopup must run in the same sync task as the user gesture —
  // the hook handles that. Native: Expo's AuthSession opens a system browser
  // and returns an ID token we exchange via Firebase signInWithCredential.
  const handleGoogleSignIn = () => {
    setGoogleLoading(true);
    setApiError('');
    signInWithGoogle()
      .then(async (credential) => {
        const destination = await onGoogleCredential(credential);
        if (isAdminEmail(credential.user.email)) {
          router.replace('/admin');
          return;
        }
        if (destination === 'tabs') router.replace('/(tabs)');
        else if (destination === 'phone') router.replace('/(auth)/phone');
        else router.replace('/(auth)/onboarding');
      })
      .catch((e: any) => {
        const code = e?.code ?? '';
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
          setApiError('Sign-in window closed before completing. Please try again.');
        } else if (code === 'auth/unauthorized-domain') {
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
          {/* ── Top bar: back button ── */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={22} color="#6b7280" />
          </TouchableOpacity>

          {/* ── Title section ── */}
          <View style={styles.titleBlock}>
            <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
            <Text style={styles.titleText}>Welcome back</Text>
            <Text style={styles.subtitleText}>
              Sign in to continue your journey.
            </Text>
          </View>

          {/* ── Google CTA ── */}
          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGoogleSignIn}
            disabled={googleLoading || !googleReady}
            activeOpacity={0.85}
          >
            <Text style={styles.googleG}>G</Text>
            <Text style={styles.googleText}>
              {googleLoading ? 'Signing in…' : 'Continue with Google'}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or sign in with email</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Animated form ── */}
          <Animated.View style={[styles.form, formAnimStyle]}>
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
              placeholder="Your password"
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
            {errors.password ? <Text style={[styles.errorText, { marginTop: -16 }]}>{errors.password}</Text> : null}

            <TouchableOpacity
              onPress={() => router.push('/(auth)/forgot-password')}
              activeOpacity={0.6}
              style={styles.forgotBtn}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

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
                title="Sign in"
                onPress={handleSubmit}
                style={styles.cta}
              />
            )}
          </Animated.View>

          <Link href="/(auth)/sign-up" asChild>
            <TouchableOpacity style={styles.signUpLink} activeOpacity={0.6}>
              <Text style={styles.signUpText}>
                Don't have an account?{' '}
                <Text style={styles.signUpTextBold}>Create one</Text>
              </Text>
            </TouchableOpacity>
          </Link>

          <Text style={styles.footer}>
            Protected under India's DPDP Act 2023.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgLight },
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
    marginTop: 12,
    marginBottom: 28,
  },
  logoImage: { width: 56, height: 56, marginBottom: 12 },
  titleText: {
    fontFamily: Fonts.serif,
    fontSize: 28,
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
    marginBottom: 24,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E1EE' },
  dividerText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    color: '#9ca3af',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  form: { width: '100%', marginBottom: 18 },
  forgotBtn: { alignSelf: 'flex-end', marginTop: -6, marginBottom: 10 },
  forgotText: {
    fontFamily: Fonts.sansBold,
    fontSize: 12.5,
    color: Colors.primary,
  },
  errorText: {
    fontFamily: Fonts.sansMedium,
    color: '#ef4444',
    fontSize: 12,
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

  signUpLink: { alignItems: 'center', paddingVertical: 14 },
  signUpText: { fontFamily: Fonts.sansRegular, fontSize: 14, color: '#6b7280' },
  signUpTextBold: { fontFamily: Fonts.sansBold, color: Colors.primary },

  footer: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 14,
  },
});
