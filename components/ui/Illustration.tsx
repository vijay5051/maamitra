import { Image, type ImageContentFit, type ImageStyle } from 'expo-image';
import type { StyleProp } from 'react-native';

import { illustrations, type IllustrationName } from '../../lib/illustrations';

type Props = {
  name: IllustrationName;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  /** Set false to disable the soft fade-in (rarely needed). Default: 200ms. */
  transitionMs?: number;
  accessibilityLabel?: string;
};

/**
 * Brand-illustration renderer. Wraps `expo-image` so every illustration:
 *   - Loads from the static `illustrations` map (Metro bundles all of them)
 *   - Caches on disk + memory
 *   - Fades in softly (200ms) so it never pops
 */
export function Illustration({
  name,
  style,
  contentFit = 'cover',
  transitionMs = 200,
  accessibilityLabel,
}: Props) {
  return (
    <Image
      source={illustrations[name]}
      style={style}
      contentFit={contentFit}
      transition={transitionMs}
      accessibilityLabel={accessibilityLabel}
      accessibilityIgnoresInvertColors
    />
  );
}
