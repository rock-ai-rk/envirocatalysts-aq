/**
 * What the Hourly screen is showing. Shared so the station picker and the Overview's city detail
 * ("Open hourly analysis") can change it.
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { HourlyCity, HourlyPollutant, Station } from '@/api/types';

// The source dashboard opens on Delhi; fall back to the first city with stations.
const PREFERRED_CITY = 'Delhi';

export interface HourlySelection {
  /** null until the user picks one; the screen then falls back to the first city with stations. */
  cityId: number | null;
  /** null (e.g. arriving from a city's detail sheet) means the city's first station. */
  stationId: number | null;
  pollutant: HourlyPollutant;
}

interface HourlySelectionContextValue {
  selection: HourlySelection;
  select: (changes: Partial<HourlySelection>) => void;
}

const HourlySelectionContext = createContext<HourlySelectionContextValue | null>(null);

export function HourlySelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<HourlySelection>({
    cityId: null,
    stationId: null,
    pollutant: 'PM2.5',
  });
  const value = useMemo(
    () => ({
      selection,
      select: (changes: Partial<HourlySelection>) =>
        setSelection((current) => ({ ...current, ...changes })),
    }),
    [selection],
  );
  return (
    <HourlySelectionContext.Provider value={value}>{children}</HourlySelectionContext.Provider>
  );
}

/** The city and station the Hourly screen actually shows, after the fallbacks above. */
export function resolveStation(
  cities: HourlyCity[] | undefined,
  selection: HourlySelection,
): { entry: HourlyCity; station: Station } | null {
  const entry =
    cities?.find((c) => c.city.id === selection.cityId) ??
    cities?.find((c) => c.city.name === PREFERRED_CITY) ??
    cities?.[0];
  const station = entry?.stations.find((s) => s.id === selection.stationId) ?? entry?.stations[0];
  return entry && station ? { entry, station } : null;
}

export function useHourlySelection(): HourlySelectionContextValue {
  const context = useContext(HourlySelectionContext);
  if (!context) throw new Error('useHourlySelection must be used inside HourlySelectionProvider');
  return context;
}
