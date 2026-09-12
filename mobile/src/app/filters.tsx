import { Stack, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChoiceChip } from '@/components/choice-chip';
import { FocusablePressable } from '@/components/focusable-pressable';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  CITY_GROUPS,
  DEFAULT_FILTERS,
  RANK_METRICS,
  useOverviewFilters,
  type OverviewFilters,
  type TopN,
} from '@/state/overview-filters';

/**
 * Every Overview filter in one sheet. Changes are drafted here and applied together on
 * "Show results", so the list re-queries once rather than on every tap.
 */
export default function FiltersScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { filters, setFilters } = useOverviewFilters();
  const [draft, setDraft] = useState<OverviewFilters>(filters);
  const update = (patch: Partial<OverviewFilters>) => setDraft((current) => ({ ...current, ...patch }));

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          headerLeft: () => <HeaderButton label="Cancel" onPress={() => router.back()} />,
          headerRight: () => <HeaderButton label="Reset" onPress={() => setDraft(DEFAULT_FILTERS)} />,
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <FilterSection title="Geography">
          <ChoiceChip label="All India" selected={draft.state === null} onPress={() => update({ state: null })} />
        </FilterSection>
        <ThemedText type="small" themeColor="textSecondary">
          The state list comes from the API once the historical data is imported.
        </ThemedText>

        <FilterSection title="City group">
          <ChoiceChip label="All groups" selected={draft.group === null} onPress={() => update({ group: null })} />
          {CITY_GROUPS.map((group) => (
            <ChoiceChip
              key={group.value}
              label={group.label}
              accessibilityHint={group.description}
              selected={draft.group === group.value}
              onPress={() => update({ group: group.value })}
            />
          ))}
        </FilterSection>

        <FilterSection title="Rank cities by">
          {RANK_METRICS.map((metric) => (
            <ChoiceChip
              key={metric.value}
              label={metric.label}
              selected={draft.rankBy === metric.value}
              onPress={() => update({ rankBy: metric.value })}
            />
          ))}
        </FilterSection>
        <SegmentedControl
          label="Order"
          options={[
            { value: 'best', label: 'Best first' },
            { value: 'worst', label: 'Worst first' },
          ]}
          value={draft.direction}
          onChange={(direction) => update({ direction })}
        />

        <View style={styles.section}>
          <ThemedText type="sectionTitle" role="heading">
            Show
          </ThemedText>
          <SegmentedControl
            label="Number of cities"
            options={[
              { value: '10', label: 'Top 10' },
              { value: '20', label: 'Top 20' },
              { value: 'all', label: 'All cities' },
            ]}
            value={String(draft.top)}
            onChange={(value) => update({ top: (value === 'all' ? 'all' : Number(value)) as TopN })}
          />
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={[styles.footer, { borderTopColor: theme.border }]}>
        <FocusablePressable
          role="button"
          aria-label="Show results"
          onPress={() => {
            setFilters(draft);
            router.back();
          }}
          style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
          <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
            Show results
          </ThemedText>
        </FocusablePressable>
      </SafeAreaView>
    </ThemedView>
  );
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="sectionTitle" role="heading">
        {title}
      </ThemedText>
      <View role="radiogroup" aria-label={title} style={styles.chips}>
        {children}
      </View>
    </View>
  );
}

function HeaderButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <FocusablePressable
      role="button"
      aria-label={label}
      onPress={onPress}
      style={styles.headerButton}>
      <ThemedText type="default" style={{ color: theme.accent }}>
        {label}
      </ThemedText>
    </FocusablePressable>
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
  section: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  primaryButton: {
    minHeight: MinTouchTarget + 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
    marginBottom: Spacing.three,
  },
  headerButton: {
    minHeight: MinTouchTarget,
    minWidth: MinTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
});
