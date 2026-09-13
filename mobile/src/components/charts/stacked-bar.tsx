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
 * and a remainder (e.g. days with no data) is drawn as an empty track. Hidden from screen readers:
 * the row that contains it carries the spoken summary.
 */
export function StackedBar({ segments, total, height = 22, showValues = true }: Props) {
  const theme = useTheme();
  const sum = segments.reduce((acc, s) => acc + s.value, 0);
  const length = Math.max(total ?? sum, 1);
  const remainder = Math.max(length - sum, 0);

  return (
    <View aria-hidden style={[styles.bar, { height }]}>
      {segments
        .filter((s) => s.value > 0)
        .map((s) => {
          // Not `flex: s.value` inline: Reanimated's Babel plugin flags any `.value` in a style
          // as a misused shared value and logs a warning on every render.
          const flex = s.value;
          return (
            <View key={s.key} style={[styles.segment, { flex, backgroundColor: s.color }]}>
              {showValues && s.value / length >= 0.09 ? (
                <Text numberOfLines={1} style={[styles.value, { color: s.textColor }]}>
                  {s.value}
                </Text>
              ) : null}
            </View>
          );
        })}
      {remainder > 0 ? (
        <View style={[styles.segment, { flex: remainder, backgroundColor: theme.backgroundSelected }]} />
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
  },
  value: {
    fontSize: 11,
    fontWeight: '700',
  },
});
