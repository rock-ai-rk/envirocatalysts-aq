/**
 * Favourite and recently viewed stations, kept on the device so the picker can list them first.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'station-prefs-v1';
const MAX_RECENTS = 5;

interface StationPrefs {
  favorites: number[];
  /** Most recent first. */
  recents: number[];
}

interface StationPrefsContextValue extends StationPrefs {
  isFavorite: (stationId: number) => boolean;
  toggleFavorite: (stationId: number) => void;
  addRecent: (stationId: number) => void;
}

const StationPrefsContext = createContext<StationPrefsContextValue | null>(null);

export function StationPrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<StationPrefs>({ favorites: [], recents: [] });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const saved = parse(raw);
        // Anything changed before the saved copy arrived wins, and goes first.
        setPrefs((current) => ({
          favorites: unique([...current.favorites, ...saved.favorites]),
          recents: unique([...current.recents, ...saved.recents]).slice(0, MAX_RECENTS),
        }));
      })
      .catch(() => {}) // Nothing saved, or storage unavailable: start empty.
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)).catch(() => {});
  }, [prefs, loaded]);

  const value = useMemo<StationPrefsContextValue>(
    () => ({
      ...prefs,
      isFavorite: (stationId) => prefs.favorites.includes(stationId),
      toggleFavorite: (stationId) =>
        setPrefs((current) => ({
          ...current,
          favorites: current.favorites.includes(stationId)
            ? current.favorites.filter((id) => id !== stationId)
            : [...current.favorites, stationId],
        })),
      addRecent: (stationId) =>
        setPrefs((current) => ({
          ...current,
          recents: unique([stationId, ...current.recents]).slice(0, MAX_RECENTS),
        })),
    }),
    [prefs],
  );

  return <StationPrefsContext.Provider value={value}>{children}</StationPrefsContext.Provider>;
}

export function useStationPrefs(): StationPrefsContextValue {
  const context = useContext(StationPrefsContext);
  if (!context) throw new Error('useStationPrefs must be used inside StationPrefsProvider');
  return context;
}

function parse(raw: string | null): StationPrefs {
  try {
    const value = raw ? JSON.parse(raw) : null;
    const ids = (list: unknown) =>
      Array.isArray(list) ? list.filter((id): id is number => Number.isInteger(id)) : [];
    return { favorites: ids(value?.favorites), recents: ids(value?.recents) };
  } catch {
    return { favorites: [], recents: [] };
  }
}

function unique(ids: number[]): number[] {
  return [...new Set(ids)];
}
