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
      colors={['#f472b6', '#a78bfa']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[styles.gradient, style]}
    >
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
    fontWeight: '700',
    fontSize: 20,
    letterSpacing: 0.2,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    marginTop: 2,
    letterSpacing: 0.1,
  },
});
