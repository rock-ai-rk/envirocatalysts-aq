import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import type { OverviewCity } from '@/api/types';
import { AQI_CATEGORIES } from '@/constants/aqi';
import type { PeriodView } from '@/constants/periods';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Frames mainland India.
const INDIA = { latitude: 22.5, longitude: 82.5, latitudeDelta: 28, longitudeDelta: 28 };

interface Props {
  cities: OverviewCity[];
  view: PeriodView;
  onSelect: (cityId: number) => void;
}

/**
 * Ranked cities on a map, each dot coloured by the AQI category it spent most days in. Uses the
 * platform map (Apple Maps on iOS) so no API key or paid service is needed. The list below the
 * map carries the same information for screen-reader users.
 */
export function CityMap({ cities, view, onSelect }: Props) {
  const theme = useTheme();
  const placed = cities.filter((c) => c.city.latitude !== null && c.city.longitude !== null);

  return (
    <View
      style={[styles.frame, { borderColor: theme.border }]}
      aria-label={`Map of ${placed.length} ranked cities. The list below has the same information.`}>
      <MapView style={StyleSheet.absoluteFill} initialRegion={INDIA} rotateEnabled={false} pitchEnabled={false}>
        {placed.map((item) => {
          const stats = view === 'base' ? item.base : (item.comparison ?? item.base);
          const category = AQI_CATEGORIES.reduce((best, c) =>
            stats.aqi_days[c.key] > stats.aqi_days[best.key] ? c : best,
          );
          return (
            <Marker
              key={item.city.id}
              coordinate={{ latitude: item.city.latitude!, longitude: item.city.longitude! }}
              title={`${item.rank}. ${item.city.name}`}
              description={`Mostly ${category.label.toLowerCase()} (${stats.aqi_days[category.key]} days)`}
              onCalloutPress={() => onSelect(item.city.id)}
              tracksViewChanges={false}>
              <View style={[styles.dot, { backgroundColor: category.color, borderColor: theme.text }]} />
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: 320,
    borderRadius: Spacing.three,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
});
