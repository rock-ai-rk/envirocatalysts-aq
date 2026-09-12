import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useHeatmap, useHourlyCities, useHourlySummary } from '@/api/history';
import type { HourlyPollutant } from '@/api/types';
import { HeatmapGrid } from '@/components/charts/heatmap-grid';
import { HourBars, bandsUsed } from '@/components/charts/hour-bars';
import { Legend } from '@/components/charts/legend';
import { MonthBoxes } from '@/components/charts/month-boxes';
import { ChoiceChip } from '@/components/choice-chip';
import { DemoDataBanner } from '@/components/demo-data-banner';
import { FocusablePressable } from '@/components/focusable-pressable';
import { KpiGrid } from '@/components/kpi-grid';
import { Screen } from '@/components/screen';
import { SectionCard } from '@/components/section-card';
import { SegmentedControl } from '@/components/segmented-control';
import { StationReadingsCard } from '@/components/station-readings-card';
import { StatusMessage } from '@/components/status-message';
import { ThemedText } from '@/components/themed-text';
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
import { useHourlySelection } from '@/state/hourly-selection';
import { useOverviewFilters } from '@/state/overview-filters';

const POLLUTANTS: HourlyPollutant[] = ['PM2.5', 'PM10', 'NO2', 'SO2', 'CO', 'O3'];
// The source dashboard opens on Delhi; fall back to the first city with stations.
const PREFERRED_CITY = 'Delhi';

export default function HourlyScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { filters } = useOverviewFilters();
  const { selection, select } = useHourlySelection();
  const [view, setView] = useState<PeriodView>('base');
  const cities = useHourlyCities();

  const entry =
    cities.data?.find((c) => c.city.id === selection.cityId) ??
    cities.data?.find((c) => c.city.name === PREFERRED_CITY) ??
    cities.data?.[0];
  const cityId = entry?.city.id ?? null;
  const station = entry?.stations.find((s) => s.id === selection.stationId) ?? null;
  const { pollutant } = selection;

  const summary = useHourlySummary(
    cityId === null
      ? null
      : { cityId, stationId: station?.id ?? null, pollutant, base: filters.base, comparison: filters.comparison },
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
      <DemoDataBanner />

      <FocusablePressable
        role="button"
        aria-label={`Showing ${entry ? `${entry.city.name}, ${station ? station.name : 'city average'}` : 'no city'}. Change city or station`}
        onPress={() => router.push('/station-picker')}
        disabled={!entry}
        style={[styles.place, { borderColor: theme.border }]}>
        <View style={styles.placeText}>
          <ThemedText type="small" themeColor="textSecondary">
            City · station
          </ThemedText>
          <ThemedText type="sectionTitle" numberOfLines={2}>
            {entry ? `${entry.city.name} · ${station ? station.name : 'City average'}` : 'No stations yet'}
          </ThemedText>
        </View>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          Change
        </ThemedText>
      </FocusablePressable>

      <View role="radiogroup" aria-label="Pollutant" style={styles.chips}>
        {POLLUTANTS.map((p) => (
          <ChoiceChip key={p} label={p} selected={p === pollutant} onPress={() => select({ pollutant: p })} />
        ))}
      </View>

      {entry ? <StationReadingsCard city={entry.city.name} pollutant={pollutant} /> : null}

      <SegmentedControl
        label="Period"
        options={periodViewOptions(data?.base.period ?? PLACEHOLDER_PERIODS.base, data?.comparison.period ?? PLACEHOLDER_PERIODS.comparison)}
        value={view}
        onChange={setView}
      />

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
      <Legend items={bandsUsed(pollutant, primary.hours).map((c) => ({ key: c.key, label: c.label, color: c.color }))} />
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
