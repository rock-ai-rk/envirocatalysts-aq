import { StyleSheet, View } from 'react-native';

import type { Pollutant } from '@/api/live';
import type { HourBin } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { AQI_CATEGORIES } from '@/constants/aqi';
import { categoryForConcentration } from '@/constants/pollutants';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface Props {
  hours: HourBin[];
  /** Drawn as a tick on each bar, so the two periods can be compared hour by hour. */
  comparison?: HourBin[];
  pollutant: Pollutant;
  thresholds: { naaqs: number; who: number } | null;
  /** Spoken instead of the bars; also shown above the chart by the caller. */
  summary: string;
  height?: number;
}

const AXIS_LABELS = new Set(['03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00', '00:00']);

/** Average for each hour of the day: 24 bars coloured by CPCB band, with limit lines. */
export function HourBars({ hours, comparison, pollutant, thresholds, summary, height = 160 }: Props) {
  const theme = useTheme();
  const values = [...hours, ...(comparison ?? [])].flatMap((h) => (h.mean === null ? [] : [h.mean]));
  const dataMax = Math.max(1, ...values);
  const scaleMax = Math.max(dataMax, thresholds?.who ?? 0) * 1.1;
  const lines = thresholds
    ? [
        { label: `WHO ${thresholds.who}`, value: thresholds.who },
        { label: `NAAQS ${thresholds.naaqs}`, value: thresholds.naaqs },
      ].filter((line) => line.value <= scaleMax)
    : [];

  return (
    <View accessible role="img" aria-label={summary}>
      <View style={[styles.plot, { height }]}>
        {lines.map((line) => (
          <View
            key={line.label}
            style={[styles.limit, { bottom: (line.value / scaleMax) * height, borderColor: theme.text }]}>
            <ThemedText type="small" style={[styles.limitLabel, { backgroundColor: theme.backgroundElement }]}>
              {line.label}
            </ThemedText>
          </View>
        ))}
        {hours.map((bin, index) => {
          const other = comparison?.[index]?.mean ?? null;
          const category = bin.mean === null ? null : categoryForConcentration(pollutant, bin.mean);
          return (
            <View key={bin.hour} style={styles.column}>
              {bin.mean !== null && category ? (
                <View
                  style={[
                    styles.bar,
                    { height: (bin.mean / scaleMax) * height, backgroundColor: category.color },
                  ]}
                />
              ) : null}
              {other !== null ? (
                <View
                  style={[styles.tick, { bottom: (other / scaleMax) * height, backgroundColor: theme.text }]}
                />
              ) : null}
            </View>
          );
        })}
      </View>
      <View style={styles.axis}>
        {hours.map((bin) => (
          <View key={bin.hour} style={styles.axisColumn}>
            {AXIS_LABELS.has(bin.label) ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.axisLabel}>
                {bin.label.slice(0, 2)}
              </ThemedText>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Legend entries for the bands actually used by an hourly series. */
export function bandsUsed(pollutant: Pollutant, bins: HourBin[]) {
  const used = new Set(
    bins.flatMap((b) => (b.mean === null ? [] : [categoryForConcentration(pollutant, b.mean).key])),
  );
  return AQI_CATEGORIES.filter((c) => used.has(c.key));
}

const styles = StyleSheet.create({
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  column: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  tick: {
    position: 'absolute',
    left: -1,
    right: -1,
    height: 3,
    borderRadius: 1.5,
  },
  limit: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    zIndex: 1,
  },
  limitLabel: {
    position: 'absolute',
    right: 0,
    top: -18,
    fontSize: 11,
    lineHeight: 14,
    paddingHorizontal: Spacing.one,
  },
  axis: {
    flexDirection: 'row',
    gap: 2,
    marginTop: Spacing.one,
  },
  // No percentage height here: the axis row has no height of its own, and on iOS a
  // percentage of it resolves against the scroll view, stretching the card to twice the screen.
  axisColumn: {
    flex: 1,
  },
  axisLabel: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
    marginHorizontal: -8,
  },
});
