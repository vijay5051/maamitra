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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

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
      toValue: 0.96,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
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
            <ActivityIndicator color="#ec4899" size="small" />
          ) : (
            <View style={styles.inner}>
              {icon && (
                <Ionicons
                  name={icon}
                  size={18}
                  color="#ec4899"
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
          styles.wrapper,
          { transform: [{ scale }], opacity: isDisabled ? 0.5 : 1 },
          style,
        ]}
      >
        <LinearGradient
          colors={['#ec4899', '#8b5cf6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
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
        </LinearGradient>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
    boxShadow: '0px 4px 12px rgba(236, 72, 153, 0.25)',
  },
  gradient: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  outlineButton: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#ec4899',
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
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
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  outlineText: {
    color: '#ec4899',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
