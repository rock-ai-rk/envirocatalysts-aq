import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Pollutant } from '@/api/live';
import type { OverviewCity } from '@/api/types';
import { FocusablePressable } from '@/components/focusable-pressable';
import { ThemedText } from '@/components/themed-text';
import { LINKED_LENSES, type LinkedLens } from '@/constants/lenses';
import { CONCENTRATION_POLLUTANTS, pollutantColor, unitFor } from '@/constants/pollutants';
import { elevation, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface Props {
  cities: OverviewCity[];
  /** Which pollutant the Pollutants card previews. */
  pollutant: Pollutant;
}

/**
 * The three lenses that are screens of their own, each as a card showing the answer it would give.
 * The preview is the real data, not an icon: a card that shows nothing until you open it is just a
 * button wearing a chart's clothes. Tapping one opens the lens, where the same numbers get the
 * whole screen.
 */
export function LensCards({ cities, pollutant }: Props) {
  const theme = useTheme();

  if (!cities.length) return null;

  return (
    <View style={styles.group}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.heading}>
        MORE VIEWS
      </ThemedText>
      {LINKED_LENSES.map((lens) => (
        <LensCard key={lens.key} lens={lens} cities={cities} pollutant={pollutant} theme={theme} />
      ))}
    </View>
  );
}

type Theme = ReturnType<typeof useTheme>;

function LensCard({
  lens,
  cities,
  pollutant,
  theme,
}: {
  lens: LinkedLens;
  cities: OverviewCity[];
  pollutant: Pollutant;
  theme: Theme;
}) {
  const router = useRouter();
  const preview = usePreview(lens, cities, pollutant);

  return (
    <FocusablePressable
      role="link"
      aria-label={`${lens.title}. ${preview.spoken}`}
      accessibilityHint="Opens this view"
      onPress={() => router.push(`/lens/${lens.slug}`)}
      style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.titleRow}>
        <ThemedText type="sectionTitle" style={styles.title}>
          {lens.title}
        </ThemedText>
        <ThemedText type="sectionTitle" themeColor="textSecondary" aria-hidden>
          →
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {lens.question}
      </ThemedText>
      <View aria-hidden>{preview.chart}</View>
      <ThemedText type="smallBold">{preview.summary}</ThemedText>
    </FocusablePressable>
  );
}

interface Preview {
  chart: React.ReactNode;
  /** The line under the chart. */
  summary: string;
  /** What a screen reader hears in place of the chart, which it cannot read. */
  spoken: string;
}

function usePreview(lens: LinkedLens, cities: OverviewCity[], pollutant: Pollutant): Preview {
  const theme = useTheme();

  return useMemo(() => {
    if (lens.key === 'pollutants') {
      const values = cities.map((c) => c.base.pollutant_means[pollutant] ?? 0);
      const max = Math.max(1, ...values);
      const withValue = values.filter((v) => v > 0);
      const mean = withValue.length ? withValue.reduce((a, b) => a + b, 0) / withValue.length : 0;
      const colour = pollutantColor(pollutant).color;
      const summary = `${pollutant} average ${Math.round(mean)} ${unitFor(pollutant)}`;
      return {
        summary,
        spoken: `${lens.question} Across these ${cities.length} cities, ${summary}.`,
        chart: (
          <View style={styles.bars}>
            {values.slice(0, 14).map((value, i) => (
              <View
                key={i}
                style={[
                  styles.bar,
                  {
                    height: Math.max(2, (value / max) * PREVIEW_HEIGHT),
                    backgroundColor: value > 0 ? colour : theme.backgroundSelected,
                  },
                ]}
              />
            ))}
          </View>
        ),
      };
    }

    if (lens.key === 'dominant') {
      const totals = new Map<Pollutant, number>();
      for (const city of cities) {
        for (const [key, days] of Object.entries(city.base.dominant_days)) {
          totals.set(key as Pollutant, (totals.get(key as Pollutant) ?? 0) + (days ?? 0));
        }
      }
      const ordered = CONCENTRATION_POLLUTANTS.map((p) => ({ p, days: totals.get(p) ?? 0 })).filter(
        (entry) => entry.days > 0,
      );
      const total = ordered.reduce((sum, entry) => sum + entry.days, 0);
      const leader = ordered.reduce((best, entry) => (entry.days > best.days ? entry : best), {
        p: pollutant,
        days: 0,
      });
      const share = total ? Math.round((leader.days / total) * 100) : 0;
      const summary = total ? `${leader.p} led ${share}% of days` : 'No dominant-pollutant days';
      return {
        summary,
        spoken: `${lens.question} ${summary}.`,
        chart: total ? (
          <View style={styles.share}>
            {ordered.map((entry) => (
              <View
                key={entry.p}
                style={{
                  flex: entry.days,
                  backgroundColor: pollutantColor(entry.p).color,
                  borderColor: theme.border,
                  borderWidth: 1,
                }}
              />
            ))}
          </View>
        ) : null,
      };
    }

    // Map: the dots it would place, as a row of pips rather than a silent grey rectangle.
    const summary = `${cities.length} ${cities.length === 1 ? 'city' : 'cities'} on the map`;
    return {
      summary,
      spoken: `${lens.question} ${summary}.`,
      chart: (
        <View style={styles.pips}>
          {cities.slice(0, 22).map((city) => (
            <View
              key={city.city.id}
              style={[styles.pip, { backgroundColor: theme.accent, borderColor: theme.border }]}
            />
          ))}
        </View>
      ),
    };
  }, [lens, cities, pollutant, theme]);
}

const PREVIEW_HEIGHT = 34;

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  heading: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingTop: Spacing.two,
  },
  card: {
    borderRadius: Radius.large,
    padding: Spacing.three,
    gap: Spacing.two,
    ...elevation(1),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: PREVIEW_HEIGHT,
  },
  bar: {
    flex: 1,
    borderRadius: 2,
  },
  share: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 3,
    overflow: 'hidden',
  },
  pips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  pip: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
  },
});
