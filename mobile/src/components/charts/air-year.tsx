import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import type { AqiCategoryKey } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { AQI_CATEGORIES } from '@/constants/aqi';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { describeAqiDays } from '@/lib/describe';

const COLUMNS = 20;
const GAP = 1.5;

interface Props {
  /** Shown above the grid, e.g. "FY 24-25". */
  label: string;
  /** The period's full name, for screen readers. */
  spokenLabel: string;
  aqiDays: Record<AqiCategoryKey, number> | null;
  /** Days in the period; any not covered by aqiDays are drawn as empty squares (no data). */
  daysInPeriod: number;
}

/**
 * A year as squares: one per day, grouped by AQI category in order from Good to Severe, then the
 * days without data as empty squares. It shows the share of the year spent in each category.
 *
 * The squares are grouped, not in date order, so square N in one year isn't the same day as
 * square N in another; comparing two of these shows how the mix changed, not which days did.
 */
export function AirYear({ label, spokenLabel, aqiDays, daysInPeriod }: Props) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const colors = aqiDays
    ? AQI_CATEGORIES.flatMap((c) => Array<string>(aqiDays[c.key]).fill(c.color))
    : [];
  const missing = Math.max(0, daysInPeriod - colors.length);
  const rows = Math.ceil(Math.max(daysInPeriod, colors.length) / COLUMNS);
  const size = width ? (width - GAP * (COLUMNS - 1)) / COLUMNS : 0;
  const height = size ? rows * size + (rows - 1) * GAP : 0;
  const spoken = aqiDays
    ? `${spokenLabel}: ${describeAqiDays(aqiDays)}${missing ? `, and ${missing} days without data` : ''}.`
    : `${spokenLabel}: no data.`;

  return (
    <View style={styles.year}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View
        accessible
        role="img"
        aria-label={spoken}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={{ height: height || undefined }}>
        {size && aqiDays ? (
          <Svg width={width} height={height}>
            {Array.from({ length: colors.length + missing }, (_, day) => {
              const x = (day % COLUMNS) * (size + GAP);
              const y = Math.floor(day / COLUMNS) * (size + GAP);
              const color = colors[day];
              return color ? (
                <Rect key={day} x={x} y={y} width={size} height={size} rx={1} fill={color} />
              ) : (
                <Rect
                  key={day}
                  x={x + 0.5}
                  y={y + 0.5}
                  width={size - 1}
                  height={size - 1}
                  rx={1}
                  fill="none"
                  stroke={theme.border}
                  strokeWidth={0.75}
                />
              );
            })}
          </Svg>
        ) : !aqiDays ? (
          <ThemedText type="small" themeColor="textSecondary">
            No data
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  year: {
    flex: 1,
    gap: Spacing.one,
  },
});
