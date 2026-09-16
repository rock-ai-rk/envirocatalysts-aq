import { useLocalSearchParams } from 'expo-router';

import { LensScreen } from '@/components/lens-screen';
import { lensBySlug } from '@/constants/lenses';

/**
 * One lens over the filtered cities, on its own screen: pollutant averages, the dominant
 * pollutant, or the map. Reached from the cards at the foot of the Overview, and deep-linkable
 * (`/lens/pollutants`) because the lens is in the path rather than in a chip's state.
 */
export default function LensRoute() {
  const { metric } = useLocalSearchParams<{ metric: string }>();
  return <LensScreen lens={lensBySlug(metric).key} />;
}
