import React, { useEffect, useState } from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import {
  useSharedValue,
  withTiming,
  Easing,
  useDerivedValue,
  runOnJS,
} from 'react-native-reanimated';

/**
 * Tweens a numeric value from 0 → {value} over {duration} ms on mount and
 * whenever {value} changes. Pure JS-side display driven by a single shared
 * value — one setState per frame on the JS thread, but the arithmetic
 * runs on the UI thread. Keeps render count bounded.
 *
 * Use for dashboard counters ("Your Week" tiles, unread badges, follower
 * counts). Not for currency — doesn't format decimals or separators.
 */
type Props = {
  value: number;
  /** ms to tween. Default 700. */
  duration?: number;
  /** Starting value on first mount. Default 0. */
  from?: number;
  /** Optional text style. */
  style?: StyleProp<TextStyle>;
  /** Text prepended to the number (e.g. currency symbol). */
  prefix?: string;
  /** Text appended after the number (e.g. "/7"). */
  suffix?: string;
};

export default function AnimatedNumber({
  value,
  duration = 700,
  from = 0,
  style,
  prefix,
  suffix,
}: Props) {
  const [display, setDisplay] = useState(from);
  const sv = useSharedValue(from);

  useEffect(() => {
    sv.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, duration]);

  // Bridge the shared value into JS state so <Text> re-renders. Rounding
  // keeps it integer-looking; if the consumer wants decimals, format
  // upstream and pass as a rounded integer (e.g. ×10).
  useDerivedValue(() => {
    const rounded = Math.round(sv.value);
    runOnJS(setDisplay)(rounded);
  });

  return (
    <Text style={style}>
      {prefix ?? ''}
      {display}
      {suffix ?? ''}
    </Text>
  );
}
