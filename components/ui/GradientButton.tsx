import { useRef } from 'react';
import {
  Animated,
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';

// useNativeDriver=true on web triggers a per-animation console warning
// ("native animated module is missing — falling back to JS-based animation")
// because RN-Web has no native driver. Pass false on web, true on native,
// so we keep the perf win where it exists and quiet the console elsewhere.
const NATIVE_DRIVER = Platform.OS !== 'web';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../../constants/theme';
import { Colors } from '../../constants/theme';
import { mediumTap } from '../../lib/haptics';

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
  /**
   * Remove this button from the web keyboard tab chain (tabIndex=-1) and
   * native a11y tree. Use when a visually-duplicated CTA exists elsewhere
   * on the page and should be the single screen-reader / keyboard entry
   * point. See welcome.tsx for the canonical pair-of-CTAs use case.
   */
  a11yHidden?: boolean;
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
  a11yHidden = false,
}: GradientButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePress = () => {
    mediumTap();
    onPress();
  };

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: NATIVE_DRIVER,
      speed: 24,
      bounciness: 3,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: NATIVE_DRIVER,
      speed: 24,
      bounciness: 3,
    }).start();
  };

  const isDisabled = disabled || loading;

  // When the caller marks this CTA as a11yHidden — there's an equivalent
  // primary CTA elsewhere on the page and this one is visual-only — we
  // pull it out of both the native a11y tree and (on web) the keyboard
  // tab chain. Cast to any because RN's prop types don't include
  // tabIndex on TouchableWithoutFeedback even though RN Web honours it.
  const a11yProps = a11yHidden
    ? ({
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
        focusable: false,
        ...(Platform.OS === 'web' ? { tabIndex: -1, 'aria-hidden': true } : {}),
      } as any)
    : {};

  if (outline) {
    return (
      <TouchableWithoutFeedback
        onPress={isDisabled ? undefined : handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        {...a11yProps}
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
      onPress={isDisabled ? undefined : handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      {...a11yProps}
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
