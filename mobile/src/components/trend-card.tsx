import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { useStationSeries } from '@/api/history';
import type { HourlyPollutant, Period, Station } from '@/api/types';
import { TrendChart } from '@/components/charts/trend-chart';
import { WindowStrip } from '@/components/charts/window-strip';
import { ChoiceChip } from '@/components/choice-chip';
import { FocusablePressable } from '@/components/focusable-pressable';
import { SectionCard } from '@/components/section-card';
import { StatusMessage } from '@/components/status-message';
import { ThemedText } from '@/components/themed-text';
import { shortPeriodLabel, type PeriodView } from '@/constants/periods';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { useLargeText } from '@/hooks/use-large-text';
import { useTheme } from '@/hooks/use-theme';
import { describeSeries } from '@/lib/describe';
import {
  RANGE_PRESETS,
  speakWindow,
  windowIn,
  windowLabel,
  type RangePreset,
} from '@/lib/series-window';

interface Props {
  station: Station;
  pollutant: HourlyPollutant;
  view: PeriodView;
  base: Period;
  comparison: Period;
}

/**
 * Hour-by-hour values for one station: pick a length (24 h, 7 days, 30 days, full year), move it
 * through the year, and drag across the chart to read exact values. In the Change view, the same
 * days of the base year are drawn dashed behind the comparison year.
 */
export function TrendCard({ station, pollutant, view, base, comparison }: Props) {
  // At large text sizes the window's dates get a line of their own above the two buttons,
  // instead of being squeezed between them into one word per line.
  const stackStepper = useLargeText();
  const [preset, setPreset] = useState<RangePreset>('week');
  // Where the window ends, in days from the start of the year; starts at the latest week.
  const [endOffset, setEndOffset] = useState(Number.POSITIVE_INFINITY);
  const [previewOffset, setPreviewOffset] = useState<number | null>(null);

  const shownPeriod = view === 'base' ? base : comparison;
  const comparing = view === 'change';
  const span = windowIn(shownPeriod, preset, endOffset);
  const labelSpan = previewOffset === null ? span : windowIn(shownPeriod, preset, previewOffset);
  const baseSpan = windowIn(base, preset, span.endOffset);
  const yearSpan = windowIn(shownPeriod, 'year', Number.POSITIVE_INFINITY);

  const params = { stationId: station.id, pollutant };
  const series = useStationSeries({ ...params, from: span.from, to: span.to });
  const overlay = useStationSeries(comparing ? { ...params, from: baseSpan.from, to: baseSpan.to } : null);
  // The strip's silhouette. It's the same request as the "Full year" preset, so it's cached.
  const year = useStationSeries(preset === 'year' ? null : { ...params, from: yearSpan.from, to: yearSpan.to });

  const moveTo = (nextEnd: number) => {
    const next = windowIn(shownPeriod, preset, nextEnd);
    setEndOffset(next.endOffset);
    AccessibilityInfo.announceForAccessibility(`Showing ${speakWindow(next)}`);
  };
  const canGoEarlier = span.endOffset > span.days;
  const canGoLater = span.endOffset < span.periodDays;

  const data = series.data;
  const shownLabel = shortPeriodLabel(shownPeriod.label);
  const baseLabel = shortPeriodLabel(base.label);
  const summary = data
    ? describeSeries(
        data,
        preset === 'year' ? shownPeriod.label : speakWindow(span),
        comparing && overlay.data
          ? { series: overlay.data, label: base.label, ownLabel: comparison.label }
          : undefined,
      )
    : '';

  return (
    <SectionCard
      title="Hour by hour"
      subtitle={
        preset === 'year'
          ? `${shownPeriod.label}: daily averages, shaded from each day’s lowest to highest hour`
          : `${windowLabel(labelSpan)}. Times mark the end of each hour.`
      }>
      <View role="radiogroup" aria-label="Time range" style={styles.chips}>
        {RANGE_PRESETS.map((option) => (
          <ChoiceChip
            key={option.value}
            label={option.label}
            accessibilityLabel={option.spoken}
            selected={preset === option.value}
            onPress={() => setPreset(option.value)}
          />
        ))}
      </View>

      {preset !== 'year' ? (
        <>
          <WindowStrip
            year={year.data}
            span={span}
            onPreview={setPreviewOffset}
            onChange={moveTo}
          />
          {stackStepper ? (
            <ThemedText type="smallBold" style={styles.stepLabelStacked} aria-hidden>
              {windowLabel(labelSpan)}
            </ThemedText>
          ) : null}
          <View style={styles.stepper}>
            <StepButton
              label="‹ Earlier"
              spoken={`Earlier: ${speakWindow(windowIn(shownPeriod, preset, span.endOffset - span.days))}`}
              disabled={!canGoEarlier}
              onPress={() => moveTo(span.endOffset - span.days)}
            />
            {stackStepper ? (
              <View style={styles.stepLabel} />
            ) : (
              <ThemedText type="smallBold" style={styles.stepLabel} aria-hidden>
                {windowLabel(labelSpan)}
              </ThemedText>
            )}
            <StepButton
              label="Later ›"
              spoken={`Later: ${speakWindow(windowIn(shownPeriod, preset, span.endOffset + span.days))}`}
              disabled={!canGoLater}
              onPress={() => moveTo(span.endOffset + span.days)}
            />
          </View>
        </>
      ) : null}

      {series.isError && !data ? (
        <StatusMessage kind="error" message={series.error.message} onRetry={() => series.refetch()} />
      ) : !data ? (
        <StatusMessage kind="loading" message="Loading hourly values…" />
      ) : data.stats.hours_with_data === 0 ? (
        <StatusMessage
          kind="empty"
          title={`No ${pollutant} readings here for ${preset === 'year' ? shownPeriod.label : windowLabel(span)}`}
          message="Try another part of the year, or another pollutant."
        />
      ) : (
        <>
          {series.isPlaceholderData ? (
            <ThemedText type="small" themeColor="textSecondary" aria-live="polite">
              Updating…
            </ThemedText>
          ) : null}
          <TrendChart
            // A new window, station or pollutant starts with nothing selected.
            key={`${data.station.id}-${data.pollutant}-${data.start}-${data.end}`}
            series={data}
            comparison={comparing ? overlay.data : undefined}
            seriesLabel={shownLabel}
            comparisonLabel={comparing ? baseLabel : undefined}
            summary={summary}
          />
          {comparing ? <ComparisonLegend current={shownLabel} previous={baseLabel} /> : null}
          <ThemedText type="small">{summary}</ThemedText>
        </>
      )}
    </SectionCard>
  );
}

