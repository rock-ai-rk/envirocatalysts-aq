import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useCityDetail, useMeta } from '@/api/history';
import type { AqiCategoryKey, CityChange, CityPeriodStats } from '@/api/types';
import { AirYear } from '@/components/charts/air-year';
import { ComparisonTable, type ComparisonRow } from '@/components/comparison-table';
import { CoverageChip } from '@/components/coverage-chip';
import { DeltaChip, describeDelta } from '@/components/delta-chip';
import { DemoDataBanner } from '@/components/demo-data-banner';
import { FocusablePressable } from '@/components/focusable-pressable';
import { SectionCard } from '@/components/section-card';
import { SkeletonChart, SkeletonLines } from '@/components/skeleton';
import { StatusMessage } from '@/components/status-message';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AQI_CATEGORIES } from '@/constants/aqi';
import { DEFAULT_MIN_COVERAGE } from '@/constants/coverage';
import { shortPeriodLabel } from '@/constants/periods';
import {
  CONCENTRATION_POLLUTANTS,
  POLLUTANT_ORDER,
  pollutantColor,
  spokenUnitFor,
  unitFor,
} from '@/constants/pollutants';
import { MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import { useLargeText } from '@/hooks/use-large-text';
import { useTheme } from '@/hooks/use-theme';
import { formatNumber } from '@/lib/format';
import { useHourlySelection } from '@/state/hourly-selection';
import { GROUP_LABELS, useOverviewFilters } from '@/state/overview-filters';

// More good days is better and more poor-or-worse days is worse; a shift in satisfactory or
// moderate days could go either way, so those changes get no verdict.
const CATEGORY_DIRECTION: Record<AqiCategoryKey, boolean | null> = {
  good: true,
  satisfactory: null,
  moderate: null,
  poor: false,
  very_poor: false,
  severe: false,
};

/**
 * Everything about one city for both periods. Opened from any Overview row or from the list of
 * cities that weren't ranked, so it works whether or not the city qualified.
 */
export default function CityDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { filters } = useOverviewFilters();
  const { select } = useHourlySelection();
  const { data, isPending, isError, error, refetch } = useCityDetail(
    Number(id),
    filters.base,
    filters.comparison,
  );
  const minCoverage = useMeta().data?.rules.min_coverage ?? DEFAULT_MIN_COVERAGE;
  const largeText = useLargeText();

  if (isPending) {
    return (
      <Frame title="City">
        <SkeletonLines label="Loading this city" lines={2} />
        <SkeletonChart label="Loading the year in days" height={200} />
      </Frame>
    );
  }
  if (isError) {
    return (
      <Frame title="City">
        <StatusMessage kind="error" message={error.message} onRetry={() => refetch()} />
      </Frame>
    );
  }

  const { city, base_stats: base, comparison_stats: comparison, change } = data;
  const baseLabel = shortPeriodLabel(data.base.label);
  const comparisonLabel = shortPeriodLabel(data.comparison.label);
  const periodsSpoken = { base: data.base.label, comparison: data.comparison.label };

  return (
    <Frame title={city.name}>
      <DemoDataBanner screen="overview" />
      <View>
        <ThemedText type="screenTitle" role="heading">
          {city.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {[city.state, ...city.groups.map((g) => GROUP_LABELS[g])].join(' · ')}
        </ThemedText>
      </View>

      <SectionCard title="Data coverage">
        <View style={styles.coverage}>
          {[
            { period: data.base, label: baseLabel, stats: base },
            { period: data.comparison, label: comparisonLabel, stats: comparison },
          ].map(({ period, label, stats }) =>
            stats ? (
              <CoverageChip
                key={period.key}
                prefix={label}
                coverage={stats.coverage}
                minCoverage={minCoverage}
                pm25BelowFloor={stats.pm25_below_floor}
                onPress={() =>
                  router.push({ pathname: '/coverage', params: { cityId: String(city.id), period: period.key } })
                }
              />
            ) : (
              <ThemedText key={period.key} type="small" themeColor="textSecondary">
                {`${label}: no data`}
              </ThemedText>
            ),
          )}
        </View>
      </SectionCard>

      {/* The two years as pictures first; the table below has the exact numbers and changes. */}
      <SectionCard
        title="The year in days"
        subtitle="Each square is one day, grouped by category (not in date order). Empty squares: no data.">
        <View style={[styles.years, largeText && styles.yearsStacked]}>
          <AirYear
            label={baseLabel}
            spokenLabel={data.base.label}
            aqiDays={base?.aqi_days ?? null}
            daysInPeriod={data.base.days}
          />
          <AirYear
            label={comparisonLabel}
            spokenLabel={data.comparison.label}
            aqiDays={comparison?.aqi_days ?? null}
            daysInPeriod={data.comparison.days}
          />
        </View>
      </SectionCard>

      <SectionCard title="AQI category days">
        <ComparisonTable
          baseLabel={baseLabel}
          comparisonLabel={comparisonLabel}
          rows={AQI_CATEGORIES.map((c) => ({
            ...countRow(
              c.key,
              c.label,
              c.color,
              base?.aqi_days[c.key],
              comparison?.aqi_days[c.key],
              change?.aqi_days[c.key],
              CATEGORY_DIRECTION[c.key],
              periodsSpoken,
            ),
            category: c,
          }))}
        />
      </SectionCard>

      <SectionCard title="Average concentration">
        <ComparisonTable
          baseLabel={baseLabel}
          comparisonLabel={comparisonLabel}
          rows={CONCENTRATION_POLLUTANTS.map((p) => concentrationRow(p, base, comparison, change, periodsSpoken))}
        />
      </SectionCard>

      <SectionCard title="Days as dominant pollutant">
        <ComparisonTable
          baseLabel={baseLabel}
          comparisonLabel={comparisonLabel}
          rows={POLLUTANT_ORDER.filter(
            (p) => base?.dominant_days[p] || comparison?.dominant_days[p],
          ).map((p) =>
            countRow(
              p,
              p,
              pollutantColor(p).color,
              base?.dominant_days[p] ?? 0,
              comparison?.dominant_days[p] ?? 0,
              change?.dominant_days[p],
              null,
              periodsSpoken,
            ),
          )}
        />
      </SectionCard>

      {data.has_hourly_data ? (
        <FocusablePressable
          role="button"
          aria-label={`Open hourly analysis for ${city.name}`}
          onPress={() => {
            select({ cityId: city.id, stationId: null });
            router.dismissTo('/hourly');
          }}
          style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
          <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
            Open hourly analysis
          </ThemedText>
        </FocusablePressable>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          No hourly station data for this city.
        </ThemedText>
      )}
    </Frame>
  );
}

/** A row of day counts. `higherIsBetter` is null where more days is neither good nor bad. */
function countRow(
  key: string,
  label: string,
  swatch: string,
  base: number | undefined,
  comparison: number | undefined,
  delta: number | undefined,
  higherIsBetter: boolean | null,
  periods: { base: string; comparison: string },
): ComparisonRow {
  const spokenChange =
    delta === undefined
      ? ''
      : higherIsBetter === null
        ? `, ${delta === 0 ? 'no change' : `${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)}`}`
        : `, ${describeDelta(delta, 'days', higherIsBetter)}`;
  return {
    key,
    label,
    swatch,
    base: base === undefined ? '–' : String(base),
    comparison: comparison === undefined ? '–' : String(comparison),
    change:
      delta === undefined || higherIsBetter === null ? null : (
        <DeltaChip delta={delta} unit="days" higherIsBetter={higherIsBetter} />
      ),
    spoken: `${label}: ${base ?? 'no data'} days in ${periods.base}, ${comparison ?? 'no data'} in ${periods.comparison}${spokenChange}.`,
  };
}

