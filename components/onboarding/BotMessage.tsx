import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import GradientAvatar from '../ui/GradientAvatar';

const webTextStyle = Platform.OS === 'web'
  ? ({ wordBreak: 'break-word', overflowWrap: 'anywhere' } as any)
  : {};

interface BotMessageProps {
  text: string;
  delay?: number;
}

export default function BotMessage({ text, delay = 0 }: BotMessageProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 350,
        delay,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View
      style={[styles.wrapper, { opacity, transform: [{ translateY }] }]}
    >
      <GradientAvatar emoji="🤱" size={36} style={styles.avatar} />
      <View style={styles.bubble}>
        <Text style={[styles.text, webTextStyle]}>{text}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    alignSelf: 'stretch',
    marginVertical: 6,
    minWidth: 0,
  },
  avatar: {
    marginRight: 10,
    marginBottom: 2,
    flexShrink: 0,
  },
  bubble: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    minWidth: 0,
    boxShadow: '0px 2px 8px rgba(236, 72, 153, 0.08)',
  },
  text: {
    color: '#1a1a2e',
    fontSize: 15,
    lineHeight: 22,
  },
});
