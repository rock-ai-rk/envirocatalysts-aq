import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { FocusablePressable } from '@/components/focusable-pressable';
import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { useLargeText } from '@/hooks/use-large-text';
import { useTheme } from '@/hooks/use-theme';
import { countActiveFilters, describeFilters, useOverviewFilters } from '@/state/overview-filters';

/**
 * Replaces the source app's row of dropdowns: one line saying what's shown, and one button that
 * opens every filter in a sheet.
 */
export function FilterSummaryBar() {
  const theme = useTheme();
  const router = useRouter();
  const { filters } = useOverviewFilters();
  const summary = describeFilters(filters);
  const active = countActiveFilters(filters);
  // Side by side at large text sizes, the button squeezes the summary to a word per line.
  const stacked = useLargeText();

  return (
    <View style={[styles.row, stacked && styles.stacked]}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.summary}>
        {summary}
      </ThemedText>
      <FocusablePressable
        role="button"
        aria-label={active ? `Filters, ${active} changed` : 'Filters'}
        accessibilityHint="Opens geography, city group and ranking options"
        onPress={() => router.push('/filters')}
        style={[styles.button, { borderColor: theme.border, backgroundColor: theme.background }]}>
        <ThemedText type="smallBold">{active ? `Filters (${active})` : 'Filters'}</ThemedText>
      </FocusablePressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  stacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  summary: {
    flexShrink: 1,
    flexGrow: 1,
  },
  button: {
    minHeight: MinTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
});