function concentrationRow(
  pollutant: (typeof CONCENTRATION_POLLUTANTS)[number],
  base: CityPeriodStats | null,
  comparison: CityPeriodStats | null,
  change: CityChange | null,
  periods: { base: string; comparison: string },
): ComparisonRow {
  const digits = pollutant === 'CO' ? 2 : 1;
  const before = base?.pollutant_means[pollutant];
  const after = comparison?.pollutant_means[pollutant];
  const delta = change?.pollutant_means[pollutant];
  const unit = unitFor(pollutant);
  const spokenUnit = spokenUnitFor(pollutant);
  const floorNote = pollutant === 'PM2.5' && base?.pm25_below_floor ? ' (likely sensor fault)' : '';
  let changeNode: ReactNode = null;
  if (delta !== undefined) {
    changeNode = <DeltaChip delta={delta} unit={unit} higherIsBetter={false} digits={digits} />;
  }
  return {
    key: pollutant,
    label: `${pollutant} (${unit})`,
    base: `${formatNumber(before, digits)}${floorNote ? '*' : ''}`,
    comparison: formatNumber(after, digits),
    change: changeNode,
    spoken:
      `${pollutant}: ${before === undefined ? 'no data' : `${formatNumber(before, digits)} ${spokenUnit}`} in ${periods.base}${floorNote}, ` +
      `${after === undefined ? 'no data' : `${formatNumber(after, digits)}`} in ${periods.comparison}` +
      `${delta === undefined ? '' : `, ${describeDelta(delta, spokenUnit, false, digits)}`}.`,
  };
}

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title }} />
      <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  years: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  // At large text sizes the labels need the width, so the years sit one above the other.
  yearsStacked: {
    flexDirection: 'column',
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  coverage: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  primaryButton: {
    minHeight: MinTouchTarget + 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
  },
});
