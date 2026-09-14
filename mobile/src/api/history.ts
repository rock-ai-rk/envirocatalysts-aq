/** Hooks for the historical endpoints behind the Overview and Hourly screens. */

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { apiGet } from './client';
import type {
  CityCoverage,
  CityDetail,
  DayHeatmap,
  Direction,
  Heatmap,
  HourlyCity,
  HourlyPollutant,
  HourlySummary,
  Meta,
  Overview,
  RankBy,
  StationSeries,
} from './types';

// Historical data only changes when someone runs the importer, so cached responses stay good
// for the whole session; revisiting a filter combination is instant.
const HISTORY_STALE_TIME_MS = 60 * 60 * 1000;

export interface OverviewParams {
  base: string;
  comparison: string;
  state: string | null;
  group: string | null;
  rankBy: RankBy;
  direction: Direction;
  /** 0 means every city. */
  top: number;
}

export function useMeta() {
  return useQuery({
    queryKey: ['meta'],
    queryFn: () => apiGet<Meta>('/v1/meta'),
    staleTime: HISTORY_STALE_TIME_MS,
  });
}

export function useOverview(params: OverviewParams, enabled = true) {
  return useQuery({
    queryKey: ['overview', params],
    queryFn: () =>
      apiGet<Overview>('/v1/overview', {
        base: params.base,
        comparison: params.comparison,
        state: params.state,
        group: params.group,
        rank_by: params.rankBy,
        direction: params.direction,
        top: params.top,
      }),
    staleTime: HISTORY_STALE_TIME_MS,
    // Keep showing the previous list while a new filter combination loads, instead of a spinner.
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useCityDetail(cityId: number, base: string, comparison: string) {
  return useQuery({
    queryKey: ['city', cityId, base, comparison],
    queryFn: () => apiGet<CityDetail>(`/v1/cities/${cityId}`, { base, comparison }),
    staleTime: HISTORY_STALE_TIME_MS,
  });
}

/** Whether a city meets the data rules for a period, and which ones it fails. */
export function useCoverage(cityId: number | null, period: string) {
  return useQuery({
    queryKey: ['coverage', cityId, period],
    queryFn: () => apiGet<CityCoverage>(`/v1/coverage/${cityId}`, { period }),
    enabled: cityId !== null,
    staleTime: HISTORY_STALE_TIME_MS,
  });
}

export function useHourlyCities() {
  return useQuery({
    queryKey: ['hourly', 'cities'],
    queryFn: () => apiGet<HourlyCity[]>('/v1/hourly/cities'),
    staleTime: HISTORY_STALE_TIME_MS,
  });
}

export interface HourlyParams {
  cityId: number;
  stationId: number | null;
  pollutant: HourlyPollutant;
  base: string;
  comparison: string;
}

export function useHourlySummary(params: HourlyParams | null) {
  return useQuery({
    queryKey: ['hourly', 'summary', params],
    queryFn: () =>
      apiGet<HourlySummary>('/v1/hourly/summary', {
        city_id: params!.cityId,
        station_id: params!.stationId,
        pollutant: params!.pollutant,
        base: params!.base,
        comparison: params!.comparison,
      }),
    enabled: params !== null,
    staleTime: HISTORY_STALE_TIME_MS,
    placeholderData: keepPreviousData,
  });
}

export function useHeatmap(
  params: { cityId: number; pollutant: HourlyPollutant; period: string; top: number } | null,
) {
  return useQuery({
    queryKey: ['hourly', 'heatmap', params],
    queryFn: () =>
      apiGet<Heatmap>('/v1/hourly/heatmap', {
        city_id: params!.cityId,
        pollutant: params!.pollutant,
        period: params!.period,
        top: params!.top,
      }),
    enabled: params !== null,
    staleTime: HISTORY_STALE_TIME_MS,
    placeholderData: keepPreviousData,
  });
}

export interface SeriesParams {
  stationId: number;
  pollutant: HourlyPollutant;
  /** First day, YYYY-MM-DD (IST). */
  from: string;
  /** Day after the last one, YYYY-MM-DD. */
  to: string;
}

/** One station's values over a window: hourly up to 31 days, daily means beyond. */
export function useStationSeries(params: SeriesParams | null) {
  return useQuery({
    queryKey: ['stations', 'series', params],
    queryFn: () =>
      apiGet<StationSeries>(`/v1/stations/${params!.stationId}/hourly`, {
        from: params!.from,
        to: params!.to,
        pollutant: params!.pollutant,
      }),
    enabled: params !== null,
    staleTime: HISTORY_STALE_TIME_MS,
    // Every window you browse is its own query. Dropping unused ones after half an hour keeps the
    // copy saved on the phone from growing with each week you scroll past.
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useDayHeatmap(cityId: number, pollutant: HourlyPollutant, day: string) {
  return useQuery({
    queryKey: ['hourly', 'day', cityId, pollutant, day],
    queryFn: () => apiGet<DayHeatmap>('/v1/hourly/day', { city_id: cityId, pollutant, day }),
    staleTime: HISTORY_STALE_TIME_MS,
  });
}
