import React, { useEffect } from 'react';
import { Image as RNImage, StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Fonts } from '../../constants/theme';

type SplashAnimationProps = {
  onComplete: () => void;
};

const AnimatedView = Animated.createAnimatedComponent(View);

const LOGO_SIZE = 64;
const MASCOT_SIZE = 180;

export function SplashAnimation({ onComplete }: SplashAnimationProps): React.JSX.Element {
  const compositionOpacity = useSharedValue(1);
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.85);
  const logoTranslateY = useSharedValue(12);
  const mascotOpacity = useSharedValue(0);
  const mascotTranslateY = useSharedValue(24);
  const taglineOpacity = useSharedValue(0);
  const taglineTranslateY = useSharedValue(8);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
    logoScale.value = withSpring(1, { damping: 14, stiffness: 110 });
    logoTranslateY.value = withSpring(0, { damping: 14, stiffness: 110 });

    mascotOpacity.value = withDelay(
      300,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
    mascotTranslateY.value = withDelay(
      300,
      withSpring(0, { damping: 16, stiffness: 120 }),
    );

    taglineOpacity.value = withDelay(
      600,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
    taglineTranslateY.value = withDelay(
      600,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );

    compositionOpacity.value = withDelay(
      1500,
      withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) {
          runOnJS(onComplete)();
        }
      }),
    );
  }, [compositionOpacity, logoOpacity, logoScale, logoTranslateY, mascotOpacity, mascotTranslateY, onComplete, taglineOpacity, taglineTranslateY]);

  const compositionStyle = useAnimatedStyle(() => ({
    opacity: compositionOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      { scale: logoScale.value },
      { translateY: logoTranslateY.value },
    ],
  }));

  const mascotStyle = useAnimatedStyle(() => ({
    opacity: mascotOpacity.value,
    transform: [{ translateY: mascotTranslateY.value }],
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: taglineTranslateY.value }],
  }));

  return (
    <View style={styles.root}>
      <AnimatedView style={[styles.composition, compositionStyle]}>
        <AnimatedView style={[styles.logoWrap, logoStyle]}>
          <RNImage
            source={require('../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </AnimatedView>

        <AnimatedView style={[styles.mascotWrap, mascotStyle]}>
          <ExpoImage
            source={require('../../assets/illustrations/chat-mascot.webp')}
            style={styles.mascot}
            contentFit="contain"
            transition={0}
          />
        </AnimatedView>

        <AnimatedView style={taglineStyle}>
          <Text style={styles.tagline}>for every Maa</Text>
        </AnimatedView>
      </AnimatedView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bgLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composition: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoWrap: {
    marginBottom: 24,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  mascotWrap: {
    marginBottom: 28,
  },
  mascot: {
    width: MASCOT_SIZE,
    height: MASCOT_SIZE,
  },
  tagline: {
    fontFamily: Fonts.serif,
    fontSize: 18,
    color: Colors.primary,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
});
