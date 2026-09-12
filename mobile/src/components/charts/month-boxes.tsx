import { StyleSheet, View } from 'react-native';

import type { Pollutant } from '@/api/live';
import type { MonthStats } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { categoryForConcentration } from '@/constants/pollutants';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMonth } from '@/lib/format';

interface Props {
  months: MonthStats[];
  pollutant: Pollutant;
  summary: string;
  height?: number;
}

/**
 * Spread of hourly values in each month: the line runs from the 10th to the 90th percentile, the
 * box covers the middle half, and the bar across it is the median. Twelve columns fit a phone
 * exactly for a financial year.
 */
export function MonthBoxes({ months, pollutant, summary, height = 150 }: Props) {
  const theme = useTheme();
  const scaleMax = Math.max(1, ...months.map((m) => m.p90)) * 1.05;
  const y = (value: number) => (value / scaleMax) * height;

  return (
    <View accessible role="img" aria-label={summary}>
      <View style={[styles.plot, { height }]}>
        {months.map((m) => {
          const band = categoryForConcentration(pollutant, m.median);
          return (
            <View key={m.month} style={styles.column}>
              <View
                style={[
                  styles.whisker,
                  { bottom: y(m.p10), height: y(m.p90) - y(m.p10), backgroundColor: theme.textSecondary },
                ]}
              />
              <View
                style={[
                  styles.box,
                  {
                    bottom: y(m.p25),
                    height: Math.max(y(m.p75) - y(m.p25), 2),
                    backgroundColor: band.color,
                    borderColor: theme.text,
                  },
                ]}
              />
              <View style={[styles.median, { bottom: y(m.median), backgroundColor: theme.text }]} />
            </View>
          );
        })}
      </View>
      <View style={styles.axis}>
        {months.map((m) => (
          <ThemedText key={m.month} type="small" themeColor="textSecondary" style={styles.axisLabel}>
            {formatMonth(m.month)}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plot: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  column: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
  },
  whisker: {
    position: 'absolute',
    width: 2,
  },
  box: {
    position: 'absolute',
    left: '15%',
    right: '15%',
    borderWidth: 1,
    borderRadius: 2,
  },
  median: {
    position: 'absolute',
    left: '5%',
    right: '5%',
    height: 3,
  },
  axis: {
    flexDirection: 'row',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  axisLabel: {
    flex: 1,
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
});
