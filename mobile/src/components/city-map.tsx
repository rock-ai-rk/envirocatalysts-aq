import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import type { Pollutant } from '@/api/live';
import type { CityPeriodStats, OverviewCity } from '@/api/types';
import { AQI_CATEGORIES, type AqiCategory } from '@/constants/aqi';
import type { PeriodView } from '@/constants/periods';
import { categoryForConcentration, unitFor } from '@/constants/pollutants';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatNumber } from '@/lib/format';

// Frames mainland India.
const INDIA = { latitude: 22.5, longitude: 82.5, latitudeDelta: 28, longitudeDelta: 28 };

/** What a dot's colour means: the category a city had most days in, or a pollutant's average. */
export type MapColour = { kind: 'category' } | { kind: 'concentration'; pollutant: Pollutant };

interface Props {
  cities: OverviewCity[];
  view: PeriodView;
  colour: MapColour;
  onSelect: (cityId: number) => void;
}

/**
 * Ranked cities on a map. Each dot is coloured by the AQI category the city spent most days in,
 * or by the CPCB band its average concentration of one pollutant falls in; a hollow dot means no
 * value for that year. Uses the platform map (Apple Maps on iOS) so no API key or paid service is
 * needed. The list below the map carries the same information for screen-reader users.
 */
export function CityMap({ cities, view, colour, onSelect }: Props) {
  const theme = useTheme();
  const placed = cities.filter((c) => c.city.latitude !== null && c.city.longitude !== null);
  const meaning =
    colour.kind === 'category'
      ? 'each coloured by the AQI category it had most days in'
      : `each coloured by its average ${colour.pollutant}`;

  return (
    <View
      style={[styles.frame, { borderColor: theme.border }]}
      aria-label={`Map of ${placed.length} ranked cities, ${meaning}. The list below has the same information.`}>
      <MapView style={StyleSheet.absoluteFill} initialRegion={INDIA} rotateEnabled={false} pitchEnabled={false}>
        {placed.map((item) => {
          // Change compares against the newer year, so its dots show the newer year.
          const stats = view === 'base' ? item.base : item.comparison;
          const dot = describeDot(stats, colour);
          return (
            <Marker
              key={item.city.id}
              coordinate={{ latitude: item.city.latitude!, longitude: item.city.longitude! }}
              title={`${item.rank}. ${item.city.name}`}
              description={dot.description}
              onCalloutPress={() => onSelect(item.city.id)}
              tracksViewChanges={false}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: dot.category?.color ?? theme.backgroundElement, borderColor: theme.text },
                ]}
              />
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

function describeDot(
  stats: CityPeriodStats | null,
  colour: MapColour,
): { category: AqiCategory | null; description: string } {
  if (!stats) return { category: null, description: 'No data for this year' };

  if (colour.kind === 'category') {
    const category = AQI_CATEGORIES.reduce((best, c) =>
      stats.aqi_days[c.key] > stats.aqi_days[best.key] ? c : best,
    );
    return {
      category,
      description: `Mostly ${category.label.toLowerCase()} (${stats.aqi_days[category.key]} days)`,
    };
  }

  const { pollutant } = colour;
  const value = stats.pollutant_means[pollutant];
  // PM2.5 under the sensor-fault floor is left out here as it is in the list.
  if (value === undefined || (pollutant === 'PM2.5' && stats.pm25_below_floor)) {
    return { category: null, description: `No ${pollutant} average` };
  }
  const category = categoryForConcentration(pollutant, value);
  const digits = pollutant === 'CO' ? 2 : 0;
  return {
    category,
    description: `Average ${pollutant} ${formatNumber(value, digits)} ${unitFor(pollutant)} (${category.label.toLowerCase()} band)`,
  };
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
