import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Pollutant } from '@/api/live';
import type { CityPeriodStats, OverviewCity, Period } from '@/api/types';
import { StackedBar } from '@/components/charts/stacked-bar';
import { ValueBar } from '@/components/charts/value-bar';
import { CoverageChip } from '@/components/coverage-chip';
import { DeltaChip, describeDelta } from '@/components/delta-chip';
import { FocusablePressable } from '@/components/focusable-pressable';
import { ThemedText } from '@/components/themed-text';
import { AQI_CATEGORIES } from '@/constants/aqi';
import type { PeriodView } from '@/constants/periods';
import { shortPeriodLabel } from '@/constants/periods';
import {
  categoryForConcentration,
  pollutantColor,
  POLLUTANT_ORDER,
  spokenUnitFor,
  unitFor,
} from '@/constants/pollutants';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { describeAqiDays, describeCoverage, describeDominant } from '@/lib/describe';
import { formatNumber, formatPercent } from '@/lib/format';

export type RowMetric = 'aqi_days' | 'pollutants' | 'dominant';

interface Props {
  item: OverviewCity;
  metric: RowMetric;
  view: PeriodView;
  pollutant: Pollutant;
  /** Largest concentration in the list, so pollutant bars share a scale. */
  scaleMax: number;
  periods: { base: Period; comparison: Period };
  minCoverage: number;
  onPress: (cityId: number) => void;
  /** Opens the coverage explanation for this city and period. */
  onCoverage: (cityId: number, periodKey: string) => void;
}

/**
 * One ranked city. Rows have a fixed layout whatever the number of cities, so "All cities" is
 * just a longer list, never a taller chart. The row is one screen-reader element that speaks
 * everything the bars show; the coverage pill sits below it as a separate button, not inside it,
 * so touch, keyboard and screen readers all reach it directly.
 */
export const OverviewCityRow = memo(function OverviewCityRow(props: Props) {
  const { item, view, periods, minCoverage, onPress, onCoverage } = props;
  const theme = useTheme();
  const { label, content, headline } = describeRow(props, theme);
  // The Change view compares against the base period, whose rules decide the ranking.
  const coveragePeriod = view === 'comparison' ? periods.comparison : periods.base;
  const coverageStats = view === 'comparison' ? item.comparison : item.base;

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <FocusablePressable
        role="button"
        aria-label={label}
        accessibilityHint="Opens this city's details"
        onPress={() => onPress(item.city.id)}
        style={styles.row}>
        <View style={styles.titleRow}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.rank}>
            {item.rank}
          </ThemedText>
          <View style={styles.place}>
            {/* No line limit: at large text sizes a long name wraps instead of losing its end. */}
            <ThemedText type="smallBold">{item.city.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {coverageStats ? item.city.state : `${item.city.state} · no data for ${coveragePeriod.label}`}
            </ThemedText>
          </View>
          {headline}
        </View>
        {content}
      </FocusablePressable>
      {coverageStats ? (
        <View style={styles.footer}>
          <CoverageChip
            coverage={coverageStats.coverage}
            minCoverage={minCoverage}
            pm25BelowFloor={coverageStats.pm25_below_floor}
            onPress={() => onCoverage(item.city.id, coveragePeriod.key)}
          />
        </View>
      ) : null}
    </View>
  );
});

