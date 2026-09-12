import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { useDayHeatmap } from '@/api/history';
import type { HourlyPollutant } from '@/api/types';
import { HeatmapGrid } from '@/components/charts/heatmap-grid';
import { StatusMessage } from '@/components/status-message';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { formatDay } from '@/lib/format';

/** Every station at every hour of one day, opened from the Hourly screen's peak day. */
export default function HourlyDayScreen() {
  const params = useLocalSearchParams<{ cityId: string; pollutant: HourlyPollutant; day: string }>();
  const { data, isPending, isError, error, refetch } = useDayHeatmap(
    Number(params.cityId),
    params.pollutant,
    params.day,
  );

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: formatDay(params.day) }} />
      <ScrollView contentContainerStyle={styles.content}>
        {isPending ? (
          <StatusMessage kind="loading" />
        ) : isError ? (
          <StatusMessage kind="error" message={error.message} onRetry={() => refetch()} />
        ) : (
          <>
            <ThemedText type="sectionTitle" role="heading">
              {`${data.pollutant} at every ${data.city.name} station, ${formatDay(data.day)}`}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {`Hourly values in ${data.unit}, coloured by CPCB band. Each hour is labelled by when it ends.`}
            </ThemedText>
            {data.rows.length ? (
              <HeatmapGrid rows={data.rows} hourLabels={data.hour_labels} pollutant={data.pollutant} />
            ) : (
              <StatusMessage kind="empty" title="No station reported on this day" />
            )}
          </>
        )}
      </ScrollView>
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
});
