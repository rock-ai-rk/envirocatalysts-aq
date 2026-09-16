import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Pollutant } from '@/api/live';
import type { HeatmapRow } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { categoryForConcentration, spokenUnitFor } from '@/constants/pollutants';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface Props {
  rows: HeatmapRow[];
  hourLabels: string[];
  pollutant: Pollutant;
}

const CELL_WIDTH = 60;
const CELL_HEIGHT = 24;
const HOUR_COLUMN = 48;

/**
 * Station x hour-of-day grid, drawn with stations as columns and the 24 hours as rows: the
 * source dashboard's 24 columns don't fit a portrait phone, 24 rows do. Each station column is
 * one screen-reader element with a spoken summary of its day.
 */
export function HeatmapGrid({ rows, hourLabels, pollutant }: Props) {
  const theme = useTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={rows.length > 4}>
      <View style={styles.grid}>
        <View aria-hidden style={{ width: HOUR_COLUMN }}>
          <View style={styles.header} />
          {hourLabels.map((label) => (
            <View key={label} style={styles.hourCell}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.hourText}>
                {label}
              </ThemedText>
            </View>
          ))}
        </View>
        {rows.map((row) => (
          <View
            key={row.station.id}
            accessible
            aria-label={describeStation(row, hourLabels, pollutant)}
            style={{ width: CELL_WIDTH }}>
            <View style={styles.header}>
              <ThemedText type="small" numberOfLines={2} style={styles.stationName}>
                {row.station.name}
              </ThemedText>
            </View>
            {row.hours.map((value, index) => {
              const band = value === null ? null : categoryForConcentration(pollutant, value);
              return (
                <View
                  key={hourLabels[index]}
                  style={[styles.cell, { backgroundColor: band?.color ?? theme.backgroundSelected }]}>
                  <Text style={[styles.cellText, { color: band?.textColor ?? theme.textSecondary }]}>
                    {value === null ? '–' : Math.round(value)}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function describeStation(row: HeatmapRow, hourLabels: string[], pollutant: Pollutant): string {
  const values = row.hours.flatMap((v, i) => (v === null ? [] : [{ v, label: hourLabels[i] }]));
  if (!values.length) return `${row.station.name}: no data`;
  const high = values.reduce((a, b) => (b.v > a.v ? b : a));
  const low = values.reduce((a, b) => (b.v < a.v ? b : a));
  return (
    `${row.station.name}: average ${Math.round(row.mean)} ${spokenUnitFor(pollutant)}, ` +
    `highest at ${high.label} (${Math.round(high.v)}), lowest at ${low.label} (${Math.round(low.v)})`
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: 2,
  },
  header: {
    height: 36,
    justifyContent: 'flex-end',
    paddingBottom: Spacing.one,
  },
  stationName: {
    fontSize: 11,
    lineHeight: 13,
    textAlign: 'center',
  },
  hourCell: {
    height: CELL_HEIGHT,
    marginBottom: 2,
    justifyContent: 'center',
  },
  hourText: {
    fontSize: 11,
    lineHeight: 14,
  },
  cell: {
    height: CELL_HEIGHT,
    marginBottom: 2,
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellText: {
    fontSize: 12,
    fontFamily: FontFamily[600],
  },
});
