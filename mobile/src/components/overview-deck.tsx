import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { Pollutant } from '@/api/live';
import type { Period } from '@/api/types';
import { ChoiceChip } from '@/components/choice-chip';
import { SegmentedControl } from '@/components/segmented-control';
import { PLACEHOLDER_PERIODS, periodViewOptions, type PeriodView } from '@/constants/periods';
import { CONCENTRATION_POLLUTANTS } from '@/constants/pollutants';
import { Spacing } from '@/constants/theme';
import { useLargeText } from '@/hooks/use-large-text';
import { useTheme } from '@/hooks/use-theme';

export type OverviewMetric = 'aqi_days' | 'pollutants' | 'dominant' | 'map';

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
}

/**
 * The Overview's controls: which year (or the change between them), which lens, and for
 * Pollutants, which pollutant. The screen pins it above the city list, so the choice stays in
 * reach while scrolling; it has its own background so rows can pass under it.
 */
export function OverviewDeck({ periods, view, onView, metric, onMetric, pollutant, onPollutant }: Props) {
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
    </View>
  );
}

/** One line of chips that scrolls sideways; at large text sizes the chips wrap instead. */
function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  const wrap = useLargeText();
  return (
    <View role="radiogroup" aria-label={label}>
      {wrap ? (
        <View style={[styles.row, styles.wrap]}>{children}</View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
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
});
