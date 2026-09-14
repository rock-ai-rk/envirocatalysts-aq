import { useMemo, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Line, Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import type { SeriesPoint, StationSeries } from '@/api/types';
import { AqiBadge } from '@/components/aqi-badge';
import { ThemedText } from '@/components/themed-text';
import { categoryForConcentration } from '@/constants/pollutants';
import { Spacing } from '@/constants/theme';
import { LARGE_TEXT_SCALE } from '@/hooks/use-large-text';
import { useTheme } from '@/hooks/use-theme';
import { monthInitial, shortDay } from '@/lib/dates';
import { describePoint } from '@/lib/describe';
import { formatConcentration, formatDay, formatIstTimestamp } from '@/lib/format';

interface Props {
  series: StationSeries;
  /** The same days in the other year, drawn dashed and matched point by point. */
  comparison?: StationSeries;
  /** "FY 25-26" and "FY 24-25", for the readout when comparing. */
  seriesLabel: string;
  comparisonLabel?: string;
  /** The chart's text equivalent; screen readers hear it as the chart's name. */
  summary: string;
  height?: number;
}

const TICK_WIDTH = 44;
// Axis labels grow with the text size only this far, so they stay on one line under their tick;
// the readout above the chart and the spoken summary carry the same information at full size.
const TICK_MAX_SCALE = LARGE_TEXT_SCALE;

/**
 * A line chart you read by dragging across it. The crosshair follows the finger on the UI thread
 * (Reanimated shared value), and the readout above the plot names the exact hour and value, so
 * the finger never covers it.
 *
 * For screen readers the chart is one "adjustable" element: swipe up or down to step through the
 * points, each announced in words, with actions to jump to the highest and lowest values.
 */
export function TrendChart({ series, comparison, seriesLabel, comparisonLabel, summary, height = 180 }: Props) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  // At large text sizes the readout may wrap: a steady plot matters less than losing words.
  const readoutLines = fontScale > LARGE_TEXT_SCALE ? undefined : 1;
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const { points, pollutant, thresholds } = series;
  const other = comparison?.points;
  const n = points.length;

  const geometry = useMemo(() => {
    const values = [...points, ...(other ?? [])].flatMap((p) =>
      [p.value, p.max].filter((v): v is number => v !== null),
    );
    const top = Math.max(1, ...values, thresholds?.who ?? 0) * 1.1;
    const x = (i: number) => (n <= 1 ? width / 2 : (i / (n - 1)) * width);
    const y = (v: number) => height - (v / top) * height;
    return {
      top,
      x,
      y,
      line: linePath(points.map((p) => p.value), x, y),
      comparisonLine: other ? linePath(other.map((p) => p.value), x, y) : null,
      band: series.resolution === 'day' ? bandPath(points, x, y) : null,
      pointYs: points.map((p) => (p.value === null ? -1 : y(p.value))),
      limits: thresholds
        ? [
            { label: `WHO ${thresholds.who}`, value: thresholds.who },
            { label: `NAAQS ${thresholds.naaqs}`, value: thresholds.naaqs },
          ].filter((limit) => limit.value <= top)
        : [],
      ticks: axisTicks(points, series.resolution),
      highest: extremeIndex(points, (a, b) => a > b),
      lowest: extremeIndex(points, (a, b) => a < b),
    };
  }, [points, other, thresholds, series.resolution, n, width, height]);

  // The selected point, on the UI thread; -1 when nothing is selected.
  const cursor = useSharedValue(-1);
  const pointYs = geometry.pointYs;

  const indexAt = (x: number) => {
    'worklet';
    if (n === 0 || width === 0) return -1;
    return Math.round(Math.min(Math.max(x / width, 0), 1) * (n - 1));
  };
  // A horizontal drag scrubs; a vertical one is left to the scroll view. A tap selects one point.
  const scrub = Gesture.Pan()
    .activeOffsetX([-4, 4])
    .failOffsetY([-12, 12])
    .onStart((event) => cursor.set(indexAt(event.x)))
    .onUpdate((event) => cursor.set(indexAt(event.x)));
  const tap = Gesture.Tap().onEnd((event) => cursor.set(indexAt(event.x)));

  // Only re-render React (for the readout) when the finger crosses into a different point.
  useAnimatedReaction(
    () => cursor.get(),
    (index, previous) => {
      if (index !== previous) scheduleOnRN(setSelected, index < 0 ? null : index);
    },
  );

  const crosshairStyle = useAnimatedStyle(() => {
    const index = cursor.get();
    const left = n <= 1 ? width / 2 : (index / (n - 1)) * width;
    return { opacity: index < 0 ? 0 : 1, transform: [{ translateX: left - 1 }] };
  });
  const dotStyle = useAnimatedStyle(() => {
    const index = cursor.get();
    const y = index < 0 ? -1 : pointYs[index];
    const left = n <= 1 ? width / 2 : (index / (n - 1)) * width;
    return { opacity: y < 0 ? 0 : 1, transform: [{ translateX: left - 6 }, { translateY: y - 6 }] };
  });

  const select = (index: number) => {
    cursor.set(index);
    setSelected(index);
    // VoiceOver reads an adjustable element's new value by itself; TalkBack needs telling.
    if (Platform.OS === 'android') AccessibilityInfo.announceForAccessibility(spokenValue(index));
  };
  const step = (direction: 1 | -1) => {
    let index = (selected ?? (direction > 0 ? -1 : n)) + direction;
    while (index >= 0 && index < n && points[index].value === null) index += direction;
    if (index >= 0 && index < n) select(index);
  };
  const spokenValue = (index: number) => {
    const point = describePoint(points[index], series);
    const then = other?.[index]?.value;
    return then === undefined || then === null || !comparisonLabel
      ? point
      : `${point}. ${comparisonLabel}: ${formatConcentration(then, pollutant)}`;
  };

  const unit = series.unit;
  const point = selected === null ? null : points[selected];
  const then = selected === null ? null : (other?.[selected]?.value ?? null);

  return (
    <View
      accessible
      // The ARIA-style `role` prop has no "adjustable"; this is the native iOS/Android one.
      accessibilityRole="adjustable"
      aria-label={summary}
      accessibilityValue={{
        text:
          selected === null
            ? `Swipe up or down to step through each ${series.resolution}.`
            : spokenValue(selected),
      }}
      accessibilityActions={[
        { name: 'increment', label: `Next ${series.resolution}` },
        { name: 'decrement', label: `Previous ${series.resolution}` },
        { name: 'highest', label: 'Jump to the highest value' },
        { name: 'lowest', label: 'Jump to the lowest value' },
      ]}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === 'increment') step(1);
        else if (nativeEvent.actionName === 'decrement') step(-1);
        else if (nativeEvent.actionName === 'highest' && geometry.highest >= 0) select(geometry.highest);
        else if (nativeEvent.actionName === 'lowest' && geometry.lowest >= 0) select(geometry.lowest);
      }}
      style={styles.container}>
      <View style={styles.readout}>
        {point ? (
          <>
            <ThemedText type="smallBold">
              {series.resolution === 'hour' ? formatIstTimestamp(point.t) : formatDay(point.t.slice(0, 10))}
            </ThemedText>
            <View style={styles.readoutRow}>
              <ThemedText type="sectionTitle" style={styles.readoutValue}>
                {point.value === null
                  ? 'No data'
                  : `${formatConcentration(point.value, pollutant)} ${unit}`}
              </ThemedText>
              {point.value !== null ? (
                <AqiBadge category={categoryForConcentration(pollutant, point.value)} />
              ) : null}
            </View>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={readoutLines}>
              {[
                series.resolution === 'day' && point.min !== null && point.max !== null
                  ? `Hours ranged ${formatConcentration(point.min, pollutant)}–${formatConcentration(point.max, pollutant)}`
                  : null,
                comparisonLabel && other
                  ? `${comparisonLabel}: ${then === null ? 'no data' : formatConcentration(then, pollutant)}`
                  : null,
                seriesLabel,
              ]
                .filter(Boolean)
                .join(' · ')}
            </ThemedText>
          </>
        ) : (
          // Same three lines as a selected point, so the plot doesn't shift under the finger.
          <>
            <ThemedText type="smallBold">{`Drag across the chart to read any ${series.resolution}`}</ThemedText>
            <View style={styles.readoutRow}>
              <ThemedText type="sectionTitle" style={styles.readoutValue}>
                {series.stats.mean === null
                  ? 'No data'
                  : `Average ${formatConcentration(series.stats.mean, pollutant)} ${unit}`}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={readoutLines}>
              {series.stats.max !== null && series.stats.max_at
                ? `Highest ${formatConcentration(series.stats.max, pollutant)} on ${formatIstTimestamp(series.stats.max_at)}`
                : seriesLabel}
            </ThemedText>
          </>
        )}
      </View>

      <GestureDetector gesture={Gesture.Race(scrub, tap)}>
        <View
          collapsable={false}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          style={[styles.plot, { height }]}>
          {width > 0 ? (
            <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
              {geometry.limits.map((limit) => (
                <Line
                  key={limit.label}
                  x1={0}
                  x2={width}
                  y1={geometry.y(limit.value)}
                  y2={geometry.y(limit.value)}
                  stroke={theme.textSecondary}
                  strokeWidth={1}
                  strokeDasharray="2 4"
                />
              ))}
              <Line x1={0} x2={width} y1={height} y2={height} stroke={theme.border} strokeWidth={1} />
              {geometry.band ? <Path d={geometry.band} fill={theme.accent} fillOpacity={0.18} /> : null}
              {geometry.comparisonLine ? (
                <Path
                  d={geometry.comparisonLine}
                  stroke={theme.textSecondary}
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  fill="none"
                />
              ) : null}
              <Path
                d={geometry.line}
                stroke={theme.accent}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                fill="none"
              />
            </Svg>
          ) : null}
          {geometry.limits.map((limit, index) => {
            const lineY = geometry.y(limit.value);
            // WHO is listed first and is the lower line; if NAAQS sits just above it, WHO's label
            // goes under its line so the two don't overlap.
            const other = geometry.limits[index + 1];
            const crowded = other !== undefined && Math.abs(geometry.y(other.value) - lineY) < 18;
            return (
              <ThemedText
                key={limit.label}
                type="small"
                themeColor="textSecondary"
                style={[
                  styles.limitLabel,
                  {
                    top: crowded ? Math.min(lineY + 2, height - 14) : Math.max(lineY - 16, 0),
                    backgroundColor: theme.backgroundElement,
                  },
                ]}>
                {limit.label}
              </ThemedText>
            );
          })}
          <Animated.View
            style={[styles.crosshair, { height, backgroundColor: theme.text }, crosshairStyle]}
          />
          <Animated.View
            style={[styles.dot, { backgroundColor: theme.accent, borderColor: theme.backgroundElement }, dotStyle]}
          />
        </View>
      </GestureDetector>

      <View style={[styles.axis, { height: Math.ceil(16 * Math.min(fontScale, TICK_MAX_SCALE)) }]}>
        {width > 0
          ? geometry.ticks.map((tick) => (
              <ThemedText
                key={tick.index}
                type="small"
                themeColor="textSecondary"
                numberOfLines={1}
                maxFontSizeMultiplier={TICK_MAX_SCALE}
                style={[
                  styles.tick,
                  { left: Math.min(Math.max(geometry.x(tick.index) - TICK_WIDTH / 2, 0), width - TICK_WIDTH) },
                ]}>
                {tick.label}
              </ThemedText>
            ))
          : null}
      </View>
    </View>
  );
}

