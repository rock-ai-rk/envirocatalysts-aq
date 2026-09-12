import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { queryClient } from '@/api/query-client';
import { HeaderCloseButton } from '@/components/header-close-button';
import { HourlySelectionProvider } from '@/state/hourly-selection';
import { OverviewFiltersProvider } from '@/state/overview-filters';

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
    <QueryClientProvider client={queryClient}>
      <OverviewFiltersProvider>
        <HourlySelectionProvider>
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
        </HourlySelectionProvider>
      </OverviewFiltersProvider>
    </QueryClientProvider>
  );
}
