import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { Pollutant } from '@/api/live';
import type { Period } from '@/api/types';
import { ChoiceChip } from '@/components/choice-chip';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { PLACEHOLDER_PERIODS, periodViewOptions, type PeriodView } from '@/constants/periods';
import { CONCENTRATION_POLLUTANTS } from '@/constants/pollutants';
import { Spacing } from '@/constants/theme';
import { useLargeText } from '@/hooks/use-large-text';
import { useTheme } from '@/hooks/use-theme';

export type OverviewMetric = 'aqi_days' | 'pollutants' | 'dominant' | 'map';

/** What the map's dots are coloured by: each city's most common category, or a pollutant's average. */
export type MapColourBy = 'category' | 'concentration';

// Short visible labels keep the lenses on one line on a 375pt screen; the spoken labels are full.
const METRIC_OPTIONS: { value: OverviewMetric; label: string; spoken: string }[] = [
  { value: 'aqi_days', label: 'AQI days', spoken: 'AQI days' },
  { value: 'pollutants', label: 'Pollutants', spoken: 'Pollutant levels' },
  { value: 'dominant', label: 'Dominant', spoken: 'Dominant pollutant' },
  { value: 'map', label: 'Map', spoken: 'Map' },
];

interface Props {
  periods: { base: Pick<Period, 'label'>; comparison: Pick<Period, 'label'> } | null;
  view: PeriodView;
  onView: (view: PeriodView) => void;
  metric: OverviewMetric;
  onMetric: (metric: OverviewMetric) => void;
  pollutant: Pollutant;
  onPollutant: (pollutant: Pollutant) => void;
  mapColourBy: MapColourBy;
  onMapColourBy: (by: MapColourBy) => void;
}

/**
 * The Overview's controls: which year (or the change between them), which lens, for Pollutants
 * which pollutant, and for the Map what the dots are coloured by. The screen pins it above the
 * city list, so the choice stays in reach while scrolling; it has its own background so rows can
 * pass under it.
 */
export function OverviewDeck(props: Props) {
  const { periods, view, onView, metric, onMetric, pollutant, onPollutant, mapColourBy, onMapColourBy } = props;
  const theme = useTheme();
  const { base, comparison } = periods ?? PLACEHOLDER_PERIODS;

  return (
    <View style={[styles.deck, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
      <SegmentedControl
        label="Period"
        options={periodViewOptions(base, comparison)}
        value={view}
        onChange={onView}
      />
      <ChipRow label="Metric">
        {METRIC_OPTIONS.map((option) => (
          <ChoiceChip
            key={option.value}
            label={option.label}
            accessibilityLabel={option.spoken}
            selected={metric === option.value}
            onPress={() => onMetric(option.value)}
          />
        ))}
      </ChipRow>
      {metric === 'pollutants' ? (
        <ChipRow label="Pollutant">
          {CONCENTRATION_POLLUTANTS.map((p) => (
            <ChoiceChip key={p} label={p} selected={pollutant === p} onPress={() => onPollutant(p)} />
          ))}
        </ChipRow>
      ) : null}
      {/* One row for both choices: the category, or which pollutant's average. */}
      {metric === 'map' ? (
        <ChipRow label="Colour cities by" title="Colour by">
          <ChoiceChip
            label="Category"
            accessibilityLabel="AQI category with the most days"
            selected={mapColourBy === 'category'}
            onPress={() => onMapColourBy('category')}
          />
          {CONCENTRATION_POLLUTANTS.map((p) => (
            <ChoiceChip
              key={p}
              label={p}
              accessibilityLabel={`Average ${p}`}
              selected={mapColourBy === 'concentration' && pollutant === p}
              onPress={() => {
                onMapColourBy('concentration');
                onPollutant(p);
              }}
            />
          ))}
        </ChipRow>
      ) : null}
    </View>
  );
}

/**
 * One line of chips that scrolls sideways; at large text sizes the chips wrap instead. A `title`
 * is shown before the chips; screen readers hear `label` as the group's name instead.
 */
function ChipRow({ label, title, children }: { label: string; title?: string; children: ReactNode }) {
  const wrap = useLargeText();
  const heading = title ? (
    <ThemedText aria-hidden type="smallBold" themeColor="textSecondary" style={styles.title}>
      {title}
    </ThemedText>
  ) : null;
  return (
    <View role="radiogroup" aria-label={label}>
      {wrap ? (
        <View style={[styles.row, styles.wrap]}>
          {heading}
          {children}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {heading}
          {children}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  deck: {
    // Full width, so rows scrolling underneath don't show at the sides.
    marginHorizontal: -Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  wrap: {
    flexWrap: 'wrap',
  },
  title: {
    alignSelf: 'center',
  },
});
