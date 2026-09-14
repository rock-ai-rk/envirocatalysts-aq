import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { API_URL } from './config';

/**
 * How long answers saved on the phone stay usable. Historical data only changes when the importer
 * runs, so a week-old copy is still worth showing when there is no connection.
 */
export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  // Kept in memory as long as they are kept on disk, or a restored answer would be dropped at once.
  defaultOptions: { queries: { retry: 1, gcTime: CACHE_MAX_AGE_MS } },
});

/**
 * Saves the query cache to AsyncStorage, so the app opens straight onto the last data it showed
 * and refreshes it in the background (stale-while-revalidate), online or not.
 */
export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'query-cache-v1',
  throttleTime: 2000,
});

// Answers saved from another API address, or before a response shape changed, are thrown away.
export const CACHE_BUSTER = `${API_URL}#1`;

// React Query only knows about browser focus; tell it when the app comes back to the foreground
// so stale readings refresh then.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (status) => focusManager.setFocused(status === 'active'));
}

// Offline, queries pause instead of failing, and resume by themselves when the connection returns.
// `isConnected` is null while NetInfo is still checking; treat that as online.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
);
