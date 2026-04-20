import React, { useRef } from 'react';
import {
  Animated,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../../constants/theme';
import { Colors } from '../../constants/theme';

/**
 * Primary CTA button for the whole app. Previously rendered a saturated
 * pink→purple gradient with a loud shadow; that look became kids-app-y
 * next to the refreshed onboarding. Now a single solid brand purple
 * with a subtle lift. The name stays for backwards compatibility (used
 * in 10+ places) — think of it as "PrimaryButton".
 */

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
  outline?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
}

const BRAND = Colors.primary;
const BRAND_DIM = '#c9b7f7';

export default function GradientButton({
  title,
  onPress,
  style,
  textStyle,
  disabled = false,
  outline = false,
  icon,
  loading = false,
}: GradientButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 24,
      bounciness: 3,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 24,
      bounciness: 3,
    }).start();
  };

  const isDisabled = disabled || loading;

  if (outline) {
    return (
      <TouchableWithoutFeedback
        onPress={isDisabled ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
      >
        <Animated.View
          style={[
            styles.outlineButton,
            { transform: [{ scale }], opacity: isDisabled ? 0.5 : 1 },
            style,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={BRAND} size="small" />
          ) : (
            <View style={styles.inner}>
              {icon && (
                <Ionicons
                  name={icon}
                  size={18}
                  color={BRAND}
                  style={styles.icon}
                />
              )}
              <Text style={[styles.outlineText, textStyle]}>{title}</Text>
            </View>
          )}
        </Animated.View>
      </TouchableWithoutFeedback>
    );
  }

  return (
    <TouchableWithoutFeedback
      onPress={isDisabled ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
    >
      <Animated.View
        style={[
          styles.solid,
          { transform: [{ scale }], backgroundColor: isDisabled ? BRAND_DIM : BRAND },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <View style={styles.inner}>
            {icon && (
              <Ionicons
                name={icon}
                size={18}
                color="#ffffff"
                style={styles.icon}
              />
            )}
            <Text style={[styles.text, textStyle]}>{title}</Text>
          </View>
        )}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  solid: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    shadowColor: '#1C1033',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
    boxShadow: '0px 4px 14px rgba(28, 16, 51, 0.08)',
  },
  outlineButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E1EE',
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 8,
  },
  text: {
    color: '#ffffff',
    fontFamily: Fonts.sansBold,
    fontSize: 15,
    letterSpacing: 0.2,
  },
  outlineText: {
    color: BRAND,
    fontFamily: Fonts.sansBold,
    fontSize: 15,
    letterSpacing: 0.2,
  },
});
