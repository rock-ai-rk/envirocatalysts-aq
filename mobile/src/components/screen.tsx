import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Scrollable tab screen with a heading, safe-area padding and a readable max width on tablets.
 * Pass `refresh` (from usePullToRefresh) for pull to refresh.
 */
export function Screen({
  title,
  refresh,
  children,
}: {
  title: string;
  refresh?: { refreshing: boolean; onRefresh: () => void };
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <ScreenFrame>
      <ScrollView
        contentContainerStyle={screenStyles.content}
        refreshControl={
          refresh ? (
            <RefreshControl
              refreshing={refresh.refreshing}
              onRefresh={refresh.onRefresh}
              tintColor={theme.accent}
              colors={[theme.accent]}
            />
          ) : undefined
        }>
        <ScreenTitle>{title}</ScreenTitle>
        {children}
      </ScrollView>
    </ScreenFrame>
  );
}

/** Background and safe area, for screens that bring their own scroll view (e.g. a FlatList). */
export function ScreenFrame({ children }: { children: ReactNode }) {
  return (
    <ThemedView style={screenStyles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={screenStyles.container}>
        {children}
      </SafeAreaView>
    </ThemedView>
  );
}

// At 28pt a title is already large text; beyond 2x a word like "analysis" no longer fits a phone
// and breaks mid-word.
const TITLE_MAX_SCALE = 2;

export function ScreenTitle({ children }: { children: string }) {
  return (
    <ThemedText type="screenTitle" role="heading" maxFontSizeMultiplier={TITLE_MAX_SCALE}>
      {children}
    </ThemedText>
  );
}

export const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
});