function describeRow(props: Props, theme: ReturnType<typeof useTheme>) {
  const { item, metric, view, pollutant, scaleMax, periods } = props;
  const intro = `${item.rank}. ${item.city.name}, ${item.city.state}.`;

  if (view === 'change') {
    return describeChangeRow(props, intro, theme);
  }

  const stats = view === 'base' ? item.base : item.comparison;
  const period = view === 'base' ? periods.base : periods.comparison;
  if (!stats) {
    return {
      label: `${intro} No data for ${period.label}.`,
      headline: null,
      content: <NoData text={`No data for ${period.label}`} />,
    };
  }

  // Low coverage is flagged by the coverage pill in the title, so it isn't repeated here.
  const coverage = describeCoverage(stats);

  if (metric === 'aqi_days') {
    return {
      label: `${intro} ${period.label}: ${describeAqiDays(stats.aqi_days)}, ${coverage}.`,
      headline: <Headline value={`${stats.aqi_days.good}`} caption="good days" />,
      content: <AqiDaysBar stats={stats} periodDays={period.days} />,
    };
  }

  if (metric === 'dominant') {
    const top = POLLUTANT_ORDER.filter((p) => (stats.dominant_days[p] ?? 0) > 0).sort(
      (a, b) => (stats.dominant_days[b] ?? 0) - (stats.dominant_days[a] ?? 0),
    )[0];
    return {
      label: `${intro} ${period.label}: dominant pollutant ${describeDominant(stats.dominant_days)}.`,
      headline: top ? <Headline value={top} caption={`${stats.dominant_days[top]} days`} /> : null,
      content: <DominantBar stats={stats} />,
    };
  }

  const value = stats.pollutant_means[pollutant];
  if (pollutant === 'PM2.5' && stats.pm25_below_floor) {
    return {
      label: `${intro} ${period.label}: PM2.5 average below 2 ${spokenUnitFor(pollutant)}, likely a sensor fault, so it is not shown.`,
      headline: null,
      content: <NoData text="PM2.5 under 2 µg/m³: likely a sensor fault, not shown" />,
    };
  }
  if (value === undefined) {
    return {
      label: `${intro} ${period.label}: no ${pollutant} data.`,
      headline: null,
      content: <NoData text={`No ${pollutant} data`} />,
    };
  }
  const digits = pollutant === 'CO' ? 2 : 0;
  return {
    label: `${intro} ${period.label}: average ${pollutant} ${formatNumber(value, digits)} ${spokenUnitFor(pollutant)}, ${coverage}.`,
    headline: null,
    content: (
      <ValueBar
        value={value}
        max={scaleMax}
        color={categoryForConcentration(pollutant, value).color}
        label={`${formatNumber(value, digits)} ${unitFor(pollutant)}`}
      />
    ),
  };
}

function describeChangeRow(props: Props, intro: string, theme: ReturnType<typeof useTheme>) {
  const { item, metric, pollutant, periods } = props;
  const change = item.change;
  const from = shortPeriodLabel(periods.base.label);
  const to = shortPeriodLabel(periods.comparison.label);
  if (!change || !item.comparison) {
    return {
      label: `${intro} No data for ${periods.comparison.label}, so no change to show.`,
      headline: null,
      content: <NoData text={`No data for ${periods.comparison.label}`} />,
    };
  }

  if (metric === 'pollutants') {
    const delta = change.pollutant_means[pollutant];
    const before = item.base.pollutant_means[pollutant];
    const after = item.comparison.pollutant_means[pollutant];
    if (delta === undefined || before === undefined || after === undefined) {
      return {
        label: `${intro} ${pollutant} is missing in one of the periods.`,
        headline: null,
        content: <NoData text={`${pollutant} missing in one period`} />,
      };
    }
    const unit = unitFor(pollutant);
    const digits = pollutant === 'CO' ? 2 : 1;
    return {
      label: `${intro} Average ${pollutant} ${formatNumber(before, digits)} in ${periods.base.label} and ${formatNumber(after, digits)} in ${periods.comparison.label}, ${describeDelta(delta, spokenUnitFor(pollutant), false, digits)}.`,
      headline: null,
      content: (
        <View style={styles.changeLine}>
          <ThemedText type="small" themeColor="textSecondary">
            {`${from} ${formatNumber(before, digits)} → ${to} ${formatNumber(after, digits)}`}
          </ThemedText>
          <DeltaChip delta={delta} unit={unit} higherIsBetter={false} digits={digits} />
        </View>
      ),
    };
  }

  if (metric === 'dominant') {
    const pollutants = POLLUTANT_ORDER.filter(
      (p) => (item.base.dominant_days[p] ?? 0) > 0 || (item.comparison!.dominant_days[p] ?? 0) > 0,
    );
    return {
      label: `${intro} Dominant pollutant in ${periods.base.label}: ${describeDominant(item.base.dominant_days)}. In ${periods.comparison.label}: ${describeDominant(item.comparison.dominant_days)}.`,
      headline: null,
      content: (
        <>
          <PeriodBar label={from}>
            <DominantBar stats={item.base} showValues={false} />
          </PeriodBar>
          <PeriodBar label={to}>
            <DominantBar stats={item.comparison} showValues={false} />
          </PeriodBar>
          <ThemedText type="small" themeColor="textSecondary">
            {pollutants
              .map((p) => `${p} ${formatSignedDays(change.dominant_days[p] ?? 0)}`)
              .join(' · ')}
          </ThemedText>
        </>
      ),
    };
  }

  const goodDelta = change.aqi_days.good;
  return {
    label: `${intro} Good days ${item.base.aqi_days.good} in ${periods.base.label} and ${item.comparison.aqi_days.good} in ${periods.comparison.label}, ${describeDelta(goodDelta, 'days', true)}.`,
    // Below the title rather than beside it: the chip is too wide to share a line with the name.
    headline: null,
    content: (
      <>
        <DeltaChip delta={goodDelta} unit="good days" higherIsBetter />
        <PeriodBar label={from}>
          <AqiDaysBar stats={item.base} periodDays={periods.base.days} showValues={false} />
        </PeriodBar>
        <PeriodBar label={to}>
          <AqiDaysBar stats={item.comparison} periodDays={periods.comparison.days} showValues={false} />
        </PeriodBar>
        {Math.abs(change.coverage) >= 0.1 ? (
          <ThemedText type="small" style={{ color: theme.worse }}>
            Coverage differs by {formatPercent(Math.abs(change.coverage))} between the periods
          </ThemedText>
        ) : null}
      </>
    ),
  };
}

