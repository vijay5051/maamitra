import React, { useRef, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/useAuthStore';
import { Fonts } from '../../constants/theme';

// ─── Password strength ─────────────────────────────────────────────────────────

function getPasswordStrength(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length > 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  return Math.min(score, 4);
}

const STRENGTH_COLORS = ['#EDE9F6', '#E8487A', '#F59E0B', '#38BDF8', '#34D399'];
const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];

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
  inputRef?: React.RefObject<TextInput>;
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
  inputRef,
}: AnimatedFieldProps) {
  const [focused, setFocused] = useState(false);
  const focusAnim = useSharedValue(0);

  const handleFocus = () => {
    setFocused(true);
    focusAnim.value = withTiming(1, { duration: 200 });
  };
  const handleBlur = () => {
    setFocused(false);
    if (!value) focusAnim.value = withTiming(0, { duration: 200 });
  };

  // When value is pre-filled, keep label floated
  const isFloated = focused || !!value;

  // Animate label
  const labelAnimStyle = useAnimatedStyle(() => {
    const progress = value ? 1 : focusAnim.value;
    return {
      transform: [{ translateY: interpolate(progress, [0, 1], [0, -22]) }],
      fontSize: interpolate(progress, [0, 1], [15, 12]),
      color: interpolateColor(
        focusAnim.value,
        [0, 1],
        ['#6B7280', '#E8487A']
      ),
    };
  });

  // Animate underline color
  const underlineAnimStyle = useAnimatedStyle(() => ({
    borderBottomColor: hasError
      ? '#ef4444'
      : interpolateColor(focusAnim.value, [0, 1], ['#EDE9F6', '#E8487A']),
    borderBottomWidth: 1.5,
  }));

  const iconColor = hasError ? '#ef4444' : focused ? '#E8487A' : '#C084FC';

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
            ref={inputRef}
            style={fieldStyles.textInput}
            value={value}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={isFloated ? placeholder : undefined}
            placeholderTextColor="#C4B5D4"
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
    marginBottom: 28,
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

// ─── Password Strength Bar ────────────────────────────────────────────────────

function PasswordStrengthBar({ password }: { password: string }) {
  const strength = getPasswordStrength(password);

  const seg1 = useSharedValue(0);
  const seg2 = useSharedValue(0);
  const seg3 = useSharedValue(0);
  const seg4 = useSharedValue(0);

  React.useEffect(() => {
    seg1.value = withTiming(strength >= 1 ? 1 : 0, { duration: 250 });
    seg2.value = withTiming(strength >= 2 ? 1 : 0, { duration: 300 });
    seg3.value = withTiming(strength >= 3 ? 1 : 0, { duration: 350 });
    seg4.value = withTiming(strength >= 4 ? 1 : 0, { duration: 400 });
  }, [strength]);

  const segStyle = (anim: ReturnType<typeof useSharedValue<number>>, activeColor: string) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => ({
      backgroundColor: interpolateColor(anim.value, [0, 1], ['#EDE9F6', activeColor]),
    }));

  const s1Style = segStyle(seg1, STRENGTH_COLORS[1]);
  const s2Style = segStyle(seg2, STRENGTH_COLORS[2]);
  const s3Style = segStyle(seg3, STRENGTH_COLORS[3]);
  const s4Style = segStyle(seg4, STRENGTH_COLORS[4]);

  if (!password) return null;

  const labelColor = strength > 0 ? STRENGTH_COLORS[strength] : '#EDE9F6';

  return (
    <View style={strStyles.container}>
      <View style={strStyles.bars}>
        <Animated.View style={[strStyles.segment, s1Style]} />
        <Animated.View style={[strStyles.segment, s2Style]} />
        <Animated.View style={[strStyles.segment, s3Style]} />
        <Animated.View style={[strStyles.segment, s4Style]} />
      </View>
      {strength > 0 && (
        <Text style={[strStyles.label, { color: labelColor }]}>
          {STRENGTH_LABELS[strength]}
        </Text>
      )}
    </View>
  );
}

const strStyles = StyleSheet.create({
  container: { marginTop: 8, gap: 4 },
  bars: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 3, borderRadius: 2 },
  label: { fontFamily: Fonts.sansMedium, fontSize: 11, marginTop: 2 },
});

// ─── Spinning Loader ──────────────────────────────────────────────────────────

