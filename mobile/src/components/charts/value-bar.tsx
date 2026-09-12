import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface Props {
  value: number;
  /** The largest value in the list, so bars are comparable row to row. */
  max: number;
  color: string;
  /** Formatted value shown beside the bar, e.g. "42 µg/m³". */
  label: string;
}

/**
 * One horizontal bar with its value beside it (not inside, so the label never depends on the bar
 * colour for contrast). Hidden from screen readers; the containing row speaks the value.
 */
export function ValueBar({ value, max, color, label }: Props) {
  const theme = useTheme();
  const share = max > 0 ? Math.min(value / max, 1) : 0;

  return (
    <View aria-hidden style={styles.row}>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.fill, { width: `${share * 100}%`, backgroundColor: color }]} />
      </View>
      <ThemedText type="smallBold" style={styles.label}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  track: {
    flex: 1,
    height: 14,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  label: {
    minWidth: 84,
    textAlign: 'right',
  },
});
