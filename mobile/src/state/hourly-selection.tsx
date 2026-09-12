/**
 * What the Hourly screen is showing. Shared so the station picker and the Overview's city detail
 * ("Open hourly analysis") can change it.
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { HourlyPollutant } from '@/api/types';

export interface HourlySelection {
  /** null until the user picks one; the screen then falls back to the first city with stations. */
  cityId: number | null;
  /** null means the average of the city's stations. */
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

export function useHourlySelection(): HourlySelectionContextValue {
  const context = useContext(HourlySelectionContext);
  if (!context) throw new Error('useHourlySelection must be used inside HourlySelectionProvider');
  return context;
}
