import React, { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '../../constants/theme';

// One-shot confetti burst for celebration moments — vaccine logged, milestone
// hit, mood entry, child added, yoga session complete. Renders a fixed number
// of particles that fly outward + downward with rotation, then the parent
// unmounts the component (driven by the `show` prop). No looping, no
// always-on cost.

const PARTICLE_COUNT = 28;
const DURATION_MS = 1600;
const PARTICLE_SIZE = 8;
const COLORS = [
  Colors.primary,        // brand purple
  Colors.lavenderMild,
  Colors.blushMild,
  Colors.sageMild,
  Colors.ochreMild,
];

type ConfettiProps = {
  /** When `show` flips to true, the confetti plays once and calls `onDone`. */
  show: boolean;
  onDone?: () => void;
};

type ParticleSpec = {
  startX: number;
  endX: number;
  endY: number;
  rotateEnd: number;
  delay: number;
  color: string;
  shape: 'rect' | 'circle';
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function makeSpecs(): ParticleSpec[] {
  return Array.from({ length: PARTICLE_COUNT }, () => ({
    startX: SCREEN_W / 2 + rand(-20, 20),
    endX: rand(0, SCREEN_W),
    endY: rand(SCREEN_H * 0.45, SCREEN_H * 0.85),
    rotateEnd: rand(-720, 720),
    delay: rand(0, 180),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    shape: Math.random() < 0.4 ? 'circle' : 'rect',
  }));
}

function Particle({ spec, onComplete }: { spec: ParticleSpec; onComplete?: () => void }) {
  const x = useSharedValue(spec.startX);
  const y = useSharedValue(SCREEN_H * 0.18);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const easing = Easing.out(Easing.cubic);
    opacity.value = withDelay(spec.delay, withTiming(1, { duration: 120 }));
    x.value = withDelay(spec.delay, withTiming(spec.endX, { duration: DURATION_MS, easing }));
    y.value = withDelay(spec.delay, withTiming(spec.endY, { duration: DURATION_MS, easing: Easing.in(Easing.quad) }));
    rotate.value = withDelay(spec.delay, withTiming(spec.rotateEnd, { duration: DURATION_MS, easing }));
    // Fade out near the end, then fire onComplete from the LAST particle only.
    opacity.value = withDelay(
      spec.delay + DURATION_MS - 300,
      withTiming(0, { duration: 300 }, (finished) => {
        if (finished && onComplete) runOnJS(onComplete)();
      }),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        spec.shape === 'circle' && styles.circle,
        { backgroundColor: spec.color },
        style,
      ]}
    />
  );
}

export function Confetti({ show, onDone }: ConfettiProps): React.JSX.Element | null {
  // Build a fresh particle set each time `show` flips true so the next burst
  // doesn't reuse the previous random layout.
  const specs = useMemo<ParticleSpec[]>(() => (show ? makeSpecs() : []), [show]);
  if (!show) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {specs.map((spec, i) => (
        <Particle
          key={i}
          spec={spec}
          onComplete={i === specs.length - 1 ? onDone : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    width: PARTICLE_SIZE,
    height: PARTICLE_SIZE * 1.6,
    borderRadius: 2,
    top: 0,
    left: 0,
  },
  circle: {
    width: PARTICLE_SIZE,
    height: PARTICLE_SIZE,
    borderRadius: PARTICLE_SIZE / 2,
  },
});
