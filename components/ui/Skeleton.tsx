import { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors } from '../../constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SkeletonProps {
  width: number | `${number}%`;
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
  width?: number | `${number}%`;
  style?: ViewStyle;
}) {
  return <Skeleton width={width} height={14} borderRadius={4} style={style} />;
}

/** Circular avatar placeholder — 48×48, fully rounded */
export function SkeletonAvatar({ style }: { style?: ViewStyle }) {
  return <Skeleton width={48} height={48} borderRadius={24} style={style} />;
}

/** Community post card placeholder — matches PostCard layout (avatar + author
 *  + body lines + image strip + reactions row). Shown while the feed first
 *  loads, before any real posts are in store. */
export function SkeletonPostCard({ style }: { style?: ViewStyle }) {
  return (
    <View style={[postCardStyles.card, style]}>
      <View style={postCardStyles.row}>
        <SkeletonAvatar />
        <View style={{ flex: 1, gap: 6 }}>
          <SkeletonText width={140} />
          <SkeletonText width={80} style={{ height: 11 }} />
        </View>
      </View>
      <View style={{ gap: 8, marginTop: 14 }}>
        <SkeletonText width="100%" />
        <SkeletonText width="92%" />
        <SkeletonText width="60%" />
      </View>
      <View style={{ marginTop: 14 }}>
        <Skeleton width="100%" height={140} borderRadius={12} />
      </View>
      <View style={postCardStyles.reactionsRow}>
        <Skeleton width={64} height={24} borderRadius={12} />
        <Skeleton width={64} height={24} borderRadius={12} />
        <Skeleton width={64} height={24} borderRadius={12} />
      </View>
    </View>
  );
}

/** Library article card placeholder — matches ArticleCard (image-left,
 *  title + summary + tag rail). */
export function SkeletonArticleCard({ style }: { style?: ViewStyle }) {
  return (
    <View style={[articleCardStyles.card, style]}>
      <Skeleton width={88} height={88} borderRadius={12} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonText width="78%" style={{ height: 16 }} />
        <SkeletonText width="100%" />
        <SkeletonText width="60%" />
      </View>
    </View>
  );
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

const postCardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reactionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
});

const articleCardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
});
