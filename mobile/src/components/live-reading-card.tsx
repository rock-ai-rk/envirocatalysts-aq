import { StyleSheet, Text, View } from 'react-native';

import { useCityLive, type CityLive } from '@/api/live';
import { AqiBadge } from '@/components/aqi-badge';
import { AqiScale } from '@/components/aqi-scale';
import { SkeletonEstimate } from '@/components/skeleton';
import { SourceCredit } from '@/components/source-credit';
import { StatusMessage } from '@/components/status-message';
import { ThemedText } from '@/components/themed-text';
import { categoryByKey } from '@/constants/aqi';
import { POLLUTANT_ORDER, spokenUnitFor } from '@/constants/pollutants';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useLargeText } from '@/hooks/use-large-text';
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
  const largeText = useLargeText();

  return (
    <View style={[styles.card, { borderColor: theme.accent, backgroundColor: theme.background }]}>
      <View style={[styles.header, largeText && styles.headerStacked]}>
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
        <SkeletonEstimate />
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
  // Side by side, the big figure squeezes the badge and "Driven by" to a word per line at large
  // text sizes, so they stack.
  const largeText = useLargeText();

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
          style={[styles.headline, largeText && styles.headlineStacked]}>
          <View style={[styles.aqiNumber, largeText && styles.aqiNumberStacked]}>
            {/* 44pt is already large text, so it grows at most 1.5x; the value is also in the spoken
                label. A plain Text, so no default line height clips it. */}
            <Text style={[styles.aqiValue, { color: theme.text }]} maxFontSizeMultiplier={1.5}>
              {data.aqi.value}
            </Text>
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
      {data.aqi ? <AqiScale value={data.aqi.value} /> : null}

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
    borderRadius: Radius.medium,
    borderWidth: 2,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
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
    borderRadius: Radius.small,
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
  headlineStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  aqiNumber: {
    alignItems: 'center',
    minWidth: 72,
  },
  aqiNumberStacked: {
    alignItems: 'flex-start',
  },
  // No fixed line height: one would keep growing with the text size while the figure is capped.
  aqiValue: {
    fontSize: 44,
    fontFamily: FontFamily[700],
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
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
});
