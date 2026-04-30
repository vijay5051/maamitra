import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '../../constants/theme';

// Three soft brand-purple hearts that pulse in sequence while the AI is
// generating a reply. Replaces the older grey-dots bounce — warmer feel,
// runs on the UI thread (Reanimated), and naturally stops when the parent
// unmounts this component as soon as the response begins streaming.

const HEART_COUNT = 3;
const STEP_MS = 220;          // delay between each heart's pulse onset
const PULSE_UP_MS = 380;
const PULSE_DOWN_MS = 380;

const AnimatedIcon = Animated.createAnimatedComponent(Ionicons);

function Heart({ delay }: { delay: number }) {
  const scale = useSharedValue(0.7);
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    const easing = Easing.inOut(Easing.quad);
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.0, { duration: PULSE_UP_MS, easing }),
          withTiming(0.7, { duration: PULSE_DOWN_MS, easing }),
        ),
        -1,
        false,
      ),
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.0, { duration: PULSE_UP_MS, easing }),
          withTiming(0.45, { duration: PULSE_DOWN_MS, easing }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <AnimatedIcon name="heart" size={14} color={Colors.primary} />
    </Animated.View>
  );
}

export default function TypingIndicator() {
  return (
    <View style={styles.wrapper}>
      <View style={styles.bubble}>
        {Array.from({ length: HEART_COUNT }).map((_, i) => (
          <Heart key={i} delay={i * STEP_MS} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'flex-start',
    marginLeft: 8,
    marginVertical: 4,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderRadius: 4,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    boxShadow: '0px 2px 6px rgba(28, 16, 51, 0.048)',
  },
});
