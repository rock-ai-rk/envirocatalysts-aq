import { StyleSheet, View } from 'react-native';

import { useStationLatest, type StationLatest } from '@/api/live';
import { AqiBadge } from '@/components/aqi-badge';
import { StatusMessage } from '@/components/status-message';
import { ThemedText } from '@/components/themed-text';
import { categoryByKey } from '@/constants/aqi';
import { POLLUTANT_ORDER } from '@/constants/pollutants';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatAge, formatIstClock, formatIstTimestamp, formatReading } from '@/lib/format';

/**
 * The station's newest reading from the scraper's live table, as the screen's headline.
 *
 * It is set apart from the historical cards below (outlined, not filled, with a LIVE tag) and says
 * what its numbers are: provisional CPCB sub-indices on the 0-500 AQI scale, not concentrations.
 */
export function LiveReadingCard({ stationId }: { stationId: number }) {
  const theme = useTheme();
  const query = useStationLatest(stationId);
  const data = query.data;

  return (
    <View style={[styles.card, { borderColor: theme.accent, backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <View style={[styles.liveTag, { backgroundColor: theme.accent }]}>
          <View style={[styles.liveDot, { backgroundColor: theme.onAccent }]} />
          <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
            LIVE
          </ThemedText>
        </View>
        <ThemedText type="sectionTitle" role="heading" style={styles.title}>
          Right now
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        CPCB real-time feed. Provisional: published without manual checks.
      </ThemedText>

      {query.isPending ? (
        <StatusMessage kind="loading" message="Checking the live feed…" />
      ) : !data ? (
        <StatusMessage
          kind="error"
          message={query.error?.message ?? 'Couldn’t load the live reading.'}
          onRetry={() => query.refetch()}
        />
      ) : (
        <>
          <LiveBody data={data} />
          {query.isError ? (
            <ThemedText type="small" style={{ color: theme.worse }}>
              {`Couldn’t refresh just now; this is what the app loaded ${formatAge(new Date(query.dataUpdatedAt).toISOString())}.`}
            </ThemedText>
          ) : null}
        </>
      )}
    </View>
  );
}

function LiveBody({ data }: { data: StationLatest }) {
  const theme = useTheme();

  if (data.status === 'no_live_station') {
    return (
      <StatusMessage
        kind="empty"
        title="No live feed for this station"
        message="CPCB’s real-time feed has no station matching this one, so only historical data is shown."
      />
    );
  }
  if (data.status === 'no_recent_readings' || !data.observed_at) {
    return (
      <StatusMessage
        kind="empty"
        title="No recent readings"
        message={`${data.link?.live_station_name ?? 'This station'} hasn’t reported to the live feed in the last two days.`}
      />
    );
  }

  const stale = data.status === 'stale';
  const category = data.aqi ? categoryByKey(data.aqi.category) : null;
  const readings = [...data.readings]
    .filter((r) => r.observed_at === data.observed_at)
    .sort((a, b) => POLLUTANT_ORDER.indexOf(a.pollutant) - POLLUTANT_ORDER.indexOf(b.pollutant));
  const when = `${formatIstTimestamp(data.observed_at)} IST`;

  return (
    <View style={styles.body}>
      {data.aqi && category ? (
        <View
          accessible
          aria-label={
            `Air quality index ${data.aqi.value}, ${category.label}, driven by ${data.aqi.dominant}. ` +
            `Reading for ${when}${stale ? `, out of date, ${formatAge(data.observed_at, true)}` : ''}.`
          }
          style={styles.headline}>
          <View style={styles.aqiNumber}>
            <ThemedText style={styles.aqiValue}>{data.aqi.value}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              AQI
            </ThemedText>
          </View>
          <View style={styles.headlineText}>
            <AqiBadge category={category} />
            <ThemedText type="small">{`Driven by ${data.aqi.dominant}`}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {`Reading for ${formatIstClock(data.observed_at)} · ${formatAge(data.observed_at)}`}
            </ThemedText>
          </View>
        </View>
      ) : (
        <ThemedText type="small">
          {`Not enough pollutants reported at ${formatIstClock(data.observed_at)} for an AQI: CPCB needs three, including PM2.5 or PM10.`}
        </ThemedText>
      )}

      {stale ? (
        <ThemedText type="smallBold" style={{ color: theme.worse }}>
          {`⚠ Out of date: the last reading was ${formatAge(data.observed_at)}.`}
        </ThemedText>
      ) : null}

      {readings.length ? (
        <View
          accessible
          aria-label={`Sub-index by pollutant: ${readings
            .map((r) => `${r.pollutant} ${formatReading(r.avg)}`)
            .join(', ')}`}
          style={styles.readings}>
          {readings.map((r) => (
            <View key={r.pollutant} style={[styles.reading, { borderColor: theme.border }]}>
              <ThemedText type="small" themeColor="textSecondary">
                {r.pollutant}
              </ThemedText>
              <ThemedText type="smallBold">{formatReading(r.avg)}</ThemedText>
            </View>
          ))}
        </View>
      ) : null}

      <ThemedText type="small" themeColor="textSecondary">
        {`Sub-indices on CPCB’s 0–500 AQI scale, not concentrations. Station in the feed: ${data.link?.live_station_name}.`}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    borderWidth: 2,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.two,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  body: {
    gap: Spacing.three,
  },
  headline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  aqiNumber: {
    alignItems: 'center',
    minWidth: 72,
  },
  aqiValue: {
    fontSize: 44,
    lineHeight: 50,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
  headlineText: {
    flex: 1,
    gap: Spacing.one,
  },
  readings: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  reading: {
    minWidth: 64,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
});
