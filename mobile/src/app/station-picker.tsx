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
import { resolveStation, useHourlySelection } from '@/state/hourly-selection';
import { useStationPrefs } from '@/state/station-prefs';

interface Row {
  key: string;
  city: City;
  station: Station;
}

interface Section {
  key: string;
  title: string;
  /** Favourites and recents mix cities, so their rows name the city too. */
  showCity: boolean;
  data: Row[];
}

/**
 * Every station in one searchable list, with favourites and recently viewed ones first. It
 * replaces the source dashboard's three dependent dropdowns (state, city, station).
 */
export default function StationPickerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const cities = useHourlyCities();
  const { selection, select } = useHourlySelection();
  const prefs = useStationPrefs();
  const [query, setQuery] = useState('');
  // Favourites and recents as they were when the picker opened. Starring a station then updates
  // its star in place instead of inserting a section that shifts the list under the finger; the
  // new order shows next time.
  const [pinned] = useState(() => ({ favorites: prefs.favorites, recents: prefs.recents }));

  const current = resolveStation(cities.data, selection)?.station.id ?? null;
  const rows = (cities.data ?? []).flatMap(({ city, stations }) =>
    stations.map((station) => ({ key: `${city.id}-${station.id}`, city, station })),
  );
  const byStation = new Map(rows.map((row) => [row.station.id, row]));
  const listed = (ids: number[], prefix: string): Row[] =>
    ids.flatMap((id) => {
      const row = byStation.get(id);
      return row ? [{ ...row, key: `${prefix}-${id}` }] : [];
    });

  const q = query.trim().toLowerCase();
  const matches = (row: Row) =>
    !q ||
    row.station.name.toLowerCase().includes(q) ||
    row.city.name.toLowerCase().includes(q) ||
    row.city.state.toLowerCase().includes(q);

  const sections: Section[] = [
    ...(q
      ? []
      : [
          { key: 'favorites', title: 'Favourites', showCity: true, data: listed(pinned.favorites, 'favorite') },
          {
            key: 'recent',
            title: 'Recent',
            showCity: true,
            data: listed(
              pinned.recents.filter((id) => !pinned.favorites.includes(id)),
              'recent',
            ),
          },
        ]),
    ...(cities.data ?? []).map(({ city }) => ({
      key: `city-${city.id}`,
      title: `${city.name}, ${city.state}`,
      showCity: false,
      data: rows.filter((row) => row.city.id === city.id && matches(row)),
    })),
  ].filter((section) => section.data.length > 0);

  const choose = (row: Row) => {
    select({ cityId: row.city.id, stationId: row.station.id });
    prefs.addRecent(row.station.id);
    router.back();
  };

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
            placeholder="Search stations, cities and states"
            placeholderTextColor={theme.textSecondary}
            aria-label="Search stations, cities and states"
            autoCorrect={false}
            clearButtonMode="while-editing"
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
            {section.title}
          </ThemedText>
        )}
        renderItem={({ item, section }) => {
          const selected = item.station.id === current;
          const favorite = prefs.isFavorite(item.station.id);
          const place = section.showCity ? `${item.station.name}, ${item.city.name}` : item.station.name;
          return (
            <View style={[styles.row, selected && { backgroundColor: theme.backgroundSelected }]}>
              <FocusablePressable
                role="radio"
                aria-checked={selected}
                aria-label={section.showCity ? place : `${item.station.name}, ${item.city.name}`}
                onPress={() => choose(item)}
                style={styles.choice}>
                <ThemedText type={selected ? 'smallBold' : 'small'} style={styles.rowLabel}>
                  {place}
                </ThemedText>
                {selected ? <ThemedText type="smallBold">✓</ThemedText> : null}
              </FocusablePressable>
              <FocusablePressable
                role="checkbox"
                aria-checked={favorite}
                aria-label={`Favourite: ${item.station.name}, ${item.city.name}`}
                onPress={() => prefs.toggleFavorite(item.station.id)}
                style={styles.star}>
                {/* Filled or outlined, so the state shows without relying on colour. */}
                <ThemedText type="sectionTitle" style={{ color: favorite ? theme.accent : theme.textSecondary }}>
                  {favorite ? '★' : '☆'}
                </ThemedText>
              </FocusablePressable>
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: theme.backgroundSelected }]} />}
      />
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
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.two,
  },
  choice: {
    flex: 1,
    minHeight: MinTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
  rowLabel: {
    flex: 1,
  },
  star: {
    width: MinTouchTarget,
    height: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: MinTouchTarget / 2,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
});
