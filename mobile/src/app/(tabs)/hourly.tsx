import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Pollutant } from '@/api/live';
import { ChoiceChip } from '@/components/choice-chip';
import { Screen } from '@/components/screen';
import { SectionCard } from '@/components/section-card';
import { SegmentedControl } from '@/components/segmented-control';
import { StationReadingsCard } from '@/components/station-readings-card';
import { StatusMessage } from '@/components/status-message';
import { ThemedText } from '@/components/themed-text';
import { PERIOD_VIEW_OPTIONS, type PeriodView } from '@/constants/periods';
import { Spacing } from '@/constants/theme';

const POLLUTANTS: Pollutant[] = ['PM2.5', 'PM10', 'NO2', 'SO2', 'CO', 'O3'];

// The source app opens on Delhi's city average; the city and station pickers need the
// historical station list, which arrives with the EnviroCatalysts dataset.
const DEFAULT_CITY = 'Delhi';

export default function HourlyScreen() {
  const [pollutant, setPollutant] = useState<Pollutant>('PM2.5');
  const [view, setView] = useState<PeriodView>('base');

  return (
    <Screen title="Hourly analysis">
      <View accessible aria-label={`Showing ${DEFAULT_CITY}, city average`}>
        <ThemedText type="small" themeColor="textSecondary">
          City · station
        </ThemedText>
        <ThemedText type="sectionTitle">{`${DEFAULT_CITY} · City average`}</ThemedText>
      </View>

      <View role="radiogroup" aria-label="Pollutant" style={styles.chips}>
        {POLLUTANTS.map((p) => (
          <ChoiceChip key={p} label={p} selected={p === pollutant} onPress={() => setPollutant(p)} />
        ))}
      </View>

      <StationReadingsCard city={DEFAULT_CITY} pollutant={pollutant} />

      <SegmentedControl label="Period" options={PERIOD_VIEW_OPTIONS} value={view} onChange={setView} />

      <SectionCard title="Hour-of-day pattern" subtitle={`${pollutant}, average for each hour`}>
        <StatusMessage
          kind="empty"
          title="Historical hourly data not imported yet"
          message="The 24-hour pattern, peak hour and hours above the NAAQS and WHO limits appear here once station data is loaded."
        />
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
