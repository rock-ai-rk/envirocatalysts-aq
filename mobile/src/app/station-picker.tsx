import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SectionList, StyleSheet, TextInput, View } from 'react-native';

import { useHourlyCities } from '@/api/history';
import type { City, Station } from '@/api/types';
import { FocusablePressable } from '@/components/focusable-pressable';
import { StatusMessage } from '@/components/status-message';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useHourlySelection } from '@/state/hourly-selection';

interface Choice {
  key: string;
  label: string;
  stationId: number | null;
}

/**
 * City and station in one searchable list (the source dashboard used three dependent dropdowns:
 * state, city, station). Each city starts with its "City average" option.
 */
export default function StationPickerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const cities = useHourlyCities();
  const { selection, select } = useHourlySelection();
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const sections = (cities.data ?? [])
    .map(({ city, stations }) => ({
      city,
      data: choicesFor(city, stations).filter(
        (choice) => !q || city.name.toLowerCase().includes(q) || choice.label.toLowerCase().includes(q),
      ),
    }))
    .filter((section) => section.data.length > 0);

  return (
    <ThemedView style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search cities and stations"
            placeholderTextColor={theme.textSecondary}
            aria-label="Search cities and stations"
            autoCorrect={false}
            style={[styles.search, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
          />
        }
        ListEmptyComponent={
          cities.isPending ? (
            <StatusMessage kind="loading" />
          ) : cities.isError ? (
            <StatusMessage kind="error" message={cities.error.message} onRetry={() => cities.refetch()} />
          ) : (
            <StatusMessage kind="empty" title="No matching stations" />
          )
        }
        renderSectionHeader={({ section }) => (
          <ThemedText type="sectionTitle" role="heading" style={styles.sectionHeader}>
            {`${section.city.name}, ${section.city.state}`}
          </ThemedText>
        )}
        renderItem={({ item, section }) => {
          const selected = selection.cityId === section.city.id && selection.stationId === item.stationId;
          return (
            <FocusablePressable
              role="radio"
              aria-checked={selected}
              aria-label={`${item.label}, ${section.city.name}`}
              onPress={() => {
                select({ cityId: section.city.id, stationId: item.stationId });
                router.back();
              }}
              style={[styles.row, selected && { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type={selected ? 'smallBold' : 'small'} style={styles.rowLabel}>
                {item.label}
              </ThemedText>
              {selected ? <ThemedText type="smallBold">✓</ThemedText> : null}
            </FocusablePressable>
          );
        }}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: theme.backgroundSelected }]} />}
      />
    </ThemedView>
  );
}

function choicesFor(city: City, stations: Station[]): Choice[] {
  return [
    { key: `${city.id}-average`, label: 'City average (all stations)', stationId: null },
    ...stations.map((s) => ({ key: `${city.id}-${s.id}`, label: s.name, stationId: s.id })),
  ];
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
  },
  search: {
    minHeight: MinTouchTarget,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    marginBottom: Spacing.two,
  },
  sectionHeader: {
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
  },
  row: {
    minHeight: MinTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
  rowLabel: {
    flex: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
});
