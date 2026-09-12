import type { OverviewCity } from '@/api/types';
import { SectionCard } from '@/components/section-card';
import { StatusMessage } from '@/components/status-message';
import type { PeriodView } from '@/constants/periods';

interface Props {
  cities: OverviewCity[];
  view: PeriodView;
  onSelect: (cityId: number) => void;
}

/** react-native-maps has no web implementation; the web build is only used for development. */
export function CityMap({ cities }: Props) {
  return (
    <SectionCard title="City map">
      <StatusMessage
        kind="empty"
        title="The map is available in the iOS and Android app"
        message={`The list below shows the same ${cities.length} cities.`}
      />
    </SectionCard>
  );
}