/** An SVG path through the non-null values, broken at gaps. A lone value gets a short dash. */
function linePath(values: (number | null)[], x: (i: number) => number, y: (v: number) => number): string {
  const parts: string[] = [];
  values.forEach((value, i) => {
    if (value === null) return;
    const start = i === 0 || values[i - 1] === null;
    const end = i === values.length - 1 || values[i + 1] === null;
    if (start && end) parts.push(`M${x(i) - 1.5},${y(value)}h3`);
    else parts.push(`${start ? 'M' : 'L'}${x(i)},${y(value)}`);
  });
  return parts.join('');
}

/** Filled area between each day's lowest and highest hour, one shape per unbroken run. */
function bandPath(points: SeriesPoint[], x: (i: number) => number, y: (v: number) => number): string {
  const shapes: string[] = [];
  let run: number[] = [];
  const flush = () => {
    if (run.length > 1) {
      const upper = run.map((i, k) => `${k ? 'L' : 'M'}${x(i)},${y(points[i].max!)}`);
      const lower = [...run].reverse().map((i) => `L${x(i)},${y(points[i].min!)}`);
      shapes.push(`${upper.join('')}${lower.join('')}Z`);
    }
    run = [];
  };
  points.forEach((p, i) => (p.min !== null && p.max !== null ? run.push(i) : flush()));
  flush();
  return shapes.join('');
}

