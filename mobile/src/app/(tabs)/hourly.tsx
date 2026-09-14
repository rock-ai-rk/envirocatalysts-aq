import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useHeatmap, useHourlyCities, useHourlySummary, useMeta } from '@/api/history';
import type { HourlyPollutant } from '@/api/types';
import { HeatmapGrid } from '@/components/charts/heatmap-grid';
import { HourBars, bandsUsed } from '@/components/charts/hour-bars';
import { Legend } from '@/components/charts/legend';
import { MonthBoxes } from '@/components/charts/month-boxes';
import { ChoiceChip } from '@/components/choice-chip';
import { DataFreshness } from '@/components/data-freshness';
import { DemoDataBanner } from '@/components/demo-data-banner';
import { FocusablePressable } from '@/components/focusable-pressable';
import { KpiGrid } from '@/components/kpi-grid';
import { LiveReadingCard } from '@/components/live-reading-card';
import { OfflineBanner } from '@/components/offline-banner';
import { Screen } from '@/components/screen';
import { SectionCard } from '@/components/section-card';
import { SegmentedControl } from '@/components/segmented-control';
import { StatusMessage } from '@/components/status-message';
import { ThemedText } from '@/components/themed-text';
import { TrendCard } from '@/components/trend-card';
import {
  PLACEHOLDER_PERIODS,
  periodViewOptions,
  shortPeriodLabel,
  type PeriodView,
} from '@/constants/periods';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { describeExceedance, describeHourProfile } from '@/lib/describe';
import { formatDay } from '@/lib/format';
import { resolveStation, useHourlySelection } from '@/state/hourly-selection';
import { useOverviewFilters } from '@/state/overview-filters';

const POLLUTANTS: HourlyPollutant[] = ['PM2.5', 'PM10', 'NO2', 'SO2', 'CO', 'O3'];

/**
 * One station at a time: its live reading first, then its history for the chosen financial year.
 */
