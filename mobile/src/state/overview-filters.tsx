/**
 * Filters for the Overview screen, shared with the filters sheet. Only filters that change which
 * cities are listed live here; the period view and metric tab are local to the screen.
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type CityGroup = 'NCAP' | 'MPC' | 'IGP' | 'DELHI_NCR' | 'STATE_CAPITALS';
export type RankMetric = 'good_days' | 'PM2.5' | 'PM10' | 'NO2' | 'O3' | 'CO';
export type RankDirection = 'best' | 'worst';
export type TopN = 10 | 20 | 'all';

export interface OverviewFilters {
  /** null means All India. */
  state: string | null;
  group: CityGroup | null;
  rankBy: RankMetric;
  direction: RankDirection;
  top: TopN;
}

export const DEFAULT_FILTERS: OverviewFilters = {
  state: null,
  group: null,
  rankBy: 'good_days',
  direction: 'best',
  top: 10,
};

export const CITY_GROUPS: { value: CityGroup; label: string; description: string }[] = [
  { value: 'NCAP', label: 'NCAP', description: 'National Clean Air Programme cities' },
  { value: 'MPC', label: 'MPC', description: 'Million-plus cities' },
  { value: 'IGP', label: 'IGP', description: 'Indo-Gangetic Plain cities' },
  { value: 'DELHI_NCR', label: 'Delhi NCR', description: 'Delhi National Capital Region' },
  { value: 'STATE_CAPITALS', label: 'State Capitals', description: 'State and UT capitals' },
];

export const RANK_METRICS: { value: RankMetric; label: string }[] = [
  { value: 'good_days', label: 'Good days' },
  { value: 'PM2.5', label: 'PM2.5' },
  { value: 'PM10', label: 'PM10' },
  { value: 'NO2', label: 'NO2' },
  { value: 'O3', label: 'O3' },
  { value: 'CO', label: 'CO' },
];

/** One-line description of the active filters, used on screen and read by screen readers. */
export function describeFilters(filters: OverviewFilters): string {
  const place = filters.state ?? 'All India';
  const group = CITY_GROUPS.find((g) => g.value === filters.group)?.label ?? 'All groups';
  const metric = RANK_METRICS.find((m) => m.value === filters.rankBy)?.label ?? filters.rankBy;
  const scope = filters.top === 'all' ? 'All cities' : `Top ${filters.top}`;
  const order = filters.direction === 'best' ? 'best first' : 'worst first';
  return `${place} · ${group} · ${scope} by ${metric}, ${order}`;
}

export function countActiveFilters(filters: OverviewFilters): number {
  return (Object.keys(DEFAULT_FILTERS) as (keyof OverviewFilters)[]).filter(
    (key) => filters[key] !== DEFAULT_FILTERS[key],
  ).length;
}

interface FiltersContextValue {
  filters: OverviewFilters;
  setFilters: (filters: OverviewFilters) => void;
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

export function OverviewFiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const value = useMemo(() => ({ filters, setFilters }), [filters]);
  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useOverviewFilters(): FiltersContextValue {
  const context = useContext(FiltersContext);
  if (!context) throw new Error('useOverviewFilters must be used inside OverviewFiltersProvider');
  return context;
}
