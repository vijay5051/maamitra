import { useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, withAlpha } from '../../constants/theme';

interface Props {
  state: 'idle' | 'deleting' | 'deleted';
}

export default function DeleteAccountOverlay({ state }: Props) {
  const rotation = useSharedValue(0);
  const checkScale = useSharedValue(0);

  useEffect(() => {
    if (state === 'deleting') {
      rotation.value = withRepeat(withTiming(1, { duration: 700 }), -1, false);
    }
    if (state === 'deleted') {
      checkScale.value = withSequence(withTiming(1.2, { duration: 180 }), withTiming(1, { duration: 120 }));
    }
  }, [state]);

  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value * 360}deg` }] }));
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }] }));

  if (state === 'idle') return null;

  return (
    <Modal visible transparent animationType="fade" accessibilityViewIsModal>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityLiveRegion="polite">
          {state === 'deleting' ? (
            <>
              <Animated.View style={spinStyle}>
                <Ionicons name="trash-outline" size={32} color={Colors.primary} />
              </Animated.View>
              <Text style={styles.text}>Deleting your account…</Text>
            </>
          ) : (
            <>
              <Animated.View style={checkStyle}>
                {/* Colors.success (#22c55e) is the brand token for green — preferred over hardcoded hex */}
                <View style={styles.checkCircle}>
                  <Ionicons name="checkmark" size={28} color={Colors.white} />
                </View>
              </Animated.View>
              <Text style={styles.text}>Account deleted</Text>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: withAlpha(Colors.textDark, 0.55), alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: Colors.cardBg, borderRadius: 18, paddingVertical: 28, paddingHorizontal: 36, alignItems: 'center', gap: 14, minWidth: 200 },
  // Colors.success is the brand token for semantic success green (#22c55e)
  checkCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: Fonts.sansSemiBold, fontSize: 15, color: Colors.textDark },
});
