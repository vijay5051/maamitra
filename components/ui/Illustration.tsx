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
// Humanise an illustration key (e.g. "homeWelcome" → "Home welcome") so
// screen readers announce something descriptive when callers don't pass
// an explicit accessibilityLabel. Not as good as a real curator-written
// label, but vastly better than "image".
function humanise(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

export function Illustration({
  name,
  style,
  contentFit = 'cover',
  transitionMs = 200,
  accessibilityLabel,
}: Props) {
  const label = accessibilityLabel ?? humanise(String(name)) + ' illustration';
  return (
    <Image
      source={illustrations[name]}
      style={style}
      contentFit={contentFit}
      transition={transitionMs}
      accessibilityLabel={label}
      accessibilityIgnoresInvertColors
      // expo-image renders to <img> on web — `alt` is what axe-core /
      // Lighthouse a11y check. Set both so each platform's a11y tree picks
      // the right one.
      alt={label}
    />
  );
}
