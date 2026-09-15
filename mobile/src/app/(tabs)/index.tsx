import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { useMeta, useOverview } from '@/api/history';
import type { Pollutant } from '@/api/live';
import type { OverviewCity } from '@/api/types';
import { Legend } from '@/components/charts/legend';
import { CityMap } from '@/components/city-map';
import { useScreenDataset } from '@/components/demo-data-banner';
import { FilterSummaryBar } from '@/components/filter-summary-bar';
import { FocusablePressable } from '@/components/focusable-pressable';
import { LiveCitiesCard } from '@/components/live-cities-card';
import { OverviewDeck, type OverviewMetric } from '@/components/overview-deck';
import { OverviewCityRow, type RowMetric } from '@/components/overview-city-row';
import { ScreenFrame, ScreenTitle, screenStyles } from '@/components/screen';
import { StatusCapsules } from '@/components/status-capsules';
import { StatusMessage } from '@/components/status-message';
import { ThemedText } from '@/components/themed-text';
import { VerdictCard } from '@/components/verdict-card';
import { AQI_CATEGORIES } from '@/constants/aqi';
import { DEFAULT_MIN_COVERAGE } from '@/constants/coverage';
import { PLACEHOLDER_PERIODS, shortPeriodLabel, type PeriodView } from '@/constants/periods';
import { POLLUTANT_ORDER, pollutantColor } from '@/constants/pollutants';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { useLargeText } from '@/hooks/use-large-text';
import { useTheme } from '@/hooks/use-theme';
import { describeVerdict } from '@/lib/describe';
import { toOverviewParams, useOverviewFilters } from '@/state/overview-filters';

/**
 * The list's items: the controls deck (pinned while scrolling), the map for the Map lens, the
 * colour key, then one row per city.
 */
type ListItem =
  | { kind: 'deck' }
  | { kind: 'map' }
  | { kind: 'legend' }
  | { kind: 'city'; city: OverviewCity };

// The deck is the first item; index 0 is the list header.
const DECK_INDEX = 1;

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
  // At large text sizes the controls take up much of the screen, so they scroll away instead.
  const largeText = useLargeText();

  const data = overview.data;
  const cities = useMemo(() => data?.cities ?? [], [data]);
  const periods = data ? { base: data.base, comparison: data.comparison } : null;
  const rowMetric: RowMetric = metric === 'map' ? 'aqi_days' : metric;
  const { base, comparison } = periods ?? PLACEHOLDER_PERIODS;

  const verdict = useMemo(
    () =>
      data
        ? describeVerdict(
            data.cities,
            metric === 'pollutants' ? { kind: 'pollutant', pollutant } : { kind: 'good_days' },
            shortPeriodLabel(data.comparison.label),
          )
        : null,
    [data, metric, pollutant],
  );

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

  const deck = (
    <OverviewDeck
      periods={periods}
      view={view}
      onView={setView}
      metric={metric}
      onMetric={setMetric}
      pollutant={pollutant}
      onPollutant={setPollutant}
    />
  );

  const items = useMemo<ListItem[]>(
    () =>
      cities.length
        ? [
            { kind: 'deck' },
            ...(metric === 'map' ? [{ kind: 'map' as const }] : []),
            { kind: 'legend' },
            ...cities.map((city) => ({ kind: 'city' as const, city })),
          ]
        : [],
    [cities, metric],
  );

  const renderItem = ({ item }: { item: ListItem }) => {
    switch (item.kind) {
      case 'deck':
        return deck;
      case 'map':
        return <CityMap cities={cities} view={view} onSelect={openCity} />;
      case 'legend':
        return <Legend items={rowMetric === 'dominant' ? POLLUTANT_LEGEND : AQI_LEGEND} />;
      case 'city':
        return periods ? (
          <OverviewCityRow
            item={item.city}
            metric={rowMetric}
            view={view}
            pollutant={pollutant}
            scaleMax={scaleMax}
            periods={periods}
            minCoverage={minCoverage}
            onPress={openCity}
            onCoverage={openCoverage}
          />
        ) : null;
    }
  };

  // Answer first (the verdict), then what's happening now, then the controls and the list.
  const header = (
    <View style={styles.header}>
      <View>
        <ThemedText
          type="smallBold"
          themeColor="textSecondary"
          aria-label={`Comparing ${base.label} with ${comparison.label}`}
          style={styles.eyebrow}>
          {`${base.label}  →  ${comparison.label}`}
        </ThemedText>
        <ScreenTitle>Air quality</ScreenTitle>
      </View>
      <FilterSummaryBar />
      <StatusCapsules
        query={overview}
        demo={Boolean(dataset?.synthetic)}
        notRanked={data ? { count: data.excluded.length, periodLabel: data.base.label } : null}
      />
      {verdict ? (
        <VerdictCard verdict={verdict} showingChange={view === 'change'} onShowChange={() => setView('change')} />
      ) : null}
      <LiveCitiesCard state={filters.state} group={filters.group} />
      {/* Without cities there is no list to pin the controls over, so they sit here. */}
      {cities.length ? null : deck}
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
        data={items}
        keyExtractor={(item) => (item.kind === 'city' ? String(item.city.city.id) : item.kind)}
        renderItem={renderItem}
        stickyHeaderIndices={items.length && !largeText ? [DECK_INDEX] : undefined}
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
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 1,
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
    borderRadius: 999,
    borderWidth: 1,
  },
  source: {
    textAlign: 'center',
  },
});
