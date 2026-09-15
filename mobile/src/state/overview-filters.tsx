/**
 * Filters for the Overview screen, shared with the filters sheet and the coverage sheet. Only
 * filters that change which cities are listed live here; the period view and metric tab are local
 * to the screen.
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { OverviewParams } from '@/api/history';
import type { CityGroup, Direction, RankBy } from '@/api/types';
import { DEFAULT_BASE_PERIOD, DEFAULT_COMPARISON_PERIOD } from '@/constants/periods';

export type TopN = 10 | 20 | 'all';

export interface OverviewFilters {
  base: string;
  comparison: string;
  /** null means All India. */
  state: string | null;
  group: CityGroup | null;
  rankBy: RankBy;
  direction: Direction;
  top: TopN;
}

export const DEFAULT_FILTERS: OverviewFilters = {
  base: DEFAULT_BASE_PERIOD,
  comparison: DEFAULT_COMPARISON_PERIOD,
  state: null,
  group: null,
  rankBy: 'good_days',
  direction: 'best',
  top: 10,
};

/** Fallback labels for the group chips; the API's /v1/meta has the same list. */
export const GROUP_LABELS: Record<CityGroup, string> = {
  NCAP: 'NCAP',
  MPC: 'MPC',
  IGP: 'IGP',
  DELHI_NCR: 'Delhi NCR',
  STATE_CAPITALS: 'State Capitals',
};

export const RANK_METRICS: { value: RankBy; label: string }[] = [
  { value: 'good_days', label: 'Good days' },
  { value: 'PM2.5', label: 'PM2.5' },
  { value: 'PM10', label: 'PM10' },
  { value: 'NO2', label: 'NO2' },
  { value: 'O3', label: 'O3' },
  { value: 'CO', label: 'CO' },
];

export function toOverviewParams(filters: OverviewFilters): OverviewParams {
  return {
    base: filters.base,
    comparison: filters.comparison,
    state: filters.state,
    group: filters.group,
    rankBy: filters.rankBy,
    direction: filters.direction,
    top: filters.top === 'all' ? 0 : filters.top,
  };
}

/** One-line description of the active filters, used on screen and read by screen readers. */
export function describeFilters(filters: OverviewFilters): string {
  const place = filters.state ?? 'All India';
  const group = filters.group ? GROUP_LABELS[filters.group] : 'All groups';
  const metric = RANK_METRICS.find((m) => m.value === filters.rankBy)?.label ?? filters.rankBy;
  const scope = filters.top === 'all' ? 'All cities' : `Top ${filters.top}`;
  const order = filters.direction === 'best' ? 'best first' : 'worst first';
  return `${place} · ${group} · ${scope} by ${metric}, ${order}`;
}

/**
 * The filters sheet's button: how many cities the drafted filters will list, before they are
 * applied. `eligible` is how many cities in the drafted state and group pass the data rules.
 */
export function describeMatches(eligible: number, top: TopN): string {
  const noun = eligible === 1 ? 'city' : 'cities';
  if (top === 'all' || eligible <= top) return `Show ${eligible} ${noun}`;
  return `Show top ${top} of ${eligible} ${noun}`;
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
