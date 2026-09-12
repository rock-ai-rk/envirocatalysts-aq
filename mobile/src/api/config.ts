import Constants from 'expo-constants';

/**
 * Base URL of the backend. Set EXPO_PUBLIC_API_URL to override. In development it defaults to the
 * machine serving the JS bundle, which works for simulators and for phones on the same Wi-Fi
 * (start the API with `--host 0.0.0.0` for the latter).
 */
function resolveApiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/+$/, '');

  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${devHost ?? 'localhost'}:8000`;
}

export const API_URL = resolveApiUrl();
