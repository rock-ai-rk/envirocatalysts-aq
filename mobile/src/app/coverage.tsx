import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useOverview } from '@/api/history';
import type { ExcludedCity } from '@/api/types';
import { FocusablePressable } from '@/components/focusable-pressable';
import { SectionCard } from '@/components/section-card';
import { StatusMessage } from '@/components/status-message';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import { formatPercent } from '@/lib/format';
import { toOverviewParams, useOverviewFilters } from '@/state/overview-filters';

/**
 * Why some cities aren't ranked: the data rules in plain language, and the cities each one
 * affects. Reads the same (cached) response as the Overview list, so it opens instantly.
 */
export default function CoverageScreen() {
  const router = useRouter();
  const { filters } = useOverviewFilters();
  const { data, isPending, isError, error, refetch } = useOverview(toOverviewParams(filters));

  if (isPending) return <Frame><StatusMessage kind="loading" /></Frame>;
  if (isError) return <Frame><StatusMessage kind="error" message={error.message} onRetry={() => refetch()} /></Frame>;

  const minCoverage = formatPercent(data.rules.min_coverage);
  return (
    <Frame>
      <SectionCard title={`At least ${minCoverage} of days with data`}>
        <ThemedText type="small">
          {`A city is ranked for ${data.base.label} only if it has data on at least ${minCoverage} of the period's days, so a few clean weeks can't put a city at the top. ${data.comparison.label} then shows the same cities with whatever data exists.`}
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
    </Frame>
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

function Frame({ children }: { children: ReactNode }) {
  return (
    <ThemedView style={styles.container}>
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
