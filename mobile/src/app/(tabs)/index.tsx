import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ChoiceChip } from '@/components/choice-chip';
import { FilterSummaryBar } from '@/components/filter-summary-bar';
import { LiveCitiesCard } from '@/components/live-cities-card';
import { Screen } from '@/components/screen';
import { SectionCard } from '@/components/section-card';
import { SegmentedControl } from '@/components/segmented-control';
import { StatusMessage } from '@/components/status-message';
import {
  BASE_PERIOD,
  COMPARISON_PERIOD,
  PERIOD_VIEW_OPTIONS,
  type PeriodView,
} from '@/constants/periods';
import { Spacing } from '@/constants/theme';
import { useOverviewFilters } from '@/state/overview-filters';

type OverviewMetric = 'aqi_days' | 'pollutants' | 'dominant' | 'map';

// Chips that wrap rather than a segmented control: four labels don't fit a 375pt screen
// without truncating, and they must stay readable at large text sizes.
const METRIC_OPTIONS: { value: OverviewMetric; label: string }[] = [
  { value: 'aqi_days', label: 'AQI days' },
  { value: 'pollutants', label: 'Pollutant levels' },
  { value: 'dominant', label: 'Dominant pollutant' },
  { value: 'map', label: 'Map' },
];

const METRIC_TITLES: Record<OverviewMetric, string> = {
  aqi_days: 'AQI category days',
  pollutants: 'Average concentration',
  dominant: 'Days as dominant pollutant',
  map: 'City map',
};

function periodCaption(view: PeriodView): string {
  if (view === 'base') return BASE_PERIOD.label;
  if (view === 'comparison') return COMPARISON_PERIOD.label;
  return `Change, ${BASE_PERIOD.label} to ${COMPARISON_PERIOD.label}`;
}

export default function OverviewScreen() {
  const { filters } = useOverviewFilters();
  const [view, setView] = useState<PeriodView>('base');
  const [metric, setMetric] = useState<OverviewMetric>('aqi_days');

  return (
    <Screen title="Air quality overview">
      <FilterSummaryBar />
      <LiveCitiesCard state={filters.state} />
      <SegmentedControl label="Period" options={PERIOD_VIEW_OPTIONS} value={view} onChange={setView} />
      <View role="radiogroup" aria-label="Metric" style={styles.chips}>
        {METRIC_OPTIONS.map((option) => (
          <ChoiceChip
            key={option.value}
            label={option.label}
            selected={metric === option.value}
            onPress={() => setMetric(option.value)}
          />
        ))}
      </View>
      <SectionCard title={METRIC_TITLES[metric]} subtitle={periodCaption(view)}>
        <StatusMessage
          kind="empty"
          title="Historical data not imported yet"
          message="City rankings for FY 2024-25 and FY 2025-26 appear here once the EnviroCatalysts dataset is loaded into the API."
        />
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