function extremeIndex(points: SeriesPoint[], better: (a: number, b: number) => boolean): number {
  let best = -1;
  points.forEach((p, i) => {
    if (p.value !== null && (best < 0 || better(p.value, points[best].value!))) best = i;
  });
  return best;
}

/** Where to label the time axis: hours for a day, dates for a week or month, months for a year. */
function axisTicks(points: SeriesPoint[], resolution: 'hour' | 'day'): { index: number; label: string }[] {
  const ticks: { index: number; label: string }[] = [];
  const day = (p: SeriesPoint) => p.t.slice(0, 10);
  if (resolution === 'day') {
    // Months are named mid-month, so each letter sits over the month it names.
    points.forEach((p, i) => {
      if (points.length > 62 ? day(p).endsWith('-15') : i % 7 === 3) {
        ticks.push({ index: i, label: points.length > 62 ? monthInitial(day(p)) : shortDay(day(p)) });
      }
    });
    return ticks;
  }
  if (points.length <= 24) {
    points.forEach((p, i) => {
      const hour = p.t.slice(11, 13);
      if (hour === '06' || hour === '12' || hour === '18') ticks.push({ index: i, label: `${hour}:00` });
    });
    return ticks;
  }
  // Hourly over several days: name each day at its midday, so the label sits in the middle of the
  // day it names. Every day for a week, every seventh for a month.
  const every = points.length <= 24 * 8 ? 1 : 7;
  let count = 0;
  let lastMonth = '';
  points.forEach((p, i) => {
    if (p.t.slice(11, 16) !== '12:00') return;
    if (count++ % every === 0) {
      const month = day(p).slice(0, 7);
      const label = month !== lastMonth ? shortDay(day(p)) : String(Number(day(p).slice(8)));
      lastMonth = month;
      ticks.push({ index: i, label });
    }
  });
  return ticks;
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  readout: {
    gap: Spacing.half,
  },
  readoutRow: {
    // Tall enough for the category badge, so rows with and without it match.
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  readoutValue: {
    fontVariant: ['tabular-nums'],
  },
  plot: {
    width: '100%',
  },
  limitLabel: {
    position: 'absolute',
    right: 0,
    fontSize: 11,
    lineHeight: 14,
    paddingHorizontal: Spacing.one,
  },
  crosshair: {
    position: 'absolute',
    pointerEvents: 'none',
    top: 0,
    left: 0,
    width: 2,
  },
  dot: {
    position: 'absolute',
    pointerEvents: 'none',
    top: 0,
    left: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  axis: {
    height: 16, // grows a little with the text size; see TICK_MAX_SCALE
  },
  tick: {
    position: 'absolute',
    width: TICK_WIDTH,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 14,
  },
});
