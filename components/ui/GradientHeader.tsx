import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../../constants/theme';

interface GradientHeaderProps {
  title: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
  style?: ViewStyle;
}

export default function GradientHeader({
  title,
  subtitle,
  rightElement,
  showBack = false,
  onBack,
  style,
}: GradientHeaderProps) {
  return (
    <LinearGradient
      colors={['#1C1033', '#3b1060', '#6d1a7a']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.gradient, style]}
    >
      {/* Ambient glow — top right */}
      <View style={styles.glowTopRight} pointerEvents="none" />
      {/* Ambient glow — bottom left */}
      <View style={styles.glowBottomLeft} pointerEvents="none" />

      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.row}>
          {/* Left: back button or spacer */}
          <View style={styles.side}>
            {showBack && (
              <TouchableOpacity
                onPress={onBack}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.backButton}
              >
                <Ionicons name="chevron-back" size={24} color="#ffffff" />
              </TouchableOpacity>
            )}
          </View>

          {/* Centre: title + subtitle */}
          <View style={styles.centre}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          {/* Right: custom element or spacer */}
          <View style={styles.side}>
            {rightElement ?? null}
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    width: '100%',
    overflow: 'hidden',
  },
  glowTopRight: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(232,72,122,0.28)',
    top: -80,
    right: -40,
  },
  glowBottomLeft: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(124,58,237,0.2)',
    bottom: -50,
    left: -30,
  },
  safeArea: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  side: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centre: {
    flex: 1,
    alignItems: 'center',
  },
  backButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#ffffff',
    fontFamily: Fonts.serif,
    fontSize: 22,
    letterSpacing: -0.3,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    marginTop: 3,
    letterSpacing: 0.2,
  },
});
