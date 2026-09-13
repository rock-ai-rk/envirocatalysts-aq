import { StyleSheet, View } from 'react-native';

import { useLiveCities } from '@/api/live';
import { SectionCard } from '@/components/section-card';
import { StatusMessage } from '@/components/status-message';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatClock } from '@/lib/format';

const LIMIT = 5;

/**
 * "Right now": the cities with the highest PM2.5 sub-index in the latest scraped CPCB readings.
 * This is the part of the Overview powered by the scraper rather than the historical files. The
 * feed publishes sub-indices on the AQI scale, not concentrations, so no unit is shown.
 */
export function LiveCitiesCard({ state }: { state: string | null }) {
  const query = useLiveCities({ pollutant: 'PM2.5', state, order: 'desc', limit: LIMIT });
  const cities = query.data?.cities ?? [];
  const updated = cities.length
    ? formatClock(cities.reduce((a, b) => (a.observed_at > b.observed_at ? a : b)).observed_at)
    : null;

  return (
    <SectionCard
      title="Right now"
      subtitle={`Highest PM2.5 sub-index (0–500 AQI scale) in the latest CPCB readings${state ? ` in ${state}` : ''}`}
      accessory={
        updated ? (
          <ThemedText type="small" themeColor="textSecondary">
            {`Updated ${updated}`}
          </ThemedText>
        ) : null
      }>
      {query.isPending ? (
        <StatusMessage kind="loading" message="Loading latest readings…" />
      ) : query.isError ? (
        <StatusMessage kind="error" message={query.error.message} onRetry={() => query.refetch()} />
      ) : cities.length === 0 ? (
        <StatusMessage
          kind="empty"
          title="No live readings yet"
          message="Nothing has been scraped from CPCB in the last few hours."
        />
      ) : (
        <View style={styles.list}>
          {cities.map((city, index) => (
            <View
              key={`${city.city}-${city.state}`}
              accessible
              aria-label={`${index + 1}. ${city.city}, ${city.state}: PM2.5 sub-index ${Math.round(city.avg)}, average of ${city.station_count} ${city.station_count === 1 ? 'station' : 'stations'}`}
              style={styles.row}>
              <ThemedText type="smallBold" style={styles.rank}>
                {index + 1}
              </ThemedText>
              <View style={styles.place}>
                <ThemedText type="smallBold">{city.city}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {`${city.state} · ${city.station_count} ${city.station_count === 1 ? 'station' : 'stations'}`}
                </ThemedText>
              </View>
              <ThemedText type="sectionTitle">{Math.round(city.avg)}</ThemedText>
            </View>
          ))}
        </View>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        Source: CPCB via data.gov.in. Sub-indices, not concentrations; real-time data is provisional.
      </ThemedText>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 44,
  },
  rank: {
    width: Spacing.four,
    textAlign: 'center',
  },
  place: {
    flex: 1,
  },
});