export default function HourlyScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { filters } = useOverviewFilters();
  const { selection, select } = useHourlySelection();
  const [view, setView] = useState<PeriodView>('base');
  const cities = useHourlyCities();
  const meta = useMeta();

  const resolved = resolveStation(cities.data, selection);
  const entry = resolved?.entry;
  const station = resolved?.station ?? null;
  const cityId = entry?.city.id ?? null;
  const { pollutant } = selection;
  const basePeriod = meta.data?.periods.find((p) => p.key === filters.base);
  const comparisonPeriod = meta.data?.periods.find((p) => p.key === filters.comparison);

  const summary = useHourlySummary(
    cityId === null || station === null
      ? null
      : { cityId, stationId: station.id, pollutant, base: filters.base, comparison: filters.comparison },
  );
  const heatmap = useHeatmap(
    cityId === null
      ? null
      : { cityId, pollutant, period: view === 'comparison' ? filters.comparison : filters.base, top: 5 },
  );

  const data = summary.data;
  // "Change" shows the comparison period, with deltas from the base.
  const shown = data ? (view === 'base' ? data.base : data.comparison) : null;
  const baseline = data && view === 'change' ? data.base : undefined;

  return (
    <Screen title="Hourly analysis">
      <OfflineBanner />
      <DemoDataBanner />

      <FocusablePressable
        role="button"
        aria-label={`Showing ${entry && station ? `${station.name}, ${entry.city.name}` : 'no station'}. Change station`}
        onPress={() => router.push('/station-picker')}
        disabled={!entry}
        style={[styles.place, { borderColor: theme.border }]}>
        <View style={styles.placeText}>
          <ThemedText type="small" themeColor="textSecondary">
            Station
          </ThemedText>
          <ThemedText type="sectionTitle" numberOfLines={2}>
            {entry && station ? `${station.name} · ${entry.city.name}` : 'No stations yet'}
          </ThemedText>
        </View>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          Change
        </ThemedText>
      </FocusablePressable>

      {station ? <LiveReadingCard stationId={station.id} /> : null}

      <ThemedText type="sectionTitle" role="heading" style={styles.historyHeading}>
        History
      </ThemedText>
      <DataFreshness query={summary} />

      <View role="radiogroup" aria-label="Pollutant" style={styles.chips}>
        {POLLUTANTS.map((p) => (
          <ChoiceChip key={p} label={p} selected={p === pollutant} onPress={() => select({ pollutant: p })} />
        ))}
      </View>

      <SegmentedControl
        label="Period"
        options={periodViewOptions(basePeriod ?? PLACEHOLDER_PERIODS.base, comparisonPeriod ?? PLACEHOLDER_PERIODS.comparison)}
        value={view}
        onChange={setView}
      />

      {station && basePeriod && comparisonPeriod ? (
        <TrendCard
          station={station}
          pollutant={pollutant}
          view={view}
          base={basePeriod}
          comparison={comparisonPeriod}
        />
      ) : null}

      {cities.isError ? (
        <StatusMessage kind="error" message={cities.error.message} onRetry={() => cities.refetch()} />
      ) : cities.data && cities.data.length === 0 ? (
        <StatusMessage
          kind="empty"
          title="No hourly station data yet"
          message="Hourly patterns appear here once station data is loaded into the API."
        />
      ) : summary.isError ? (
        <StatusMessage kind="error" message={summary.error.message} onRetry={() => summary.refetch()} />
      ) : !data || !shown ? (
        <StatusMessage kind="loading" message="Loading hourly data…" />
      ) : (
        <>
          <KpiGrid
            period={shown}
            from={baseline}
            pollutant={pollutant}
            unit={data.unit}
            thresholds={data.thresholds}
          />

          <HourPatternCard
            data={data}
            view={view}
            pollutant={pollutant}
          />

          <SectionCard
            title="Month by month"
            subtitle={`${shown.period.label}. Line: 10th–90th percentile of hours; box: middle half; bar: median.`}>
            {shown.months.length ? (
              <MonthBoxes
                months={shown.months}
                pollutant={pollutant}
                summary={describeMonths(shown.months, pollutant, shown.period.label)}
              />
            ) : (
              <StatusMessage kind="empty" title="No data for this period" />
            )}
          </SectionCard>

          <SectionCard
            title={`Stations by hour of day`}
            subtitle={`${entry?.city.name}, ${view === 'comparison' ? data.comparison.period.label : data.base.period.label}. Highest-average stations first.`}>
            {heatmap.data && heatmap.data.rows.length ? (
              <>
                <HeatmapGrid rows={heatmap.data.rows} hourLabels={heatmap.data.hour_labels} pollutant={pollutant} />
                {heatmap.data.stations_total > heatmap.data.rows.length ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {`Top ${heatmap.data.rows.length} of ${heatmap.data.stations_total} stations`}
                  </ThemedText>
                ) : null}
              </>
            ) : heatmap.isError ? (
              <StatusMessage kind="error" message={heatmap.error.message} onRetry={() => heatmap.refetch()} />
            ) : (
              <StatusMessage kind="loading" />
            )}
          </SectionCard>

          {shown.peak_day ? (
            <FocusablePressable
              role="button"
              aria-label={`See every station on the worst day, ${formatDay(shown.peak_day)}`}
              onPress={() =>
                router.push({
                  pathname: '/hourly-day',
                  params: { cityId: String(cityId), pollutant, day: shown.peak_day! },
                })
              }
              style={[styles.secondaryButton, { borderColor: theme.border }]}>
              <ThemedText type="smallBold">{`Worst day: ${formatDay(shown.peak_day)} →`}</ThemedText>
            </FocusablePressable>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function HourPatternCard({
  data,
  view,
  pollutant,
}: {
  data: NonNullable<ReturnType<typeof useHourlySummary>['data']>;
  view: PeriodView;
  pollutant: HourlyPollutant;
}) {
  const primary = view === 'comparison' ? data.comparison : data.base;
  const overlay = view === 'change' ? data.comparison : undefined;
  const summary = [
    describeHourProfile(primary.hours, pollutant, primary.period.label),
    overlay ? describeHourProfile(overlay.hours, pollutant, overlay.period.label) : null,
    describeExceedance(overlay ?? primary, pollutant),
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <SectionCard
      title="Hour of day"
      subtitle={
        overlay
          ? `Bars: ${shortPeriodLabel(primary.period.label)}. Marks: ${shortPeriodLabel(overlay.period.label)}.`
          : `Average for each hour, ${primary.period.label}`
      }>
      <ThemedText type="small">{summary}</ThemedText>
      <HourBars
        hours={primary.hours}
        comparison={overlay?.hours}
        pollutant={pollutant}
        thresholds={data.thresholds}
        summary={summary}
      />
      <Legend
        items={bandsUsed(pollutant, primary.hours).map((c) => ({
          key: c.key,
          label: c.label,
          color: c.color,
          category: c,
        }))}
      />
    </SectionCard>
  );
}

function describeMonths(
  months: NonNullable<ReturnType<typeof useHourlySummary>['data']>['base']['months'],
  pollutant: HourlyPollutant,
  periodLabel: string,
): string {
  const worst = months.reduce((a, b) => (b.median > a.median ? b : a));
  const best = months.reduce((a, b) => (b.median < a.median ? b : a));
  return (
    `${periodLabel}: median ${pollutant} is highest in ${formatDay(worst.month).split(' ').slice(1).join(' ')} ` +
    `at ${Math.round(worst.median)} and lowest in ${formatDay(best.month).split(' ').slice(1).join(' ')} at ${Math.round(best.median)}.`
  );
}

const styles = StyleSheet.create({
  place: {
    minHeight: MinTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  placeText: {
    flex: 1,
  },
  historyHeading: {
    marginTop: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  secondaryButton: {
    minHeight: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
});
