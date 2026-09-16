import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Pollutant } from '@/api/live';
import type { HourlyPeriod } from '@/api/types';
import { DeltaChip, describeDelta } from '@/components/delta-chip';
import { ThemedText } from '@/components/themed-text';
import { spokenUnitFor } from '@/constants/pollutants';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatIstTimestamp, formatNumber } from '@/lib/format';

interface Props {
  /** The period being shown. */
  period: HourlyPeriod;
  /** When set, each card also shows the change from this period (lower is better for all four). */
  from?: HourlyPeriod;
  pollutant: Pollutant;
  unit: string;
  thresholds: { naaqs: number; who: number } | null;
}

/** Average, peak hour and time above the limits, as a 2x2 grid of cards. */
export function KpiGrid({ period, from, pollutant, unit, thresholds }: Props) {
  const k = period.kpis;
  const digits = pollutant === 'CO' ? 2 : 1;
  const spokenUnit = spokenUnitFor(pollutant);
  const peakWhen = k.peak_at ? formatIstTimestamp(k.peak_at) : null;

  return (
    <View style={styles.grid}>
      <Card
        label="Average"
        value={`${formatNumber(k.mean, digits)} ${unit}`}
        spoken={`Average ${formatNumber(k.mean, digits)} ${spokenUnit}`}
        delta={deltaOf(k.mean, from?.kpis.mean, unit, digits, spokenUnit)}
      />
      <Card
        label="Peak hour"
        value={`${formatNumber(k.peak, digits)} ${unit}`}
        detail={peakWhen}
        spoken={`Peak hour ${formatNumber(k.peak, digits)} ${spokenUnit}${peakWhen ? ` on ${peakWhen}` : ''}`}
        delta={deltaOf(k.peak, from?.kpis.peak, unit, digits, spokenUnit)}
      />
      {thresholds ? (
        <>
          <Card
            label={`Hours above NAAQS (${thresholds.naaqs})`}
            value={`${formatNumber(k.above_naaqs_pct, 1)}%`}
            share={k.above_naaqs_pct}
            spoken={`${formatNumber(k.above_naaqs_pct, 1)} percent of hours above the Indian standard of ${thresholds.naaqs}`}
            delta={deltaOf(k.above_naaqs_pct, from?.kpis.above_naaqs_pct, 'pts', 1, 'percentage points')}
          />
          <Card
            label={`Hours above WHO (${thresholds.who})`}
            value={`${formatNumber(k.above_who_pct, 1)}%`}
            share={k.above_who_pct}
            spoken={`${formatNumber(k.above_who_pct, 1)} percent of hours above the WHO guideline of ${thresholds.who}`}
            delta={deltaOf(k.above_who_pct, from?.kpis.above_who_pct, 'pts', 1, 'percentage points')}
          />
        </>
      ) : null}
    </View>
  );
}

function deltaOf(
  value: number | null,
  previous: number | null | undefined,
  unit: string,
  digits: number,
  spokenUnit: string,
): { node: ReactNode; spoken: string } | null {
  if (value === null || previous === null || previous === undefined) return null;
  const delta = value - previous;
  return {
    node: <DeltaChip delta={delta} unit={unit} higherIsBetter={false} digits={digits} />,
    spoken: describeDelta(delta, spokenUnit, false, digits),
  };
}

function Card({
  label,
  value,
  detail,
  share,
  spoken,
  delta,
}: {
  label: string;
  value: string;
  detail?: string | null;
  /** A percentage, drawn as a meter under the value so the share of hours reads at a glance. */
  share?: number | null;
  spoken: string;
  delta: { node: ReactNode; spoken: string } | null;
}) {
  const theme = useTheme();
  return (
    <View
      accessible
      aria-label={delta ? `${spoken}, ${delta.spoken}` : spoken}
      style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="sectionTitle">{value}</ThemedText>
      {share !== undefined && share !== null ? (
        <View aria-hidden style={[styles.meter, { backgroundColor: theme.backgroundSelected }]}>
          <View
            style={[
              styles.meterFill,
              { width: `${Math.min(Math.max(share, 0), 100)}%`, backgroundColor: theme.textSecondary },
            ]}
          />
        </View>
      ) : null}
      {detail ? (
        <ThemedText type="small" themeColor="textSecondary">
          {detail}
        </ThemedText>
      ) : null}
      {delta?.node}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  card: {
    flexGrow: 1,
    flexBasis: '45%',
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  meter: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: Spacing.one,
  },
  meterFill: {
    height: '100%',
    borderRadius: 3,
  },
});
