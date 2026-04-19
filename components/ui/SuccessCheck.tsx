import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withDelay,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Draw-in success checkmark. Used after OTP verify, phone saved, etc.
 * Ring scales + fades in, then the checkmark stroke draws from start to
 * end via stroke-dashoffset interpolation.
 *
 * Pure SVG + Reanimated — no bitmap animation, no Lottie. Runs on the UI
 * thread.
 */
type Props = {
  size?: number;
  color?: string;
  bgColor?: string;
  style?: StyleProp<ViewStyle>;
  /** Restart key. Changing this replays the animation. */
  playKey?: number | string;
};

// Checkmark path length approximately — anything > path length guarantees
// the dash fully hides the stroke at start.
const CHECK_PATH_LEN = 60;

export default function SuccessCheck({
  size = 72,
  color = '#16a34a',
  bgColor = '#dcfce7',
  style,
  playKey,
}: Props) {
  const ringScale = useSharedValue(0.6);
  const ringOpacity = useSharedValue(0);
  const dashOffset = useSharedValue(CHECK_PATH_LEN);

  useEffect(() => {
    // Reset to start state, then play.
    ringScale.value = 0.6;
    ringOpacity.value = 0;
    dashOffset.value = CHECK_PATH_LEN;

    ringOpacity.value = withTiming(1, {
      duration: 180,
      easing: Easing.out(Easing.quad),
    });
    ringScale.value = withSpring(1, { damping: 11, stiffness: 180 });
    dashOffset.value = withDelay(
      160,
      withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) }),
    );
  }, [playKey]);

  const ringProps = useAnimatedProps(() => ({
    opacity: ringOpacity.value,
  }));
  const checkProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));
  const containerStyle = {
    transform: [{ scale: ringScale.value as any }],
  };

  // Wrap in Animated.View so scale on the container drives both ring + check.
  return (
    <Animated.View style={[styles.wrap, containerStyle, style]}>
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <AnimatedCircle
          cx={32}
          cy={32}
          r={30}
          fill={bgColor}
          animatedProps={ringProps}
        />
        <AnimatedPath
          d="M18 33 L28 43 L46 23"
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={CHECK_PATH_LEN}
          animatedProps={checkProps}
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
