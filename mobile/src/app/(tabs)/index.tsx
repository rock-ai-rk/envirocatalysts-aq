import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { useMeta, useOverview } from '@/api/history';
import type { Pollutant } from '@/api/live';
import type { OverviewCity } from '@/api/types';
import { ChoiceChip } from '@/components/choice-chip';
import { Legend } from '@/components/charts/legend';
import { CityMap } from '@/components/city-map';
import { CoverageBanner } from '@/components/coverage-banner';
import { DataFreshness } from '@/components/data-freshness';
import { DemoDataBanner, useScreenDataset } from '@/components/demo-data-banner';
import { FilterSummaryBar } from '@/components/filter-summary-bar';
import { FocusablePressable } from '@/components/focusable-pressable';
import { LiveCitiesCard } from '@/components/live-cities-card';
import { OfflineBanner } from '@/components/offline-banner';
import { OverviewCityRow, type RowMetric } from '@/components/overview-city-row';
import { ScreenFrame, ScreenTitle, screenStyles } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { StatusMessage } from '@/components/status-message';
import { ThemedText } from '@/components/themed-text';
import { AQI_CATEGORIES } from '@/constants/aqi';
import { DEFAULT_MIN_COVERAGE } from '@/constants/coverage';
import { PLACEHOLDER_PERIODS, periodViewOptions, type PeriodView } from '@/constants/periods';
import { CONCENTRATION_POLLUTANTS, POLLUTANT_ORDER, pollutantColor } from '@/constants/pollutants';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toOverviewParams, useOverviewFilters } from '@/state/overview-filters';

type OverviewMetric = RowMetric | 'map';

// Chips that wrap rather than a segmented control: four labels don't fit a 375pt screen
// without truncating, and they must stay readable at large text sizes.
const METRIC_OPTIONS: { value: OverviewMetric; label: string }[] = [
  { value: 'aqi_days', label: 'AQI days' },
  { value: 'pollutants', label: 'Pollutant levels' },
  { value: 'dominant', label: 'Dominant pollutant' },
  { value: 'map', label: 'Map' },
];

const AQI_LEGEND = AQI_CATEGORIES.map((c) => ({ key: c.key, label: c.label, color: c.color, category: c }));
const POLLUTANT_LEGEND = POLLUTANT_ORDER.map((p) => ({ key: p, label: p, color: pollutantColor(p).color }));

export default function OverviewScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { filters, setFilters } = useOverviewFilters();
  const meta = useMeta();
  const dataset = useScreenDataset('overview');
  const overview = useOverview(toOverviewParams(filters));
  const [view, setView] = useState<PeriodView>('base');
  const [metric, setMetric] = useState<OverviewMetric>('aqi_days');
  const [pollutant, setPollutant] = useState<Pollutant>('PM2.5');

  const data = overview.data;
  const periods = data ? { base: data.base, comparison: data.comparison } : null;
  const rowMetric: RowMetric = metric === 'map' ? 'aqi_days' : metric;

  const scaleMax = useMemo(
    () =>
      Math.max(
        1,
        ...(data?.cities ?? []).flatMap((c) => [
          c.base.pollutant_means[pollutant] ?? 0,
          c.comparison?.pollutant_means[pollutant] ?? 0,
        ]),
      ),
    [data, pollutant],
  );

  const openCity = useCallback(
    (cityId: number) => router.push({ pathname: '/city/[id]', params: { id: String(cityId) } }),
    [router],
  );
  const openCoverage = useCallback(
    (cityId: number, period: string) =>
      router.push({ pathname: '/coverage', params: { cityId: String(cityId), period } }),
    [router],
  );
  const minCoverage = data?.rules.min_coverage ?? DEFAULT_MIN_COVERAGE;

  const renderItem = useCallback(
    ({ item }: { item: OverviewCity }) =>
      periods ? (
        <OverviewCityRow
          item={item}
          metric={rowMetric}
          view={view}
          pollutant={pollutant}
          scaleMax={scaleMax}
          periods={periods}
          minCoverage={minCoverage}
          onPress={openCity}
          onCoverage={openCoverage}
        />
      ) : null,
    [periods, rowMetric, view, pollutant, scaleMax, minCoverage, openCity, openCoverage],
  );

  const header = (
    <View style={styles.header}>
      <ScreenTitle>Air quality overview</ScreenTitle>
      <OfflineBanner />
      <DemoDataBanner screen="overview" />
      <FilterSummaryBar />
      <DataFreshness query={overview} />
      <LiveCitiesCard state={filters.state} />
      <SegmentedControl
        label="Period"
        options={periodViewOptions(periods?.base ?? PLACEHOLDER_PERIODS.base, periods?.comparison ?? PLACEHOLDER_PERIODS.comparison)}
        value={view}
        onChange={setView}
      />
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
      {metric === 'pollutants' ? (
        <View role="radiogroup" aria-label="Pollutant" style={styles.chips}>
          {CONCENTRATION_POLLUTANTS.map((p) => (
            <ChoiceChip key={p} label={p} selected={pollutant === p} onPress={() => setPollutant(p)} />
          ))}
        </View>
      ) : null}
      {data ? <CoverageBanner excluded={data.excluded} periodLabel={data.base.label} /> : null}
      {metric === 'map' && data ? <CityMap cities={data.cities} view={view} onSelect={openCity} /> : null}
      {data?.cities.length ? (
        <Legend items={rowMetric === 'dominant' ? POLLUTANT_LEGEND : AQI_LEGEND} />
      ) : null}
    </View>
  );

  const empty = overview.isPending ? (
    <StatusMessage kind="loading" message="Loading cities…" />
  ) : overview.isError ? (
    meta.data && meta.data.periods.length === 0 ? (
      <StatusMessage
        kind="empty"
        title="No historical data yet"
        message="City rankings appear here once the dataset is loaded into the API."
      />
    ) : (
      <StatusMessage kind="error" message={overview.error.message} onRetry={() => overview.refetch()} />
    )
  ) : (
    <StatusMessage kind="empty" title="No cities match these filters" message="Try another state or city group." />
  );

  const hiddenCount = data && data.top !== null ? data.eligible - data.cities.length : 0;
  const footer = (
    <View style={styles.footer}>
      {hiddenCount > 0 ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {`Showing ${data!.cities.length} of ${data!.eligible} ranked cities`}
          </ThemedText>
          <FocusablePressable
            role="button"
            aria-label={`Show all ${data!.eligible} cities`}
            onPress={() => setFilters({ ...filters, top: 'all' })}
            style={[styles.showAll, { borderColor: theme.border }]}>
            <ThemedText type="smallBold">Show all</ThemedText>
          </FocusablePressable>
        </>
      ) : null}
      {/* Where these numbers come from, as the data's terms of use ask. */}
      {dataset && data?.cities.length ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.source}>
          {`Source: ${dataset.source}.`}
        </ThemedText>
      ) : null}
    </View>
  );

  return (
    <ScreenFrame>
      <FlatList
        data={data?.cities ?? []}
        keyExtractor={(item) => String(item.city.id)}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        contentContainerStyle={screenStyles.content}
      />
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.three,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  footer: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  showAll: {
    minHeight: MinTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  source: {
    textAlign: 'center',
  },
});
