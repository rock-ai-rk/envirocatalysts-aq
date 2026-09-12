import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

/** Scrollable tab screen with a heading, safe-area padding and a readable max width on tablets. */
export function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ScreenFrame>
      <ScrollView contentContainerStyle={screenStyles.content}>
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

export function ScreenTitle({ children }: { children: string }) {
  return (
    <ThemedText type="screenTitle" role="heading">
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
