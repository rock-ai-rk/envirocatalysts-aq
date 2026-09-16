import { useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { useLiveCities, type LiveCitiesResponse } from '@/api/live';
import type { CityGroup } from '@/api/types';
import { CategorySwatch } from '@/components/aqi-badge';
import { FocusablePressable } from '@/components/focusable-pressable';
import { SectionCard } from '@/components/section-card';
import { SkeletonCapsules } from '@/components/skeleton';
import { SourceCredit } from '@/components/source-credit';
import { StatusMessage } from '@/components/status-message';
import { ThemedText } from '@/components/themed-text';
import { categoryByKey } from '@/constants/aqi';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { useLargeText } from '@/hooks/use-large-text';
import { useTheme } from '@/hooks/use-theme';
import { formatClock } from '@/lib/format';

const LIMIT = 5;
const ABOUT =
  'An estimated AQI: CPCB’s formula applied to the CAMS air-quality model’s values for the area ' +
  'around each city (about 45 km across), not a reading from a CPCB monitor. Ozone is left out, ' +
  'because the model overestimates it over India. Updated every hour.';

/**
 * "Right now": the cities with the highest estimated AQI in the scraper's latest values, as a row
 * of capsules. This is the part of the Overview powered by the scraper rather than the historical
 * files. How the estimate is made sits behind ⓘ and in every capsule's spoken label; the source
 * credit stays visible, as the data's licence asks.
 */
export function LiveCitiesCard({ state, group }: { state: string | null; group: CityGroup | null }) {
  const theme = useTheme();
  const query = useLiveCities({ state, group, order: 'desc', limit: LIMIT });
  const data = query.data;
  const cities = data?.cities ?? [];
  const updated = cities.length
    ? formatClock(cities.reduce((a, b) => (a.observed_at > b.observed_at ? a : b)).observed_at)
    : null;

  return (
    <SectionCard
      title="Right now"
      subtitle={`Highest estimated AQI${state ? ` in ${state}` : ''}, from an air-quality model`}
      accessory={
        <>
          {updated ? (
            <ThemedText type="small" themeColor="textSecondary">
              {updated}
            </ThemedText>
          ) : null}
          <FocusablePressable
            role="button"
            aria-label="About these estimates"
            onPress={() => Alert.alert('About these estimates', ABOUT)}
            style={styles.about}>
            <ThemedText type="sectionTitle" style={{ color: theme.accent }}>
              ⓘ
            </ThemedText>
          </FocusablePressable>
        </>
      }>
      {query.isPending ? (
        <SkeletonCapsules label="Loading the latest estimates" />
      ) : query.isError ? (
        <StatusMessage kind="error" message={query.error.message} onRetry={() => query.refetch()} />
      ) : cities.length === 0 ? (
        <StatusMessage
          kind="empty"
          title="No estimates yet"
          message="The scraper hasn’t stored model values for these cities in the last few hours."
        />
      ) : (
        <Capsules data={data!} />
      )}
      {data ? <SourceCredit attribution={data.attribution} url={data.attribution_url} /> : null}
    </SectionCard>
  );
}

function Capsules({ data }: { data: LiveCitiesResponse }) {
  const theme = useTheme();
  const router = useRouter();
  const wrap = useLargeText();

  const capsules = data.cities.map(({ city, aqi }, index) => {
    const category = categoryByKey(aqi.category);
    return (
      <FocusablePressable
        key={city.id}
        role="button"
        aria-label={
          `${index + 1}. ${city.name}, ${city.state}: estimated AQI ${aqi.value}, ${category.label}, ` +
          `driven by ${aqi.dominant}. From an air-quality model, not a monitor.`
        }
        accessibilityHint="Opens this city's details"
        onPress={() => router.push({ pathname: '/city/[id]', params: { id: String(city.id) } })}
        style={[styles.capsule, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <ThemedText type="smallBold" numberOfLines={wrap ? undefined : 1}>
          {city.name}
        </ThemedText>
        <View style={styles.value}>
          <ThemedText type="sectionTitle">{aqi.value}</ThemedText>
          <CategorySwatch category={category} />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {`${category.label} · ${aqi.dominant}`}
        </ThemedText>
      </FocusablePressable>
    );
  });

  if (wrap) return <View style={styles.column}>{capsules}</View>;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroller}
      contentContainerStyle={[styles.row, styles.scrollContent]}>
      {capsules}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  about: {
    minWidth: MinTouchTarget,
    minHeight: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: Spacing.two,
  },
  column: {
    gap: Spacing.two,
  },
  capsule: {
    minWidth: 120,
    minHeight: MinTouchTarget,
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.half,
  },
  value: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
