import { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SkeletonProps {
  width: number | '100%';
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

// ─── Core Skeleton ────────────────────────────────────────────────────────────

export default function Skeleton({
  width,
  height,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const shimmerX = useSharedValue(-200);

  useEffect(() => {
    shimmerX.value = withRepeat(withTiming(200, { duration: 1200 }), -1, false);
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));

  return (
    <View
      style={[
        styles.base,
        { width: width as any, height, borderRadius },
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]}>
        <LinearGradient
          colors={[
            'transparent',
            'rgba(255,255,255,0.7)',
            'transparent',
          ]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.shimmer}
        />
      </Animated.View>
    </View>
  );
}

// ─── Presets ──────────────────────────────────────────────────────────────────

/** Full-width card placeholder — 100px tall, borderRadius 12 */
export function SkeletonCard({ style }: { style?: ViewStyle }) {
  return (
    <Skeleton width="100%" height={100} borderRadius={12} style={style} />
  );
}

/** Single line of text placeholder — 14px tall, borderRadius 4 */
export function SkeletonText({
  width = '100%',
  style,
}: {
  width?: number | '100%';
  style?: ViewStyle;
}) {
  return <Skeleton width={width} height={14} borderRadius={4} style={style} />;
}

/** Circular avatar placeholder — 48×48, fully rounded */
export function SkeletonAvatar({ style }: { style?: ViewStyle }) {
  return <Skeleton width={48} height={48} borderRadius={24} style={style} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#EDE9F6',
    overflow: 'hidden',
  },
  shimmer: {
    flex: 1,
    width: 200,
  },
});
