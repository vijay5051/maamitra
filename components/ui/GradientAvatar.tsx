import React from 'react';
import { StyleSheet, Text, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface GradientAvatarProps {
  emoji?: string;
  name?: string;
  size?: number;
  style?: ViewStyle;
}

export default function GradientAvatar({
  emoji,
  name,
  size = 44,
  style,
}: GradientAvatarProps) {
  const fontSize = size * 0.45;
  const displayText = emoji ?? (name ? name.trim().charAt(0).toUpperCase() : '?');

  return (
    <LinearGradient
      colors={['#ec4899', '#8b5cf6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text style={{ fontSize, lineHeight: size, textAlign: 'center' }}>
        {displayText}
      </Text>
    </LinearGradient>
  );
}
