import type { ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';

/** Long enough to read as movement, short enough that it never delays a tap. */
const DURATION = 260;

/** Rows past this one appear together, so a long list never takes a visible age to fill in. */
const MAX_STAGGERED = 8;
const STAGGER_MS = 45;

interface Props {
  /** Position in a list, for the stagger. Omit for a single element. */
  index?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/**
 * Fades content in and lifts it a few points as it arrives, staggered down a list. Opacity and
 * transform only: nothing here changes layout, so a row occupies its final space from the first
 * frame and the list scrolls to the same offsets either way.
 *
 * `ReduceMotion.System` hands the decision to the OS setting — with "Reduce Motion" on, the
 * content simply appears. The skeletons use reanimated's hook for the same reason.
 */
export function Entrance({ index, style, children }: Props) {
  const delay = index === undefined ? 0 : Math.min(index, MAX_STAGGERED) * STAGGER_MS;
  return (
    <Animated.View
      style={style}
      entering={FadeInDown.duration(DURATION).delay(delay).reduceMotion(ReduceMotion.System)}>
      {children}
    </Animated.View>
  );
}

/** A plain cross-fade, for content that swaps in place (a lens changing, a year changing). */
export function CrossFade({ style, children }: Omit<Props, 'index'>) {
  return (
    <Animated.View style={style} entering={FadeIn.duration(DURATION).reduceMotion(ReduceMotion.System)}>
      {children}
    </Animated.View>
  );
}
