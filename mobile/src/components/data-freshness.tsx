import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useNow, useOnline } from '@/hooks/use-online';
import { useTheme } from '@/hooks/use-theme';
import { formatAge } from '@/lib/format';

interface QueryState {
  data: unknown;
  dataUpdatedAt: number;
  isFetching: boolean;
  isError: boolean;
  isPlaceholderData: boolean;
}

/**
 * How old the data on screen is: "Updated 5 min ago", "Updated 2 h ago · refreshing…", or, when
 * the app is showing saved data it couldn't refresh, says so in words rather than by colour.
 */
export function DataFreshness({ query }: { query: QueryState }) {
  const theme = useTheme();
  const online = useOnline();
  const now = useNow();

  if (query.isPlaceholderData) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        Loading the new selection…
      </ThemedText>
    );
  }
  if (!query.data || !query.dataUpdatedAt) return null;

  const saved = new Date(query.dataUpdatedAt).toISOString();
  const age = formatAge(saved, false, now);
  const spokenAge = formatAge(saved, true, now);
  const problem = !online ? 'Offline' : query.isError ? 'Couldn’t refresh' : null;

  if (problem) {
    return (
      <View
        accessible
        aria-label={`${problem}. Showing data saved ${spokenAge}.`}
        style={[styles.notice, { backgroundColor: theme.noticeBackground }]}>
        <ThemedText type="smallBold" style={{ color: theme.noticeText }}>
          {`${problem} · saved ${age}`}
        </ThemedText>
      </View>
    );
  }
  return (
    <ThemedText
      type="small"
      themeColor="textSecondary"
      aria-label={`Updated ${spokenAge}${query.isFetching ? ', refreshing' : ''}`}>
      {`Updated ${age}${query.isFetching ? ' · refreshing…' : ''}`}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  notice: {
    alignSelf: 'flex-start',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
});
