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
      shadowColor: '#ec4899',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 2,
      boxShadow: '0px 2px 6px rgba(236, 72, 153, 0.08)',
    },
    md: {
      shadowColor: '#ec4899',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.10,
      shadowRadius: 12,
      elevation: 4,
      boxShadow: '0px 4px 12px rgba(236, 72, 153, 0.10)',
    },
    lg: {
      shadowColor: '#ec4899',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 8,
      boxShadow: '0px 8px 20px rgba(236, 72, 153, 0.12)',
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
    borderRadius: 16,
  },
});