function SpinnerIcon() {
  const rotation = useSharedValue(0);

  React.useEffect(() => {
    rotation.value = withRepeat(
      withTiming(1, { duration: 600 }),
      -1,
      false
    );
  }, []);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 360}deg` }],
  }));

  return (
    <Animated.View style={spinStyle}>
      <Ionicons name="reload-outline" size={22} color="#ffffff" />
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
  const { signUp, signInWithGoogle } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  // Shake animation for the form
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
      withTiming(0, { duration: 70 })
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

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setApiError('');
    try {
      const destination = await signInWithGoogle();
      if (destination === 'tabs') router.replace('/(tabs)/');
      else if (destination === 'onboarding') router.replace('/(auth)/onboarding');
      else {
        setApiError('Sign-in window was blocked or closed. Allow popups for this site and try again.');
      }
    } catch (e: any) {
      const code = e?.code ?? '';
      if (code === 'auth/popup-blocked') {
        setApiError('Your browser blocked the Google sign-in popup. Allow popups for this site and try again.');
      } else if (code === 'auth/unauthorized-domain') {
        setApiError('This domain is not authorized for Google sign-in. Add it in Firebase Console → Authentication → Settings → Authorized domains.');
      } else if (code === 'auth/network-request-failed') {
        setApiError('No internet connection. Please try again.');
      } else {
        setApiError(`${code ? code + ': ' : ''}${e?.message ?? 'Google sign-in failed. Please try again.'}`);
      }
      triggerShake();
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' || Platform.OS === 'web' ? 'padding' : 'height'}
      >
        {/* ── Dark Hero Section ── */}
        <LinearGradient
          colors={['#1C1033', '#3b1060', '#6d1a7a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 12 }]}
        >
          <View style={styles.glowTopRight} pointerEvents="none" />
          <View style={styles.glowBottomLeft} pointerEvents="none" />

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={styles.backBtnInner}>
              <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.85)" />
            </View>
          </TouchableOpacity>

          <View style={styles.heroContent}>
            <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
            <Text style={styles.wordmark}>MaaMitra</Text>
            <Text style={styles.heroSubtitle}>YOUR MOTHERHOOD COMPANION</Text>
          </View>
        </LinearGradient>

        {/* ── Form Bottom Sheet ── */}
        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.handle} />

          <Text style={styles.sheetTitle}>Create your account</Text>
          <Text style={styles.sheetSubtitle}>Join 50,000+ mothers on their journey</Text>

          {/* Google button */}
          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGoogleSignIn}
            disabled={googleLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.googleG}>G</Text>
            <Text style={styles.googleText}>
              {googleLoading ? 'Signing in…' : 'Continue with Google'}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or sign up with email</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Animated form container */}
          <Animated.View style={[styles.form, formAnimStyle]}>
            {/* Full Name */}
            <AnimatedField
              label="Full Name"
              value={name}
              onChangeText={(t) => { setName(t); setErrors((e) => ({ ...e, name: undefined })); }}
              iconName="person-outline"
              placeholder="Priya Sharma"
              autoCapitalize="words"
              hasError={!!errors.name}
            />
            {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}

            {/* Email */}
            <AnimatedField
              label="Email Address"
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

            {/* Password */}
            <AnimatedField
              label="Password"
              value={password}
              onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: undefined })); }}
              iconName="lock-closed-outline"
              placeholder="Create a strong password"
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
                    color="#C4B5D4"
                  />
                </TouchableOpacity>
              }
            />
            <PasswordStrengthBar password={password} />
            {errors.password ? <Text style={[styles.errorText, { marginTop: 4 }]}>{errors.password}</Text> : null}

            {apiError ? (
              <View style={styles.apiErrorBox}>
                <Text style={styles.apiErrorText}>{apiError}</Text>
              </View>
            ) : null}

            {/* CTA Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading || googleLoading}
              activeOpacity={0.88}
              style={styles.ctaWrapper}
            >
              <LinearGradient
                colors={['#E8487A', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaGradient}
              >
                {loading ? (
                  <SpinnerIcon />
                ) : (
                  <Text style={styles.ctaText}>Create My Account →</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Trust strip */}
          <View style={styles.trustStrip}>
            <View style={styles.trustAvatars}>
              {['P', 'R', 'S', 'A'].map((letter, i) => (
                <View key={i} style={[styles.trustAvatar, { marginLeft: i === 0 ? 0 : -7 }]}>
                  <Text style={styles.trustAvatarText}>{letter}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.trustText}>
              <Text style={styles.trustHighlight}>50,000+</Text> mothers trust MaaMitra
            </Text>
          </View>

          {/* Sign in link */}
          <Link href="/(auth)/sign-in" asChild>
            <TouchableOpacity style={styles.signInLink}>
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
  root: { flex: 1, backgroundColor: '#1C1033' },
  flex: { flex: 1 },

  // Hero
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 220,
  },
  glowTopRight: {
    position: 'absolute',
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(232,72,122,0.28)',
    top: -70, right: -50,
  },
  glowBottomLeft: {
    position: 'absolute',
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(124,58,237,0.22)',
    bottom: -50, left: -30,
  },
  backButton: { marginBottom: 16 },
  backBtnInner: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroContent: { alignItems: 'center' },
  logoImage: { width: 56, height: 56, marginBottom: 8 },
  wordmark: {
    fontFamily: Fonts.serif,
    fontSize: 32, color: '#ffffff', letterSpacing: -0.5,
    textShadowColor: 'rgba(232,72,122,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  heroSubtitle: {
    fontFamily: Fonts.sansMedium, fontSize: 10,
    color: 'rgba(255,255,255,0.5)', letterSpacing: 2, marginTop: 4,
  },

  // Form sheet
  sheetScroll: {
    flex: 1, backgroundColor: '#FFF8FC',
    borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: -24,
  },
  sheetContent: {
    paddingHorizontal: 24, paddingTop: 16, alignItems: 'center',
  },
  handle: {
    width: 36, height: 4, backgroundColor: '#EDE9F6',
    borderRadius: 2, marginBottom: 24,
  },
  sheetTitle: {
    fontFamily: Fonts.sansBold, fontSize: 22, color: '#1C1033',
    alignSelf: 'flex-start', marginBottom: 4,
  },
  sheetSubtitle: {
    fontFamily: Fonts.sansRegular, fontSize: 14, color: '#9CA3AF',
    alignSelf: 'flex-start', marginBottom: 22,
  },

  // Google button
  googleBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 10, backgroundColor: '#ffffff',
    borderRadius: 16, paddingVertical: 14, paddingHorizontal: 20,
    borderWidth: 1.5, borderColor: '#EDE9F6', marginBottom: 18,
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
    boxShadow: '0px 2px 10px rgba(124, 58, 237, 0.07)',
  },
  googleG: { fontSize: 18, fontFamily: Fonts.sansBold, color: '#4285F4' },
  googleText: { fontFamily: Fonts.sansSemiBold, fontSize: 15, color: '#1C1033' },

  // Divider
  divider: {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    gap: 12, marginBottom: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#EDE9F6' },
  dividerText: {
    fontFamily: Fonts.sansMedium, fontSize: 11,
    color: '#C4B5D4', letterSpacing: 0.3,
  },

  // Form
  form: { width: '100%', marginBottom: 20 },

  errorText: {
    fontFamily: Fonts.sansRegular,
    color: '#ef4444', fontSize: 12,
    marginTop: -20, marginBottom: 8, marginLeft: 30,
  },
  apiErrorBox: {
    backgroundColor: '#fff5f5', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)',
    marginBottom: 14,
  },
  apiErrorText: {
    fontFamily: Fonts.sansMedium, color: '#ef4444',
    fontSize: 13, textAlign: 'center',
  },

  // CTA button
  ctaWrapper: {
    borderRadius: 18, overflow: 'hidden',
    marginTop: 8, width: '100%',
    shadowColor: '#E8487A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
    boxShadow: '0px 4px 12px rgba(232, 72, 122, 0.30)',
  },
  ctaGradient: {
    paddingVertical: 17, alignItems: 'center', justifyContent: 'center',
    minHeight: 56,
  },
  ctaText: {
    fontFamily: Fonts.sansBold, color: '#ffffff', fontSize: 16,
  },

  // Trust strip
  trustStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(232,72,122,0.05)',
    borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(232,72,122,0.1)',
    paddingHorizontal: 16, paddingVertical: 10,
    width: '100%', marginBottom: 16,
  },
  trustAvatars: { flexDirection: 'row' },
  trustAvatar: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#E8487A',
    borderWidth: 2, borderColor: '#FFF8FC',
    alignItems: 'center', justifyContent: 'center',
  },
  trustAvatarText: { fontFamily: Fonts.sansBold, fontSize: 9, color: '#fff' },
  trustText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: '#6B7280' },
  trustHighlight: { fontFamily: Fonts.sansBold, color: '#E8487A' },

  // Sign in link
  signInLink: { marginBottom: 16, paddingVertical: 4 },
  signInText: { fontFamily: Fonts.sansRegular, fontSize: 14, color: '#9CA3AF' },
  signInTextBold: { fontFamily: Fonts.sansBold, color: '#E8487A' },

  footer: {
    fontFamily: Fonts.sansRegular, fontSize: 10,
    color: '#C4B5D4', textAlign: 'center', lineHeight: 16,
  },
});
