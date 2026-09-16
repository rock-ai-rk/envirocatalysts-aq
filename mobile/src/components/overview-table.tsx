import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { Pollutant } from '@/api/live';
import type { AqiCategoryKey, CityPeriodStats, OverviewCity, Period } from '@/api/types';
import { CategorySwatch } from '@/components/aqi-badge';
import { FocusablePressable } from '@/components/focusable-pressable';
import type { RowMetric } from '@/components/overview-city-row';
import { ThemedText } from '@/components/themed-text';
import { AQI_CATEGORIES, type AqiCategory } from '@/constants/aqi';
import type { PeriodView } from '@/constants/periods';
import { CONCENTRATION_POLLUTANTS, POLLUTANT_ORDER, spokenUnitFor } from '@/constants/pollutants';
import { Radius, Spacing } from '@/constants/theme';
import { useLargeText } from '@/hooks/use-large-text';
import { useTheme } from '@/hooks/use-theme';
import { formatNumber, formatPercent, formatSigned } from '@/lib/format';

// Sizes at the default text size. They grow with the user's text size, up to MAX_SCALE, so the
// numbers never overflow their cells.
const MAX_SCALE = 2;
const NAME_WIDTH = 172;
const CELL_WIDTH = 58;
// Two lines of small text, so a long name wraps rather than losing its end; also a full touch target.
const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 44;

/** The figures a row shows: one period's, or the change between the two (same shape). */
type Figures = Pick<CityPeriodStats, 'aqi_days' | 'pollutant_means' | 'dominant_days' | 'coverage'>;

interface Column {
  key: string;
  header: string;
  /** Read before the value: "Good", "PM2.5". */
  spoken: string;
  /** Read after the value: "days", "micrograms per cubic metre". */
  spokenUnit: string;
  category?: AqiCategory;
  value: (figures: Figures) => number | undefined;
  digits: number;
}

const AQI_HEADERS: Record<AqiCategoryKey, string> = {
  good: 'Good',
  satisfactory: 'Satis.',
  moderate: 'Mod.',
  poor: 'Poor',
  very_poor: 'V. poor',
  severe: 'Severe',
};

interface Props {
  cities: OverviewCity[];
  metric: RowMetric;
  view: PeriodView;
  periods: { base: Period; comparison: Period };
  onPress: (cityId: number) => void;
}

/**
 * The Overview's numbers as a table, for anyone who would rather read figures than bars: every
 * category (or pollutant) in its own column, for the chosen year or as the change between the two.
 * The city column stays put while the numbers scroll sideways. Each row is one screen-reader
 * element that reads the whole row, and opens the city like a chart row does.
 */
