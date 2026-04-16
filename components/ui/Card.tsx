import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

type ShadowSize = 'sm' | 'md' | 'lg';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  shadow?: ShadowSize;
  pressable?: boolean;
  onPress?: () => void;
  padding?: number;
}

function getShadow(shadow?: ShadowSize) {
  if (!shadow) return {};
  const map: Record<ShadowSize, object> = {
    sm: {
      shadowColor: '#E8487A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 8,
      elevation: 3,
      boxShadow: '0px 2px 8px rgba(232, 72, 122, 0.07)',
    },
    md: {
      shadowColor: '#E8487A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.10,
      shadowRadius: 14,
      elevation: 5,
      boxShadow: '0px 4px 14px rgba(232, 72, 122, 0.10)',
    },
    lg: {
      shadowColor: '#7C3AED',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 20,
      elevation: 8,
      boxShadow: '0px 8px 20px rgba(124, 58, 237, 0.14)',
    },
  };
  return map[shadow];
}

export default function Card({
  children,
  style,
  shadow,
  pressable = false,
  onPress,
  padding = 16,
}: CardProps) {
  const cardStyle: ViewStyle[] = [
    styles.card,
    { padding },
    getShadow(shadow) as ViewStyle,
    style ?? {},
  ];

  if (pressable && onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={cardStyle}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EDE9F6',
  },
});
