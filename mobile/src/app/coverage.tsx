import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useCoverage, useOverview } from '@/api/history';
import type { CityCoverage, ExcludedCity } from '@/api/types';
import { FocusablePressable } from '@/components/focusable-pressable';
import { SectionCard } from '@/components/section-card';
import { StatusMessage } from '@/components/status-message';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatNumber, formatPercent } from '@/lib/format';
import { toOverviewParams, useOverviewFilters } from '@/state/overview-filters';

/**
 * Why some cities aren't ranked: the data rules in plain language, and the cities each one
 * affects. Opened from a city's coverage pill it starts with that city's own numbers, from
 * /v1/coverage; opened from the Overview's banner it goes straight to the rules.
 */
export default function CoverageScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ cityId?: string; period?: string }>();
  const { filters } = useOverviewFilters();
  const { data, isPending, isError, error, refetch } = useOverview(toOverviewParams(filters));
  const cityId = params.cityId ? Number(params.cityId) : null;

  return (
    <Frame title={cityId === null ? 'Why some cities aren’t ranked' : 'Data coverage'}>
      {cityId !== null ? (
        <CityCoverageCard
          cityId={cityId}
          period={params.period ?? filters.base}
          comparisonPeriod={filters.comparison}
        />
      ) : null}

      {isPending ? (
        <StatusMessage kind="loading" />
      ) : isError ? (
        <StatusMessage kind="error" message={error.message} onRetry={() => refetch()} />
      ) : (
        <>
          <SectionCard title={`At least ${formatPercent(data.rules.min_coverage)} of days with data`}>
            <ThemedText type="small">
              {`A city is ranked for ${data.base.label} only if it has data on at least ${formatPercent(data.rules.min_coverage)} of the period's days, so a few clean weeks can't put a city at the top. ${data.comparison.label} then shows the same cities with whatever data exists.`}
            </ThemedText>
          </SectionCard>
          <SectionCard title={`PM2.5 below ${data.rules.pm25_floor} µg/m³ means a faulty sensor`}>
            <ThemedText type="small">
              An average this low isn&apos;t plausible for an Indian city, so the city is left out of
              PM2.5 rankings and its PM2.5 bar is hidden. Its other numbers are still shown.
            </ThemedText>
          </SectionCard>

          <ThemedText type="sectionTitle" role="heading">
            {`Not ranked for ${data.base.label} (${data.excluded.length})`}
          </ThemedText>
          {data.excluded.length === 0 ? (
            <StatusMessage kind="empty" title="Every city in this selection qualified." />
          ) : (
            data.excluded.map((entry) => (
              <ExcludedRow
                key={entry.city.id}
                entry={entry}
                onPress={() => router.push({ pathname: '/city/[id]', params: { id: String(entry.city.id) } })}
              />
            ))
          )}
        </>
      )}
    </Frame>
  );
}

/** One city's standing against each rule for one period, with what that means for the charts. */
function CityCoverageCard({
  cityId,
  period,
  comparisonPeriod,
}: {
  cityId: number;
  period: string;
  comparisonPeriod: string;
}) {
  const { data, isPending, isError, error, refetch } = useCoverage(cityId, period);

  if (isPending) return <StatusMessage kind="loading" message="Checking this city’s data…" />;
  if (isError) return <StatusMessage kind="error" message={error.message} onRetry={() => refetch()} />;

  const { rules } = data;
  const floor = `${rules.pm25_floor} µg/m³`;
  const pm25 = data.pm25_mean;
  const summary = `${data.days_with_data} of ${data.days_in_period} days have data`;

  return (
    <SectionCard title={`${data.city.name}, ${data.period.label}`}>
      <View
        accessible
        aria-label={`${summary}, ${formatPercent(data.coverage)}. ${formatPercent(rules.min_coverage)} is needed to be ranked.`}
        style={styles.summary}>
        <ThemedText type="sectionTitle">{summary}</ThemedText>
        <CoverageMeter coverage={data.coverage} minCoverage={rules.min_coverage} />
      </View>

      <RuleRow
        passed={data.days_with_data === 0 ? false : data.meets_min_coverage}
        title={`At least ${formatPercent(rules.min_coverage)} of days with data`}
        detail={
          data.days_with_data === 0
            ? 'No data for this period'
            : `${formatPercent(data.coverage)} of days: ${data.meets_min_coverage ? 'met' : 'not met'}`
        }
      />
      <RuleRow
        passed={pm25 === null ? null : !data.pm25_below_floor}
        title={`PM2.5 average above ${floor}`}
        detail={
          pm25 === null
            ? 'No PM2.5 data for this period'
            : data.pm25_below_floor
              ? `${formatNumber(pm25, 1)} µg/m³: too low to be real, likely a faulty sensor`
              : `${formatNumber(pm25, 1)} µg/m³: met`
        }
      />

      <ThemedText type="small">{outcome(data, period === comparisonPeriod)}</ThemedText>
    </SectionCard>
  );
}