export function OverviewTable({ cities, metric, view, periods, onPress }: Props) {
  const theme = useTheme();
  const largeText = useLargeText();
  const scale = Math.min(useWindowDimensions().fontScale, MAX_SCALE);
  const columns = useMemo(() => columnsFor(metric, cities), [metric, cities]);
  const size = {
    name: Math.round(NAME_WIDTH * scale),
    cell: Math.round(CELL_WIDTH * scale),
    row: Math.round(ROW_HEIGHT * scale),
    header: Math.round(HEADER_HEIGHT * scale),
  };
  const periodLabel = view === 'comparison' ? periods.comparison.label : periods.base.label;
  const stripe = (index: number) => (index % 2 ? theme.background : theme.backgroundElement);

  // Coverage is a share of days, so it has no meaningful "change" column.
  const shown = view === 'change' ? columns : [...columns, COVERAGE];

  const figuresFor = (item: OverviewCity): Figures | null =>
    view === 'base' ? item.base : view === 'comparison' ? item.comparison : item.change;

  // PM2.5 under the sensor-fault floor is left out, as the chart rows leave it out.
  const hidden = (item: OverviewCity, column: Column) =>
    column.key === 'PM2.5' &&
    metric === 'pollutants' &&
    (view === 'base'
      ? item.base.pm25_below_floor
      : view === 'comparison'
        ? Boolean(item.comparison?.pm25_below_floor)
        : item.base.pm25_below_floor || Boolean(item.comparison?.pm25_below_floor));

  const cellText = (item: OverviewCity, column: Column): string => {
    const figures = figuresFor(item);
    const value = figures ? column.value(figures) : undefined;
    if (value === undefined || hidden(item, column)) return '–';
    if (column === COVERAGE) return formatPercent(value);
    return view === 'change' ? formatSigned(value, column.digits) : formatNumber(value, column.digits);
  };

  const spokenRow = (item: OverviewCity): string => {
    const intro = `${item.rank}. ${item.city.name}, ${item.city.state}.`;
    if (!figuresFor(item)) return `${intro} No data for ${periods.comparison.label}.`;
    const cells = shown.map((column) => {
      const text = cellText(item, column);
      if (text === '–') return `${column.spoken} not available`;
      if (column === COVERAGE) return `data on ${text} of days`;
      return `${column.spoken} ${text} ${column.spokenUnit}`;
    });
    const scope =
      view === 'change' ? `Change from ${periods.base.label} to ${periods.comparison.label}` : periodLabel;
    return `${intro} ${scope}: ${cells.join(', ')}.`;
  };

  const caption = (
    <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
      {captionFor(metric, view, periods)}
    </ThemedText>
  );

  // At large text sizes one column already fills the screen, so the table becomes a block per
  // city: the name, then each column as a label and its value.
  if (largeText) {
    return (
      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        {caption}
        {cities.map((item, index) => (
          <FocusablePressable
            key={item.city.id}
            role="button"
            aria-label={spokenRow(item)}
            accessibilityHint="Opens this city's details"
            onPress={() => onPress(item.city.id)}
            style={[styles.block, { backgroundColor: stripe(index) }]}>
            <ThemedText type="smallBold">{`${item.rank}. ${item.city.name}`}</ThemedText>
            {shown.map((column) => (
              <View key={column.key} style={styles.blockLine}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.blockLabel}>
                  {column.header}
                </ThemedText>
                <ThemedText type="smallBold">{cellText(item, column)}</ThemedText>
              </View>
            ))}
          </FocusablePressable>
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      {caption}
      <View style={styles.table}>
        <View style={{ width: size.name }}>
          <View aria-hidden style={[styles.nameHeader, { height: size.header }]}>
            <ThemedText type="smallBold" themeColor="textSecondary" maxFontSizeMultiplier={MAX_SCALE}>
              City
            </ThemedText>
          </View>
          {cities.map((item, index) => (
            <FocusablePressable
              key={item.city.id}
              role="button"
              aria-label={spokenRow(item)}
              accessibilityHint="Opens this city's details"
              onPress={() => onPress(item.city.id)}
              style={[styles.nameCell, { height: size.row, backgroundColor: stripe(index) }]}>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                maxFontSizeMultiplier={MAX_SCALE}
                style={styles.rank}>
                {item.rank}
              </ThemedText>
              <ThemedText type="smallBold" numberOfLines={2} maxFontSizeMultiplier={MAX_SCALE} style={styles.name}>
                {item.city.name}
              </ThemedText>
            </FocusablePressable>
          ))}
        </View>

        {/* Screen readers get every number from the city cell's label, so this part is hidden. */}
        <ScrollView horizontal aria-hidden showsHorizontalScrollIndicator style={styles.numbers}>
          <View>
            <View style={[styles.row, { height: size.header }]}>
              {shown.map((column) => (
                <View key={column.key} style={[styles.headerCell, { width: size.cell }]}>
                  {column.category ? <CategorySwatch category={column.category} /> : null}
                  <ThemedText
                    type="smallBold"
                    themeColor="textSecondary"
                    numberOfLines={1}
                    maxFontSizeMultiplier={MAX_SCALE}>
                    {column.header}
                  </ThemedText>
                </View>
              ))}
            </View>
            {cities.map((item, index) => (
              <Pressable
                key={item.city.id}
                onPress={() => onPress(item.city.id)}
                style={({ pressed }) => [
                  styles.row,
                  { height: size.row, backgroundColor: stripe(index) },
                  pressed && styles.pressed,
                ]}>
                {shown.map((column) => (
                  <ThemedText
                    key={column.key}
                    type="small"
                    maxFontSizeMultiplier={MAX_SCALE}
                    style={[styles.valueCell, { width: size.cell }]}>
                    {cellText(item, column)}
                  </ThemedText>
                ))}
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const COVERAGE: Column = {
  key: 'coverage',
  header: 'Data',
  spoken: 'data',
  spokenUnit: 'of days',
  value: (figures) => figures.coverage,
  digits: 0,
};

function columnsFor(metric: RowMetric, cities: OverviewCity[]): Column[] {
  if (metric === 'aqi_days') {
    return AQI_CATEGORIES.map((category) => ({
      key: category.key,
      header: AQI_HEADERS[category.key],
      spoken: category.label,
      spokenUnit: 'days',
      category,
      value: (figures) => figures.aqi_days[category.key],
      digits: 0,
    }));
  }
  if (metric === 'pollutants') {
    return CONCENTRATION_POLLUTANTS.map((pollutant) => ({
      key: pollutant,
      header: pollutant,
      spoken: pollutant,
      spokenUnit: spokenUnitFor(pollutant),
      value: (figures) => figures.pollutant_means[pollutant],
      digits: pollutant === 'CO' ? 2 : 0,
    }));
  }
  // Dominant pollutant: only the pollutants that led on at least one day in either year.
  const seen = (pollutant: Pollutant) =>
    cities.some(
      (c) => (c.base.dominant_days[pollutant] ?? 0) > 0 || (c.comparison?.dominant_days[pollutant] ?? 0) > 0,
    );
  return POLLUTANT_ORDER.filter(seen).map((pollutant) => ({
    key: pollutant,
    header: pollutant,
    spoken: pollutant,
    spokenUnit: 'days',
    value: (figures) => figures.dominant_days[pollutant] ?? 0,
    digits: 0,
  }));
}

function captionFor(metric: RowMetric, view: PeriodView, periods: { base: Period; comparison: Period }): string {
  const what =
    metric === 'aqi_days'
      ? 'Days in each AQI category'
      : metric === 'pollutants'
        ? 'Yearly average, µg/m³ (CO in mg/m³)'
        : 'Days each pollutant was dominant';
  const scope =
    view === 'change'
      ? `Change from ${periods.base.label} to ${periods.comparison.label}`
      : (view === 'base' ? periods.base : periods.comparison).label;
  return `${scope}. ${what}. Tap a city for its details.`;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.medium,
    paddingVertical: Spacing.two,
    overflow: 'hidden',
  },
  caption: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  table: {
    flexDirection: 'row',
  },
  nameHeader: {
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.one,
  },
  nameCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.one,
  },
  rank: {
    minWidth: 20,
    textAlign: 'right',
  },
  name: {
    flex: 1,
  },
  numbers: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerCell: {
    height: '100%',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: 2,
    paddingRight: Spacing.one,
    paddingBottom: Spacing.one,
  },
  valueCell: {
    textAlign: 'right',
    paddingRight: Spacing.one,
    fontVariant: ['tabular-nums'],
  },
  pressed: {
    opacity: 0.7,
  },
  block: {
    padding: Spacing.three,
    gap: Spacing.one,
  },
  blockLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  blockLabel: {
    flexShrink: 1,
  },
});
