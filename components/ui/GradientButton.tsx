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
import { Fonts } from '../../constants/theme';

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
            <ActivityIndicator color="#E8487A" size="small" />
          ) : (
            <View style={styles.inner}>
              {icon && (
                <Ionicons
                  name={icon}
                  size={18}
                  color="#E8487A"
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
          colors={['#E8487A', '#7C3AED']}
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
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#E8487A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
    boxShadow: '0px 8px 24px rgba(232, 72, 122, 0.35)',
  },
  gradient: {
    paddingVertical: 17,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  outlineButton: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E8487A',
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
    fontFamily: Fonts.sansBold,
    fontSize: 16,
    letterSpacing: 0.2,
  },
  outlineText: {
    color: '#E8487A',
    fontFamily: Fonts.sansBold,
    fontSize: 16,
    letterSpacing: 0.2,
  },
});
