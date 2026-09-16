/**
 * App colours for light and dark mode. Every text/background pairing here meets WCAG 2.1 AA
 * (4.5:1 for text, 3:1 for borders and selected-control fills); `npm run check:contrast`
 * verifies it.
 */

import '@/global.css';

import { Platform } from 'react-native';

import { palette } from './palette';

export const Colors = palette;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/**
 * Plus Jakarta Sans, loaded in the root layout. Android does not synthesise weights for a custom
 * family, so each weight is its own family name and text picks the family rather than a
 * `fontWeight`. The numbers are the same as the weights they replace, so every type size keeps the
 * line height it was checked at.
 */
export const FontFamily = {
  400: 'PlusJakartaSans_400Regular',
  500: 'PlusJakartaSans_500Medium',
  600: 'PlusJakartaSans_600SemiBold',
  700: 'PlusJakartaSans_700Bold',
  800: 'PlusJakartaSans_800ExtraBold',
} as const;

/**
 * Corner radii, one step per surface size: pills and swatches, inner blocks and controls, cards,
 * and the one card that carries the screen's answer. `medium` is the radius most surfaces already
 * had, so naming it did not reshape anything.
 */
export const Radius = {
  small: 8,
  medium: 16,
  large: 18,
  xlarge: 24,
  pill: 999,
} as const;

/**
 * Shadow presets. Cards lift off the page instead of relying on a colour change alone, which also
 * keeps them legible when a card and the page are close in tone. Shadows are decorative: nothing
 * depends on seeing them, so they are not held to a contrast ratio.
 */
export function elevation(level: 1 | 2 | 3) {
  const spec = {
    1: { height: 1, radius: 3, opacity: 0.06, android: 2 },
    2: { height: 3, radius: 8, opacity: 0.09, android: 4 },
    3: { height: 8, radius: 20, opacity: 0.13, android: 10 },
  }[level];
  return {
    shadowColor: '#0B1B2B',
    shadowOffset: { width: 0, height: spec.height },
    shadowOpacity: spec.opacity,
    shadowRadius: spec.radius,
    elevation: spec.android,
  } as const;
}

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Apple and Material both recommend at least 44pt/48dp touch targets. */
export const MinTouchTarget = 44;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
