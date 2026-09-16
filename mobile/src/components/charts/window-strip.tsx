import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Path, Rect } from 'react-native-svg';

import type { StationSeries } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDayRange } from '@/lib/dates';
import type { SeriesWindow } from '@/lib/series-window';

interface Props {
  /** The whole year as daily means, drawn faintly so you can see where the bad weeks are. */
  year: StationSeries | undefined;
  span: SeriesWindow;
  /** While dragging, with the window's new end; null when the drag ends. */
  onPreview: (endOffset: number | null) => void;
  onChange: (endOffset: number) => void;
}

const HEIGHT = 44; // the whole strip is the touch target

/**
 * The financial year in miniature with the shown window highlighted. Drag the highlight, or tap
 * anywhere, to move the window there.
 *
 * Hidden from screen readers: the Earlier and Later buttons beside it do the same job, one window
 * at a time, and are easier to use without sight or with switch access.
 */
export function WindowStrip({ year, span, onPreview, onChange }: Props) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [draft, setDraft] = useState<number | null>(null);
  const { days, periodDays } = span;
  const endOffset = draft ?? span.endOffset;

  // Centre the window on the touch point, then keep it inside the year.
  const offsetAt = (x: number) =>
    Math.min(Math.max(Math.round((x / Math.max(width, 1)) * periodDays + days / 2), days), periodDays);
  const preview = (x: number) => {
    const next = offsetAt(x);
    setDraft(next);
    onPreview(next);
  };
  const drag = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-4, 4])
    .failOffsetY([-12, 12])
    .onStart((event) => preview(event.x))
    .onUpdate((event) => preview(event.x))
    .onEnd((event) => onChange(offsetAt(event.x)))
    .onFinalize(() => {
      setDraft(null);
      onPreview(null);
    });
  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((event) => onChange(offsetAt(event.x)));

  const windowX = ((endOffset - days) / periodDays) * width;
  const windowWidth = Math.max((days / periodDays) * width, 8);
  const area = year && width > 0 ? areaPath(year, width) : null;

  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" style={styles.container}>
      <GestureDetector gesture={Gesture.Race(drag, tap)}>
        <View
          collapsable={false}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          style={[styles.strip, { borderColor: theme.border }]}>
          {width > 0 ? (
            <Svg width={width} height={HEIGHT}>
              {area ? <Path d={area} fill={theme.textSecondary} fillOpacity={0.35} /> : null}
              <Rect
                x={Math.min(windowX, width - windowWidth)}
                y={1}
                width={windowWidth}
                height={HEIGHT - 2}
                rx={4}
                fill={theme.accent}
                fillOpacity={0.22}
                stroke={theme.accent}
                strokeWidth={2}
              />
            </Svg>
          ) : null}
        </View>
      </GestureDetector>
      {year ? (
        <View style={styles.ends}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.endLabel}>
            {formatDayRange(year.start.slice(0, 10), year.start.slice(0, 10))}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.endLabel}>
            {formatDayRange(year.points.at(-1)!.t.slice(0, 10), year.points.at(-1)!.t.slice(0, 10))}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

/** Daily means as a filled silhouette, scaled to the strip. Gaps drop to the baseline. */
function areaPath(year: StationSeries, width: number): string {
  const values = year.points.map((p) => p.value);
  const top = Math.max(1, ...values.filter((v): v is number => v !== null));
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const line = values
    .map((v, i) => `L${i * step},${HEIGHT - ((v ?? 0) / top) * (HEIGHT - 4)}`)
    .join('');
  return `M0,${HEIGHT}${line}L${width},${HEIGHT}Z`;
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  strip: {
    height: HEIGHT + 2,
    borderWidth: 1,
    borderRadius: Radius.small,
    overflow: 'hidden',
  },
  ends: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  endLabel: {
    fontSize: 11,
    lineHeight: 14,
  },
});
