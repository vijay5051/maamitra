import React, { useCallback } from 'react';
import { Pressable, StyleProp, ViewStyle, PressableProps } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';

/**
 * Drop-in replacement for Pressable that adds a GPU-cheap press feedback:
 * scale eases to 0.97 on press-in and springs back on release. All
 * interpolation runs on the UI thread via Reanimated shared values, so it
 * never blocks JS — safe to use on lists, grids, and cards.
 *
 * Props mirror Pressable. Extra:
 *   scaleTo  — target scale on press-in (default 0.97)
 *   disableAnimation — opt-out while keeping the pressable API
 */
type Props = PressableProps & {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  disableAnimation?: boolean;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function AnimatedPressableComp({
  style,
  scaleTo = 0.97,
  disableAnimation,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: Props) {
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(
    (e: any) => {
      if (!disableAnimation) {
        scale.value = withTiming(scaleTo, {
          duration: 90,
          easing: Easing.out(Easing.quad),
        });
      }
      onPressIn?.(e);
    },
    [disableAnimation, scaleTo, onPressIn],
  );

  const handlePressOut = useCallback(
    (e: any) => {
      if (!disableAnimation) {
        scale.value = withSpring(1, { damping: 14, stiffness: 260 });
      }
      onPressOut?.(e);
    },
    [disableAnimation, onPressOut],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle, style]}
    >
      {children as any}
    </AnimatedPressable>
  );
}
