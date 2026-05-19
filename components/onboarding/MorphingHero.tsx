import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Illustration } from '../ui/Illustration';
import type { Stage } from './StageChip';

interface Props {
  stage: Stage | null;
}

/**
 * Onboarding hero that cross-fades between the expecting and newborn
 * illustrations as the user picks their stage. 250ms cross-fade.
 *
 * Reuses the existing healthCatMother / healthCatBaby illustrations
 * (already in lib/illustrations.ts) — no new assets needed.
 */
export default function MorphingHero({ stage }: Props) {
  const expectingOpacity = useSharedValue(stage === 'pregnant' ? 1 : 0);
  const newbornOpacity = useSharedValue(stage === 'newborn' ? 1 : 0);
  const placeholderOpacity = useSharedValue(stage === null ? 0.4 : 0);

  useEffect(() => {
    expectingOpacity.value = withTiming(stage === 'pregnant' ? 1 : 0, { duration: 250 });
    newbornOpacity.value = withTiming(stage === 'newborn' ? 1 : 0, { duration: 250 });
    placeholderOpacity.value = withTiming(stage === null ? 0.4 : 0, { duration: 250 });
  }, [stage]);

  const expectingStyle = useAnimatedStyle(() => ({ opacity: expectingOpacity.value }));
  const newbornStyle = useAnimatedStyle(() => ({ opacity: newbornOpacity.value }));
  const placeholderStyle = useAnimatedStyle(() => ({ opacity: placeholderOpacity.value }));

  return (
    <View
      style={styles.wrap}
      accessibilityLabel={
        stage === 'pregnant'
          ? 'Illustration of a pregnant mother'
          : stage === 'newborn'
            ? 'Illustration of a baby'
            : 'Onboarding illustration'
      }
    >
      <Animated.View style={[styles.layer, expectingStyle]} pointerEvents="none">
        <Illustration name="healthCatMother" style={styles.illus} contentFit="contain" />
      </Animated.View>
      <Animated.View style={[styles.layer, newbornStyle]} pointerEvents="none">
        <Illustration name="healthCatBaby" style={styles.illus} contentFit="contain" />
      </Animated.View>
      <Animated.View style={[styles.layer, placeholderStyle]} pointerEvents="none">
        <Illustration name="healthCatMother" style={styles.illus} contentFit="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    height: 180,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illus: { width: 180, height: 180 },
});
