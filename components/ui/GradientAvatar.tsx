import React from 'react';
import { Image, Text, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const LOGO = require('../../assets/logo.png');

interface GradientAvatarProps {
  emoji?: string;
  name?: string;
  size?: number;
  style?: ViewStyle;
  /** When true (or emoji is the bot 🤱), shows the MaaMitra logo inside the gradient circle */
  useLogo?: boolean;
}

export default function GradientAvatar({
  emoji,
  name,
  size = 44,
  style,
  useLogo,
}: GradientAvatarProps) {
  const fontSize = size * 0.45;
  const displayText = emoji ?? (name ? name.trim().charAt(0).toUpperCase() : '?');
  // Auto-use logo for the MaaMitra bot avatar (🤱) or when explicitly requested
  const showLogo = useLogo || emoji === '🤱';

  return (
    <LinearGradient
      colors={['#7C3AED', '#7C3AED']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {showLogo ? (
        <Image
          source={LOGO}
          style={{ width: size * 0.88, height: size * 0.88 }}
          resizeMode="contain"
        />
      ) : (
        <Text style={{ fontSize, lineHeight: size, textAlign: 'center' }}>
          {displayText}
        </Text>
      )}
    </LinearGradient>
  );
}
