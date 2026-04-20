import React, { useEffect } from 'react';
import { StyleSheet, View, Image, Text, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
  type SharedValue,
} from 'react-native-reanimated';
import { Fonts } from '../../constants/theme';

// ─── Animated Splash ─────────────────────────────────────────────────────────
// Shown on every app launch. No video, no Lottie file — pure Reanimated.
// ~1.8s total: black → gradient wipe → logo scale-in + orbiting sparkles →
// wordmark fade-in → hold → fade out to white.
// Zero extra bundle weight. Uses the existing assets/icon.png logo.

interface Props {
  onDone: () => void;
}

const LOGO_SIZE = 140;
// Sparkles orbit outside the logo bounding box. Slightly larger than half
// the logo so they look like they're circling around it, not clipping it.
const SPARKLE_RADIUS = 108;

export default function AnimatedSplash({ onDone }: Props) {
  // Shared values for the animation timeline
  const bgOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.82);
  const logoOpacity = useSharedValue(0);
  const wordmarkOpacity = useSharedValue(0);
  const wordmarkShift = useSharedValue(8);
  const sparklePhase = useSharedValue(0);
  const rootOpacity = useSharedValue(1);

  useEffect(() => {
    // 1) Gradient fades in (300ms)
    bgOpacity.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.quad) });

    // 2) Logo fades + scales in with gentle bounce (starts 150ms in, ~700ms total)
    logoOpacity.value = withDelay(
      150,
      withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }),
    );
    logoScale.value = withDelay(
      150,
      withSequence(
        withTiming(1.04, { duration: 520, easing: Easing.out(Easing.cubic) }),
        withTiming(1.0, { duration: 220, easing: Easing.inOut(Easing.quad) }),
      ),
    );

    // 3) Sparkles orbit — one full rotation over 3.2s, starts at 250ms
    sparklePhase.value = withDelay(
      250,
      withRepeat(withTiming(1, { duration: 3200, easing: Easing.linear }), -1, false),
    );

    // 4) Wordmark slides up + fades in (starts 700ms in)
    wordmarkOpacity.value = withDelay(
      700,
      withTiming(1, { duration: 480, easing: Easing.out(Easing.quad) }),
    );
    wordmarkShift.value = withDelay(
      700,
      withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) }),
    );

    // 5) Whole thing fades out at 1.9s.
    // IMPORTANT: don't rely on the reanimated completion callback to fire
    // onDone — on web it's flaky and if it never fires the splash stays
    // mounted forever and covers the whole app (invisible but blocking).
    // Use a plain setTimeout which is bulletproof across platforms.
    rootOpacity.value = withDelay(
      1900,
      withTiming(0, { duration: 380, easing: Easing.in(Easing.quad) }),
    );

    const t = setTimeout(() => onDone(), 2300);
    return () => clearTimeout(t);
  }, []);

  const rootStyle = useAnimatedStyle(() => ({ opacity: rootOpacity.value }));
  const bgStyle = useAnimatedStyle(() => ({ opacity: bgOpacity.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmarkOpacity.value,
    transform: [{ translateY: wordmarkShift.value }],
  }));

  // 5 sparkle dots orbiting the logo. Each is phase-offset so they twinkle
  // asymmetrically — more organic than a uniform ring.
  const sparkleCount = 5;

  return (
    <Animated.View style={[styles.root, rootStyle]} pointerEvents="none">
      {/* Background: dark plum → rose gradient, fades in */}
      <Animated.View style={[StyleSheet.absoluteFill, bgStyle]}>
        <LinearGradient
          colors={['#1C1033', '#3b1060', '#6d1a7a', '#7C3AED']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Sparkles */}
      <View style={styles.sparkleLayer} pointerEvents="none">
        {Array.from({ length: sparkleCount }).map((_, i) => (
          <SparkleDot key={i} index={i} total={sparkleCount} phase={sparklePhase} />
        ))}
      </View>

      {/* Logo — standalone, no white plate (the logo already has its own
          rounded shape; a containing disc creates a square-in-circle look). */}
      <View style={styles.center}>
        <Animated.View style={[styles.logoWrap, logoStyle]}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Wordmark */}
        <Animated.View style={[styles.wordmarkWrap, wordmarkStyle]}>
          <Text style={styles.wordmark}>MaaMitra</Text>
          <Text style={styles.tagline}>Your AI companion, at every step</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// ─── Sparkle Dot ─────────────────────────────────────────────────────────────
// Each dot rides on a shared phase (0→1), offset by its index, so the ring
// rotates as one unit while each dot also pulses.
function SparkleDot({
  index,
  total,
  phase,
}: {
  index: number;
  total: number;
  phase: SharedValue<number>;
}) {
  const baseAngle = (index / total) * 2 * Math.PI;
  const offsetPct = index / total;

  const dotStyle = useAnimatedStyle(() => {
    // Rotate + twinkle
    const angle = baseAngle + phase.value * 2 * Math.PI;
    const x = Math.cos(angle) * SPARKLE_RADIUS;
    const y = Math.sin(angle) * SPARKLE_RADIUS;
    // Each dot peaks in brightness at a different point in the cycle
    const twinkle = (phase.value + offsetPct) % 1;
    const opacity = interpolate(twinkle, [0, 0.2, 0.5, 0.8, 1], [0.35, 1, 0.45, 0.95, 0.35]);
    const scale = interpolate(twinkle, [0, 0.5, 1], [0.85, 1.15, 0.85]);
    return {
      transform: [{ translateX: x }, { translateY: y }, { scale }],
      opacity,
    };
  });

  return <Animated.View style={[styles.sparkle, dotStyle]} />;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1C1033',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    // Ensure it sits over everything including native elements on web
    ...(Platform.OS === 'web' ? ({ position: 'fixed' as any }) : {}),
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    // Subtle outer glow behind the logo
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 40,
    elevation: 20,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  wordmarkWrap: {
    marginTop: 28,
    alignItems: 'center',
    gap: 8,
  },
  wordmark: {
    fontFamily: Fonts.serif,
    fontSize: 36,
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.3,
  },
  sparkleLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
});
