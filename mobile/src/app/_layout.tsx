import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { CACHE_BUSTER, CACHE_MAX_AGE_MS, queryClient, queryPersister } from '@/api/query-client';
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

// Held until the type is ready, so text never draws in the system font and reflows a frame later.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const typeReady = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    if (typeReady) SplashScreen.hideAsync().catch(() => {});
  }, [typeReady]);

  // A font that fails to load still lets the app through, on the system face rather than a
  // permanent splash.
  if (!typeReady) return null;

  return (
    // The trend chart's scrub and the window strip's drag are Gesture Handler gestures.
    <GestureHandlerRootView style={styles.root}>
      {/* Restores the answers saved on the phone before any screen asks the API again. */}
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: queryPersister, maxAge: CACHE_MAX_AGE_MS, buster: CACHE_BUSTER }}>
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
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
