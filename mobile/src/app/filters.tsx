import { Stack, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMeta } from '@/api/history';
import type { CityGroup } from '@/api/types';
import { ChoiceCard } from '@/components/choice-card';
import { ChoiceChip } from '@/components/choice-chip';
import { FocusablePressable } from '@/components/focusable-pressable';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  DEFAULT_FILTERS,
  GROUP_LABELS,
  RANK_METRICS,
  useOverviewFilters,
  type OverviewFilters,
  type TopN,
} from '@/state/overview-filters';

// Offer a search field once the state list is long enough to be tedious to scan.
const SEARCH_FROM = 8;

/**
 * Every Overview filter in one sheet. Changes are drafted here and applied together on
 * "Show results", so the list re-queries once rather than on every tap.
 */
export default function FiltersScreen() {
  const theme = useTheme();
  const router = useRouter();
  const meta = useMeta();
  const { filters, setFilters } = useOverviewFilters();
  const [draft, setDraft] = useState<OverviewFilters>(filters);
  const [stateQuery, setStateQuery] = useState('');
  const update = (patch: Partial<OverviewFilters>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const financialYears = (meta.data?.periods ?? []).filter((p) => p.frequency === 'FY');
  const groups =
    meta.data?.groups ??
    (Object.keys(GROUP_LABELS) as CityGroup[]).map((code) => ({
      code,
      label: GROUP_LABELS[code],
      description: '',
    }));
  const states = meta.data?.states ?? [];
  const query = stateQuery.trim().toLowerCase();
  const shownStates = query ? states.filter((s) => s.toLowerCase().includes(query)) : states;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          headerLeft: () => <HeaderButton label="Cancel" onPress={() => router.back()} />,
          headerRight: () => (
            <HeaderButton label="Reset" onPress={() => setDraft(DEFAULT_FILTERS)} />
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {financialYears.length > 1 ? (
          <>
            <FilterSection title="Base period">
              {financialYears.map((p) => (
                <ChoiceChip
                  key={p.key}
                  label={p.label}
                  selected={draft.base === p.key}
                  onPress={() => update({ base: p.key })}
                />
              ))}
            </FilterSection>
            <FilterSection title="Compare with">
              {financialYears.map((p) => (
                <ChoiceChip
                  key={p.key}
                  label={p.label}
                  selected={draft.comparison === p.key}
                  onPress={() => update({ comparison: p.key })}
                />
              ))}
            </FilterSection>
          </>
        ) : null}

        <FilterSection
          title="Geography"
          above={
            states.length > SEARCH_FROM ? (
              <TextInput
                value={stateQuery}
                onChangeText={setStateQuery}
                placeholder="Search states"
                placeholderTextColor={theme.textSecondary}
                aria-label="Search states"
                autoCorrect={false}
                style={[
                  styles.search,
                  { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
                ]}
              />
            ) : null
          }>
          <ChoiceChip
            label="All India"
            selected={draft.state === null}
            onPress={() => update({ state: null })}
          />
          {shownStates.map((state) => (
            <ChoiceChip
              key={state}
              label={state}
              selected={draft.state === state}
              onPress={() => update({ state })}
            />
          ))}
        </FilterSection>

        {/* Cards rather than chips: "IGP" or "MPC" mean nothing without their one-line explanation. */}
        <FilterSection title="City group" stacked>
          <ChoiceCard
            label="All groups"
            selected={draft.group === null}
            onPress={() => update({ group: null })}
          />
          {groups.map((group) => (
            <ChoiceCard
              key={group.code}
              label={group.label}
              description={group.description || undefined}
              selected={draft.group === group.code}
              onPress={() => update({ group: group.code })}
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
            onChange={(value) =>
              update({ top: (value === 'all' ? 'all' : Number(value)) as TopN })
            }
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

function FilterSection({
  title,
  above,
  stacked = false,
  children,
}: {
  title: string;
  /** Rendered between the heading and the options, e.g. a search field. */
  above?: ReactNode;
  /** Options one per line (cards) rather than wrapping side by side (chips). */
  stacked?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <ThemedText type="sectionTitle" role="heading">
        {title}
      </ThemedText>
      {above}
      <View role="radiogroup" aria-label={title} style={stacked ? styles.cards : styles.chips}>
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
  cards: {
    gap: Spacing.two,
  },
  search: {
    minHeight: MinTouchTarget,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
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
    borderRadius: 999,
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
