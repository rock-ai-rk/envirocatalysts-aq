import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export interface Segment {
  key: string;
  value: number;
  color: string;
  textColor: string;
}

interface Props {
  segments: Segment[];
  /** Full length of the bar. Defaults to the sum; a larger total leaves an empty remainder. */
  total?: number;
  height?: number;
  showValues?: boolean;
}

/**
 * A horizontal stacked bar. Segments are separated by a 2pt gap so neighbouring colours never
 * need to contrast with each other (the source dashboard's segments bled together at under 3:1),
 * and a remainder (e.g. days with no data) is drawn as an empty track. The gap makes the card the
 * colour every segment sits against, and three category colours are under 3:1 on it (Moderate's
 * yellow is 1.07:1), so each segment is outlined in the theme's border colour, which clears 3:1
 * on the card in both themes. Hidden from screen readers: the row that contains it carries the
 * spoken summary.
 */
export function StackedBar({ segments, total, height = 22, showValues = true }: Props) {
  const theme = useTheme();
  const sum = segments.reduce((acc, s) => acc + s.value, 0);
  const length = Math.max(total ?? sum, 1);
  const remainder = Math.max(length - sum, 0);

  return (
    // minHeight, not height: at large text sizes the numbers inside grow and the bar grows with them.
    <View aria-hidden style={[styles.bar, { minHeight: height }]}>
      {segments
        .filter((s) => s.value > 0)
        .map((s) => {
          // Not `flex: s.value` inline: Reanimated's Babel plugin flags any `.value` in a style
          // as a misused shared value and logs a warning on every render.
          const flex = s.value;
          return (
            <View key={s.key} style={[styles.segment, { flex, backgroundColor: s.color, borderColor: theme.border }]}>
              {showValues && s.value / length >= 0.09 ? (
                // Capped: the same numbers are in the row's headline and spoken summary, which scale fully.
                <Text numberOfLines={1} maxFontSizeMultiplier={1.6} style={[styles.value, { color: s.textColor }]}>
                  {s.value}
                </Text>
              ) : null}
            </View>
          );
        })}
      {remainder > 0 ? (
        <View
          style={[styles.segment, { flex: remainder, backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  segment: {
    justifyContent: 'center',
    alignItems: 'center',
    // Outlines the segment against the card. Inside the box, so it does not shift the proportions.
    borderWidth: 1,
  },
  value: {
    fontSize: 11,
    fontWeight: '700',
    paddingVertical: 2,
  },
});