function StepButton({
  label,
  spoken,
  disabled,
  onPress,
}: {
  label: string;
  spoken: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <FocusablePressable
      role="button"
      aria-label={spoken}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={[styles.stepButton, { borderColor: theme.border, opacity: disabled ? 0.4 : 1 }]}>
      <ThemedText type="smallBold">{label}</ThemedText>
    </FocusablePressable>
  );
}

/** Solid for the year shown, dashed for the year it's compared with: told apart by line style, not colour. */
function ComparisonLegend({ current, previous }: { current: string; previous: string }) {
  const theme = useTheme();
  return (
    <View style={styles.legend} aria-hidden>
      <View style={styles.legendItem}>
        <Svg width={24} height={8}>
          <Line x1={0} x2={24} y1={4} y2={4} stroke={theme.accent} strokeWidth={2} />
        </Svg>
        <ThemedText type="small">{current}</ThemedText>
      </View>
      <View style={styles.legendItem}>
        <Svg width={24} height={8}>
          <Line x1={0} x2={24} y1={4} y2={4} stroke={theme.textSecondary} strokeWidth={1.5} strokeDasharray="5 4" />
        </Svg>
        <ThemedText type="small">{`${previous}, same days`}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  stepLabel: {
    flex: 1,
    textAlign: 'center',
  },
  stepLabelStacked: {
    textAlign: 'center',
  },
  stepButton: {
    minHeight: MinTouchTarget,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
