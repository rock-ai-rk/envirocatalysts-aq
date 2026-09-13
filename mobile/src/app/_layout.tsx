import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StyleSheet, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { queryClient } from '@/api/query-client';
import { HeaderCloseButton } from '@/components/header-close-button';
import { HourlySelectionProvider } from '@/state/hourly-selection';
import { OverviewFiltersProvider } from '@/state/overview-filters';
import { StationPrefsProvider } from '@/state/station-prefs';

// A deep link straight to a modal (or a web refresh on one) still gets the tabs underneath, so
// Close and Back always have somewhere to go.
export const unstable_settings = { anchor: '(tabs)' };

function modal(title: string) {
  return {
    presentation: 'modal' as const,
    title,
    headerRight: () => <HeaderCloseButton />,
  };
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    // The trend chart's scrub and the window strip's drag are Gesture Handler gestures.
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <OverviewFiltersProvider>
          <HourlySelectionProvider>
            <StationPrefsProvider>
              <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <Stack>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  {/* The filters sheet has its own Cancel and Reset buttons. */}
                  <Stack.Screen name="filters" options={{ presentation: 'modal', title: 'Filters' }} />
                  <Stack.Screen name="coverage" options={modal('Why some cities aren’t ranked')} />
                  <Stack.Screen name="city/[id]" options={modal('City')} />
                  <Stack.Screen name="station-picker" options={modal('Choose a station')} />
                  <Stack.Screen name="hourly-day" options={modal('Day')} />
                </Stack>
              </ThemeProvider>
            </StationPrefsProvider>
          </HourlySelectionProvider>
        </OverviewFiltersProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
