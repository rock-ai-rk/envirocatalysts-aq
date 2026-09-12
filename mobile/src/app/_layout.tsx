import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { queryClient } from '@/api/query-client';
import { OverviewFiltersProvider } from '@/state/overview-filters';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <OverviewFiltersProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="filters" options={{ presentation: 'modal', title: 'Filters' }} />
          </Stack>
        </ThemeProvider>
      </OverviewFiltersProvider>
    </QueryClientProvider>
  );
}
