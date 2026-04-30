import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

// Tabs the user can swipe between. The chat tab is intentionally absent —
// it's launched from the lifted FAB in the center of the bar, not by
// swipe (so swipe never accidentally lands a parent on the chat screen
// mid-scroll).
const TAB_ROUTES: ReadonlyArray<{ pathname: string; href: any }> = [
  { pathname: '/',          href: '/(tabs)/' },
  { pathname: '/health',    href: '/(tabs)/health' },
  { pathname: '/community', href: '/(tabs)/community' },
  { pathname: '/wellness',  href: '/(tabs)/wellness' },
];

const EDGE_WIDTH = 18; // px gutter on each side that owns the swipe gesture

/**
 * Two narrow, invisible bars on the left and right screen edges that
 * detect horizontal pan gestures and navigate to the prev / next tab.
 *
 * Edge-only by design — leaves the inner area free for vertical scrolls
 * and horizontal carousels (community filter chips, food strips, etc.)
 * without gesture conflicts. Web users with a mouse don't get the
 * gesture; that's fine — they have the bottom tabs themselves.
 */
export function TabSwipeEdges() {
  const router = useRouter();
  const pathname = usePathname();

  // We're not on a known tab? Hide. (e.g. user opened a modal-style child
  // route under /(tabs) that we don't want to swipe-navigate from.)
  const idx = TAB_ROUTES.findIndex((t) => t.pathname === pathname);
  if (idx < 0) return null;

  const goPrev = () => {
    if (idx <= 0) return;
    router.replace(TAB_ROUTES[idx - 1].href);
  };
  const goNext = () => {
    if (idx >= TAB_ROUTES.length - 1) return;
    router.replace(TAB_ROUTES[idx + 1].href);
  };

  // Pan starting on the LEFT edge, dragged toward the right → previous tab.
  const leftEdgePan = Gesture.Pan()
    .activeOffsetX([18, 9999])
    .failOffsetY([-25, 25])
    .onEnd((e) => {
      if (e.translationX > 60 || e.velocityX > 600) {
        runOnJS(goPrev)();
      }
    });

  // Pan starting on the RIGHT edge, dragged toward the left → next tab.
  const rightEdgePan = Gesture.Pan()
    .activeOffsetX([-9999, -18])
    .failOffsetY([-25, 25])
    .onEnd((e) => {
      if (e.translationX < -60 || e.velocityX < -600) {
        runOnJS(goNext)();
      }
    });

  // Web: skip — mouse drag through narrow strips is annoying and the
  // bottom tabs already give a clean way to switch.
  if (Platform.OS === 'web') return null;

  return (
    <>
      <GestureDetector gesture={leftEdgePan}>
        <View style={[styles.edge, styles.edgeLeft]} pointerEvents="box-only" />
      </GestureDetector>
      <GestureDetector gesture={rightEdgePan}>
        <View style={[styles.edge, styles.edgeRight]} pointerEvents="box-only" />
      </GestureDetector>
    </>
  );
}

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: EDGE_WIDTH,
    backgroundColor: 'transparent',
    zIndex: 1000,
  },
  edgeLeft:  { left: 0 },
  edgeRight: { right: 0 },
});
