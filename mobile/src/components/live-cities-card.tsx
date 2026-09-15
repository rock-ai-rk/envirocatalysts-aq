import { StyleSheet, View } from 'react-native';

import { useLiveCities } from '@/api/live';
import type { CityGroup } from '@/api/types';
import { AqiBadge } from '@/components/aqi-badge';
import { SectionCard } from '@/components/section-card';
import { SourceCredit } from '@/components/source-credit';
import { StatusMessage } from '@/components/status-message';
import { ThemedText } from '@/components/themed-text';
import { categoryByKey } from '@/constants/aqi';
import { Spacing } from '@/constants/theme';
import { formatClock } from '@/lib/format';

const LIMIT = 5;

/**
 * "Right now": the cities with the highest estimated AQI in the scraper's latest values. This is
 * the part of the Overview powered by the scraper rather than the historical files. The values
 * come from an air-quality model, not monitors, so the card says so.
 */
export function LiveCitiesCard({ state, group }: { state: string | null; group: CityGroup | null }) {
  const query = useLiveCities({ state, group, order: 'desc', limit: LIMIT });
  const data = query.data;
  const cities = data?.cities ?? [];
  const updated = cities.length
    ? formatClock(cities.reduce((a, b) => (a.observed_at > b.observed_at ? a : b)).observed_at)
    : null;

  return (
    <SectionCard
      title="Right now"
      subtitle={`Highest estimated AQI${state ? ` in ${state}` : ''}, from an air-quality model rather than monitors`}
      accessory={
        updated ? (
          <ThemedText type="small" themeColor="textSecondary">
            {`Updated ${updated}`}
          </ThemedText>
        ) : null
      }>
      {query.isPending ? (
        <StatusMessage kind="loading" message="Loading the latest estimates…" />
      ) : query.isError ? (
        <StatusMessage kind="error" message={query.error.message} onRetry={() => query.refetch()} />
      ) : cities.length === 0 ? (
        <StatusMessage
          kind="empty"
          title="No estimates yet"
          message="The scraper hasn’t stored model values for these cities in the last few hours."
        />
      ) : (
        <View style={styles.list}>
          {cities.map(({ city, aqi }, index) => {
            const category = categoryByKey(aqi.category);
            return (
              <View
                key={city.id}
                accessible
                aria-label={`${index + 1}. ${city.name}, ${city.state}: estimated AQI ${aqi.value}, ${category.label}, driven by ${aqi.dominant}`}
                style={styles.row}>
                <ThemedText type="smallBold" style={styles.rank}>
                  {index + 1}
                </ThemedText>
                <View style={styles.place}>
                  <ThemedText type="smallBold">{city.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {`${city.state} · ${aqi.dominant}`}
                  </ThemedText>
                </View>
                <View style={styles.value}>
                  <ThemedText type="sectionTitle">{aqi.value}</ThemedText>
                  <AqiBadge category={category} />
                </View>
              </View>
            );
          })}
        </View>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        CPCB’s AQI formula applied to the CAMS model’s values for the area around each city (about
        45 km across). Ozone is left out: the model overestimates it over India.
      </ThemedText>
      {data ? <SourceCredit attribution={data.attribution} url={data.attribution_url} /> : null}
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
  value: {
    alignItems: 'flex-end',
    gap: Spacing.one,
  },
});