function outcome(data: CityCoverage, isComparisonPeriod: boolean): string {
  const { city, period } = data;
  const pm25Note = data.pm25_below_floor ? ' Its PM2.5 bar is hidden, since the reading is likely a sensor fault.' : '';
  if (isComparisonPeriod) {
    return `${period.label} is the comparison period, which shows the same cities as the base whatever their coverage, so ${city.name} stays in it.${pm25Note}`;
  }
  if (!data.included_in_base) {
    return `${city.name} is left out of the ${period.label} rankings and listed under “Not ranked” below.`;
  }
  if (!data.included_in_pm25_chart) {
    return `${city.name} is ranked in ${period.label}, except in the PM2.5 chart.${pm25Note}`;
  }
  return `${city.name} is ranked in every ${period.label} chart.`;
}

/**
 * Coverage as a bar, with a mark where the threshold sits. The caption is ordinary text below
 * the bar rather than a label pinned under the mark, so it wraps instead of overlapping when the
 * text size is large.
 */
function CoverageMeter({ coverage, minCoverage }: { coverage: number; minCoverage: number }) {
  const theme = useTheme();
  const met = coverage >= minCoverage;
  return (
    <View aria-hidden style={styles.meter}>
      <View>
        <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
          <View
            style={[
              styles.fill,
              { width: `${Math.min(coverage, 1) * 100}%`, backgroundColor: met ? theme.better : theme.worse },
            ]}
          />
        </View>
        <View style={[styles.threshold, { left: `${minCoverage * 100}%`, backgroundColor: theme.text }]} />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {`The mark is at ${formatPercent(minCoverage)}, the share of days needed to be ranked.`}
      </ThemedText>
    </View>
  );
}

/** A rule and whether the city meets it, shown with a mark and a word, never colour alone. */
function RuleRow({ passed, title, detail }: { passed: boolean | null; title: string; detail: string }) {
  const theme = useTheme();
  const mark = passed === null ? '–' : passed ? '✓' : '✗';
  const color = passed === null ? theme.textSecondary : passed ? theme.better : theme.worse;
  const verdict = passed === null ? 'Not applicable' : passed ? 'Met' : 'Not met';
  return (
    <View accessible aria-label={`Rule: ${title}. ${verdict}. ${detail}.`} style={styles.rule}>
      <View style={[styles.mark, { borderColor: color }]}>
        {/* Fixed size so it stays inside its circle at large text sizes; the words say the same. */}
        <ThemedText type="smallBold" allowFontScaling={false} style={{ color }}>
          {mark}
        </ThemedText>
      </View>
      <View style={styles.ruleText}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {detail}
        </ThemedText>
      </View>
    </View>
  );
}

function reasonText(entry: ExcludedCity): string {
  if (entry.reason === 'low_coverage' && entry.coverage !== null) {
    return `Data on ${formatPercent(entry.coverage)} of days`;
  }
  if (entry.reason === 'pm25_floor') return 'PM2.5 average under 2 µg/m³';
  return 'No data for this period';
}

function ExcludedRow({ entry, onPress }: { entry: ExcludedCity; onPress: () => void }) {
  const reason = reasonText(entry);
  return (
    <FocusablePressable
      role="button"
      aria-label={`${entry.city.name}, ${entry.city.state}: ${reason}`}
      accessibilityHint="Opens this city's details"
      onPress={onPress}
      style={styles.row}>
      <View style={styles.rowText}>
        <ThemedText type="smallBold">{entry.city.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {entry.city.state}
        </ThemedText>
      </View>
      <ThemedText type="small">{reason}</ThemedText>
    </FocusablePressable>
  );
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
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  summary: {
    gap: Spacing.two,
  },
  meter: {
    gap: Spacing.two,
  },
  track: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  threshold: {
    position: 'absolute',
    top: -3,
    width: 2,
    height: 18,
    marginLeft: -1,
  },
  rule: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  mark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleText: {
    flex: 1,
  },
  row: {
    minHeight: MinTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
  },
  rowText: {
    flex: 1,
  },
});
