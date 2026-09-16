import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { Pollutant } from '@/api/live';
import type { Period } from '@/api/types';
import { ChoiceChip } from '@/components/choice-chip';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { PLACEHOLDER_PERIODS, periodViewOptions, type PeriodView } from '@/constants/periods';
import { CONCENTRATION_POLLUTANTS } from '@/constants/pollutants';
import { elevation, Spacing } from '@/constants/theme';
import { useLargeText } from '@/hooks/use-large-text';
import { useTheme } from '@/hooks/use-theme';

export type OverviewMetric = 'aqi_days' | 'pollutants' | 'dominant' | 'map';

/** What the map's dots are coloured by: each city's most common category, or a pollutant's average. */
export type MapColourBy = 'category' | 'concentration';

interface Props {
  periods: { base: Pick<Period, 'label'>; comparison: Pick<Period, 'label'> } | null;
  view: PeriodView;
  onView: (view: PeriodView) => void;
  /** Which lens this screen shows. It decides which of the extra chip rows apply. */
  metric: OverviewMetric;
  pollutant: Pollutant;
  onPollutant: (pollutant: Pollutant) => void;
  mapColourBy: MapColourBy;
  onMapColourBy: (by: MapColourBy) => void;
  /** True once rows have begun passing under the bar, for its raised state. */
  raised: boolean;
}

/**
 * A lens screen's controls: which year (or the change between them), for Pollutants which
 * pollutant, and for the Map what the dots are coloured by. The screen pins it above the city
 * list, so the choice stays in reach while scrolling; it has its own background so rows can pass
 * under it. Choosing the lens itself is navigation now, not a chip here.
 */
export function OverviewDeck(props: Props) {
  const { periods, view, onView, metric, pollutant, onPollutant, mapColourBy, onMapColourBy, raised } = props;
  const theme = useTheme();
  const { base, comparison } = periods ?? PLACEHOLDER_PERIODS;

  // iOS 26 draws the pinned bar as Liquid Glass, so the rows refract through it as they scroll
  // under. Everywhere else — Android, older iOS, the web — it stays an opaque bar, which is what
  // the contrast check measures; the glass is an addition on top, never the thing that makes the
  // controls legible.
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView style={[styles.deck, { borderBottomColor: theme.border }]}>
        <Controls {...props} base={base} comparison={comparison} />
      </GlassView>
    );
  }

  // Material's scrolled state, for the platforms with no glass to refract through: at rest the bar
  // is flat with a hairline under it, and once rows begin passing beneath it the hairline gives way
  // to a shadow, so the bar reads as raised over them rather than painted on. The screen flips
  // `raised` at a threshold, so this re-renders twice a scroll rather than every frame.
  return (
    <View
      style={[
        styles.deck,
        { backgroundColor: theme.background },
        raised ? [styles.raised, { borderBottomColor: 'transparent' }] : { borderBottomColor: theme.border },
      ]}>
      <Controls {...props} base={base} comparison={comparison} />
    </View>
  );
}

function Controls(
  props: Props & { base: Pick<Period, 'label'>; comparison: Pick<Period, 'label'> },
) {
  const { view, onView, metric, pollutant, onPollutant, mapColourBy, onMapColourBy, base, comparison } = props;

  return (
    <>
      <SegmentedControl
        label="Period"
        options={periodViewOptions(base, comparison)}
        value={view}
        onChange={onView}
      />
      {metric === 'pollutants' ? (
        <ChipRow label="Pollutant">
          {CONCENTRATION_POLLUTANTS.map((p) => (
            <ChoiceChip key={p} label={p} selected={pollutant === p} onPress={() => onPollutant(p)} />
          ))}
        </ChipRow>
      ) : null}
      {/* One row for both choices: the category, or which pollutant's average. */}
      {metric === 'map' ? (
        <ChipRow label="Colour cities by" title="Colour by">
          <ChoiceChip
            label="Category"
            accessibilityLabel="AQI category with the most days"
            selected={mapColourBy === 'category'}
            onPress={() => onMapColourBy('category')}
          />
          {CONCENTRATION_POLLUTANTS.map((p) => (
            <ChoiceChip
              key={p}
              label={p}
              accessibilityLabel={`Average ${p}`}
              selected={mapColourBy === 'concentration' && pollutant === p}
              onPress={() => {
                onMapColourBy('concentration');
                onPollutant(p);
              }}
            />
          ))}
        </ChipRow>
      ) : null}
    </>
  );
}

/**
 * One line of chips that scrolls sideways; at large text sizes the chips wrap instead. A `title`
 * is shown before the chips; screen readers hear `label` as the group's name instead.
 */
function ChipRow({ label, title, children }: { label: string; title?: string; children: ReactNode }) {
  const wrap = useLargeText();
  const heading = title ? (
    <ThemedText aria-hidden type="smallBold" themeColor="textSecondary" style={styles.title}>
      {title}
    </ThemedText>
  ) : null;
  return (
    <View role="radiogroup" aria-label={label}>
      {wrap ? (
        <View style={[styles.row, styles.wrap]}>
          {heading}
          {children}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scroller}
          contentContainerStyle={[styles.row, styles.scrollContent]}>
          {heading}
          {children}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  deck: {
    // Full width, so rows scrolling underneath don't show at the sides.
    marginHorizontal: -Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  raised: {
    ...elevation(2),
  },
  // A sideways scroller has to reach the screen edge, or its last item is sliced at the
  // gutter. It spans the full width and carries the gutter as content padding instead, so the
  // first item still lines up with everything above it.
  scroller: {
    marginHorizontal: -Spacing.three,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  wrap: {
    flexWrap: 'wrap',
  },
  title: {
    alignSelf: 'center',
  },
});
