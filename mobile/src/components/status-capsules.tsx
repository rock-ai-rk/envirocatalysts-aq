import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { FocusablePressable } from '@/components/focusable-pressable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useLargeText } from '@/hooks/use-large-text';
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

interface Props {
  query: QueryState;
  /** The screen's dataset is generated demo data. */
  demo: boolean;
  /** Cities left out of the ranking, and the period whose rules left them out. */
  notRanked: { count: number; periodLabel: string } | null;
}

/**
 * One row of small capsules for the Overview's status: demo data, how old the data is (or that
 * the phone is offline), and how many cities aren't ranked. It replaces four stacked banners.
 * A capsule that needs explaining opens its explanation and says it in its spoken label. The row
 * scrolls sideways, and wraps instead at large text sizes.
 */
export function StatusCapsules({ query, demo, notRanked }: Props) {
  const router = useRouter();
  const online = useOnline();
  const now = useNow();
  const wrap = useLargeText();

  const capsules: ReactNode[] = [];
  if (demo) {
    const text = 'These numbers are generated, not real measurements.';
    capsules.push(
      <Capsule
        key="demo"
        notice
        label="Demo data ⓘ"
        spoken={`Demo data. ${text}`}
        onPress={() => Alert.alert('Demo data', text)}
      />,
    );
  }

  if (query.isPlaceholderData) {
    capsules.push(<Capsule key="age" label="Loading the new selection…" />);
  } else if (!query.data && !online) {
    const text = 'You’re offline, and nothing is saved on this phone yet for this selection.';
    capsules.push(
      <Capsule
        key="age"
        notice
        live
        label="Offline ⓘ"
        spoken={text}
        onPress={() => Alert.alert('Offline', text)}
      />,
    );
  } else if (query.data && query.dataUpdatedAt) {
    const saved = new Date(query.dataUpdatedAt).toISOString();
    const age = formatAge(saved, false, now);
    const spokenAge = formatAge(saved, true, now);
    const problem = !online ? 'Offline' : query.isError ? 'Couldn’t refresh' : null;
    if (problem) {
      const text = online
        ? `Couldn’t reach the server, so this is what the phone saved ${spokenAge}.`
        : `You’re offline. This is what the phone saved ${spokenAge}; it updates when you’re back online.`;
      capsules.push(
        <Capsule
          key="age"
          notice
          live
          label={`${problem} · saved ${age} ⓘ`}
          spoken={text}
          onPress={() => Alert.alert(problem, text)}
        />,
      );
    } else {
      capsules.push(
        <Capsule
          key="age"
          label={`Updated ${age}${query.isFetching ? ' · refreshing…' : ''}`}
          spoken={`Updated ${spokenAge}${query.isFetching ? ', refreshing' : ''}`}
        />,
      );
    }
  }

  if (notRanked && notRanked.count > 0) {
    const cities = `${notRanked.count} ${notRanked.count === 1 ? 'city' : 'cities'}`;
    capsules.push(
      <Capsule
        key="coverage"
        label={`${cities} not ranked ⓘ`}
        spoken={`${cities} not ranked for ${notRanked.periodLabel}. Why?`}
        hint="Explains the data coverage rules and lists the cities"
        onPress={() => router.push('/coverage')}
      />,
    );
  }

  if (!capsules.length) return null;
  if (wrap) return <View style={[styles.row, styles.wrap]}>{capsules}</View>;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroller}
      contentContainerStyle={[styles.row, styles.scrollContent]}>
      {capsules}
    </ScrollView>
  );
}

interface CapsuleProps {
  label: string;
  spoken?: string;
  hint?: string;
  /** Uses the notice colours, for things that change how to read the numbers. */
  notice?: boolean;
  /** Announced when it appears (e.g. going offline). */
  live?: boolean;
  onPress?: () => void;
}

function Capsule({ label, spoken, hint, notice = false, live = false, onPress }: CapsuleProps) {
  const theme = useTheme();
  const colors = notice
    ? { backgroundColor: theme.noticeBackground, borderColor: theme.noticeBackground }
    : { backgroundColor: theme.background, borderColor: theme.border };
  const text = (
    <ThemedText
      type={notice ? 'smallBold' : 'small'}
      style={{ color: notice ? theme.noticeText : onPress ? theme.text : theme.textSecondary }}>
      {label}
    </ThemedText>
  );

  if (!onPress) {
    return (
      <View
        accessible
        aria-label={spoken ?? label}
        aria-live={live ? 'polite' : undefined}
        style={[styles.capsule, colors]}>
        {text}
      </View>
    );
  }
  return (
    <FocusablePressable
      role="button"
      aria-label={spoken ?? label}
      aria-live={live ? 'polite' : undefined}
      accessibilityHint={hint}
      onPress={onPress}
      // 36pt tall to look like a label; the slop makes the touch target 44pt.
      hitSlop={{ top: 4, bottom: 4 }}
      style={[styles.capsule, colors]}>
      {text}
    </FocusablePressable>
  );
}

const styles = StyleSheet.create({
  // A sideways scroller has to reach the screen edge, or its last item is sliced at the
  // gutter. It spans the full width and carries the gutter as content padding instead, so the
  // first item still lines up with everything above it.
  scroller: {
    marginHorizontal: -Spacing.three,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  wrap: {
    flexWrap: 'wrap',
  },
  capsule: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    borderWidth: 1,
  },
});
