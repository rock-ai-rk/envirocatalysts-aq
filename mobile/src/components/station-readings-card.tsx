import { StyleSheet, View } from 'react-native';

import { useLiveLatest, type Pollutant } from '@/api/live';
import { SectionCard } from '@/components/section-card';
import { StatusMessage } from '@/components/status-message';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatClock, formatReading, speakReading } from '@/lib/format';

const MAX_STATIONS = 6;

/** Latest scraped reading of one pollutant at each station in a city, highest first. */
export function StationReadingsCard({ city, pollutant }: { city: string; pollutant: Pollutant }) {
  const theme = useTheme();
  const query = useLiveLatest({ city });

  const rows = (query.data?.stations ?? [])
    .flatMap((station) => {
      const reading = station.readings.find((r) => r.pollutant === pollutant);
      return reading ? [{ station, reading }] : [];
    })
    .sort((a, b) => (b.reading.avg ?? -1) - (a.reading.avg ?? -1))
    .slice(0, MAX_STATIONS);

  return (
    <SectionCard
      title="Latest reading"
      subtitle={`${pollutant} at ${city} stations, from the CPCB real-time feed`}>
      {query.isPending ? (
        <StatusMessage kind="loading" message="Loading latest readings…" />
      ) : query.isError ? (
        <StatusMessage kind="error" message={query.error.message} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <StatusMessage
          kind="empty"
          title={`No live ${pollutant} readings for ${city}`}
          message="Stations here haven't reported in the last two days, or nothing has been scraped yet."
        />
      ) : (
        <View style={styles.list}>
          {rows.map(({ station, reading }) => (
            <View
              key={station.id}
              accessible
              aria-label={[
                station.name,
                `average ${speakReading(reading.avg)}`,
                `min ${speakReading(reading.min)}, max ${speakReading(reading.max)}`,
                `at ${formatClock(reading.observed_at)}`,
                reading.stale ? 'out of date' : null,
              ]
                .filter(Boolean)
                .join(', ')}
              style={styles.row}>
              <View style={styles.place}>
                <ThemedText type="smallBold" numberOfLines={2}>
                  {station.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {`min ${formatReading(reading.min)} · max ${formatReading(reading.max)} · ${formatClock(reading.observed_at)}`}
                </ThemedText>
                {reading.stale ? (
                  <ThemedText type="small" style={{ color: theme.worse }}>
                    Out of date
                  </ThemedText>
                ) : null}
              </View>
              <ThemedText type="sectionTitle">{formatReading(reading.avg)}</ThemedText>
            </View>
          ))}
        </View>
      )}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  place: {
    flex: 1,
    gap: Spacing.half,
  },
});
