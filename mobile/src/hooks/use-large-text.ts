import { useWindowDimensions } from 'react-native';

/**
 * Text scale above which layouts switch to their large-text form: controls that sit side by
 * side stack, and one-line labels may wrap. 1.3 is roughly iOS's "xxxLarge", the biggest size
 * before the Accessibility sizes.
 */
export const LARGE_TEXT_SCALE = 1.3;

/** Whether the user's text size is large enough that side-by-side layouts should stack. */
export function useLargeText(): boolean {
  return useWindowDimensions().fontScale > LARGE_TEXT_SCALE;
}
