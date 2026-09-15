import { StyleSheet, View } from 'react-native';

import { useCityLive, type CityLive } from '@/api/live';
import { AqiBadge } from '@/components/aqi-badge';
import { SourceCredit } from '@/components/source-credit';
import { StatusMessage } from '@/components/status-message';
import { ThemedText } from '@/components/themed-text';
import { categoryByKey } from '@/constants/aqi';
import { POLLUTANT_ORDER, spokenUnitFor } from '@/constants/pollutants';
import { Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-online';
import { useTheme } from '@/hooks/use-theme';
import { formatAge, formatConcentration, formatIstClock, formatIstTimestamp } from '@/lib/format';

/**
 * The newest model values for the station's city, as the screen's headline.
 *
 * It is set apart from the historical cards below (outlined, not filled, with an ESTIMATE tag) and
 * says what its numbers are: the CAMS model's values for the area around the city, with CPCB's
 * AQI formula applied, not a measurement at the station.
 */
export function LiveReadingCard({ cityId, cityName }: { cityId: number; cityName: string }) {
  const theme = useTheme();
  const query = useCityLive(cityId);
  const data = query.data;

  return (
    <View style={[styles.card, { borderColor: theme.accent, backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <View style={[styles.tag, { backgroundColor: theme.accent }]}>
          <View style={[styles.dot, { backgroundColor: theme.onAccent }]} />
          <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
            ESTIMATE
          </ThemedText>
        </View>
        <ThemedText type="sectionTitle" role="heading" style={styles.title}>
          {`Right now in ${cityName}`}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {`From an air-quality model of the area around ${cityName}, not measured at this station.`}
      </ThemedText>

      {query.isPending ? (
        <StatusMessage kind="loading" message="Loading the latest estimate…" />
      ) : !data ? (
        <StatusMessage
          kind="error"
          message={query.error?.message ?? 'Couldn’t load the latest estimate.'}
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

function LiveBody({ data }: { data: CityLive }) {
  const theme = useTheme();
  const now = useNow();

  if (data.status === 'not_in_feed') {
    return (
      <StatusMessage
        kind="empty"
        title="No estimate for this city"
        message="The data has no coordinates for this city, so the model can’t be read there."
      />
    );
  }
  if (data.status === 'no_recent_readings' || !data.observed_at) {
    return (
      <StatusMessage
        kind="empty"
        title="No recent values"
        message={`Nothing has been stored for ${data.city.name} in the last two days.`}
      />
    );
  }

  // The API judged freshness when it answered; an answer restored from the phone's cache may be
  // hours older than that, so check again against the clock.
  const stale =
    data.status === 'stale' ||
    now - Date.parse(data.observed_at) > data.stale_after_hours * 60 * 60 * 1000;
  const category = data.aqi ? categoryByKey(data.aqi.category) : null;
  // Ozone isn't part of the estimate (the model overestimates it over India), so it isn't shown
  // next to the pollutants that are.
  const readings = data.readings
    .filter((r) => r.pollutant !== 'O3')
    .sort((a, b) => POLLUTANT_ORDER.indexOf(a.pollutant) - POLLUTANT_ORDER.indexOf(b.pollutant));
  const when = `${formatIstTimestamp(data.observed_at)} IST`;

  return (
    <View style={styles.body}>
      {data.aqi && category ? (
        <View
          accessible
          aria-label={
            `Estimated air quality index ${data.aqi.value}, ${category.label}, driven by ${data.aqi.dominant}. ` +
            `For ${when}${stale ? `, out of date, ${formatAge(data.observed_at, true)}` : ''}.`
          }
          style={styles.headline}>
          <View style={styles.aqiNumber}>
            <ThemedText style={styles.aqiValue}>{data.aqi.value}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              AQI (est.)
            </ThemedText>
          </View>
          <View style={styles.headlineText}>
            <AqiBadge category={category} />
            <ThemedText type="small">{`Driven by ${data.aqi.dominant}`}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {`For ${formatIstClock(data.observed_at)} · ${formatAge(data.observed_at)}`}
            </ThemedText>
          </View>
        </View>
      ) : (
        <ThemedText type="small">
          {`No AQI yet for ${formatIstClock(data.observed_at)}: CPCB’s formula needs a day of values for three pollutants, including PM2.5 or PM10.`}
        </ThemedText>
      )}

      {stale ? (
        <ThemedText type="smallBold" style={{ color: theme.worse }}>
          {`⚠ Out of date: the newest value is from ${formatAge(data.observed_at)}.`}
        </ThemedText>
      ) : null}

      {readings.length ? (
        <View
          accessible
          aria-label={`At ${formatIstClock(data.observed_at)}: ${readings
            .map((r) => `${r.pollutant} ${formatConcentration(r.value, r.pollutant)} ${spokenUnitFor(r.pollutant)}`)
            .join(', ')}`}
          style={styles.readings}>
          {readings.map((r) => (
            <View key={r.pollutant} style={[styles.reading, { borderColor: theme.border }]}>
              <ThemedText type="small" themeColor="textSecondary">
                {r.pollutant}
              </ThemedText>
              <ThemedText type="smallBold">{formatConcentration(r.value, r.pollutant)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {r.unit}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}

      <ThemedText type="small" themeColor="textSecondary">
        The AQI uses CPCB’s formula on 24-hour averages (the highest 8-hour average for CO). Ozone is
        left out: the model overestimates it over India.
      </ThemedText>
      <SourceCredit attribution={data.attribution} url={data.attribution_url} />
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
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.two,
  },
  dot: {
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