function formatSignedDays(delta: number): string {
  return delta === 0 ? '±0 d' : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} d`;
}

function AqiDaysBar({
  stats,
  periodDays,
  showValues = true,
}: {
  stats: CityPeriodStats;
  periodDays: number;
  showValues?: boolean;
}) {
  return (
    <StackedBar
      total={periodDays}
      showValues={showValues}
      segments={AQI_CATEGORIES.map((c) => ({
        key: c.key,
        value: stats.aqi_days[c.key],
        color: c.color,
        textColor: c.textColor,
      }))}
    />
  );
}

function DominantBar({ stats, showValues = true }: { stats: CityPeriodStats; showValues?: boolean }) {
  return (
    <StackedBar
      showValues={showValues}
      segments={POLLUTANT_ORDER.map((p) => ({
        key: p,
        value: stats.dominant_days[p] ?? 0,
        ...pollutantColor(p),
      }))}
    />
  );
}

function PeriodBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.periodBar}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.periodLabel}>
        {label}
      </ThemedText>
      <View style={styles.periodBarChart}>{children}</View>
    </View>
  );
}

function Headline({ value, caption }: { value: string; caption: string }) {
  return (
    <View style={styles.headline}>
      <ThemedText type="sectionTitle">{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {caption}
      </ThemedText>
    </View>
  );
}

function NoData({ text }: { text: string }) {
  return (
    <ThemedText type="small" themeColor="textSecondary">
      {text}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
  },
  row: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  footer: {
    // Lines the pill up under the city name: the row's focus-ring border, padding, rank column
    // and gap.
    paddingLeft: 2 + Spacing.three + 24 + Spacing.two,
    paddingRight: Spacing.three,
    paddingBottom: Spacing.three,
    marginTop: -Spacing.one,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rank: {
    minWidth: 24,
    textAlign: 'center',
  },
  place: {
    flex: 1,
  },
  headline: {
    alignItems: 'flex-end',
  },
  periodBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  periodLabel: {
    width: 64,
  },
  periodBarChart: {
    flex: 1,
  },
  changeLine: {
    gap: Spacing.half,
  },
});
