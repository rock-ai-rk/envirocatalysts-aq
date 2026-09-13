/**
 * Hooks for the readings the scraper stores from CPCB's real-time feed. Types mirror
 * backend/app/schemas/live.py.
 *
 * The feed's values are AQI sub-indices (0-500), not concentrations, so they are never shown
 * with a unit.
 */

import { useQuery } from '@tanstack/react-query';

import { apiGet } from './client';
import type { AqiCategoryKey, City, Station } from './types';

export type Pollutant = 'PM2.5' | 'PM10' | 'NO2' | 'SO2' | 'CO' | 'O3' | 'NH3';

export interface PollutantReading {
  pollutant: Pollutant;
  avg: number | null;
  min: number | null;
  max: number | null;
  observed_at: string;
  stale: boolean;
}

/** GET /v1/stations/{id}/latest */
export interface StationLatest {
  station: Station;
  city: City;
  status: 'ok' | 'stale' | 'no_recent_readings' | 'no_live_station';
  source: string;
  measure: 'aqi_sub_index';
  link: {
    live_station_id: number;
    live_station_name: string;
    method: 'name' | 'distance' | 'manual';
    distance_m: number | null;
  } | null;
  observed_at: string | null;
  fetched_at: string | null;
  stale_after_hours: number;
  aqi: { value: number; category: AqiCategoryKey; dominant: Pollutant; pollutants_used: number } | null;
  readings: PollutantReading[];
}

export interface CityLatest {
  city: string;
  state: string;
  avg: number;
  station_count: number;
  observed_at: string;
}

export interface LiveCitiesResponse {
  pollutant: Pollutant;
  cities: CityLatest[];
}

// CPCB publishes roughly hourly, so refetching more often than this is wasted work.
const LIVE_STALE_TIME_MS = 5 * 60 * 1000;

export function useLiveCities(params: {
  pollutant?: Pollutant;
  state?: string | null;
  order?: 'asc' | 'desc';
  limit?: number;
}) {
  return useQuery({
    queryKey: ['live', 'cities', params],
    queryFn: () => apiGet<LiveCitiesResponse>('/v1/live/cities', params),
    staleTime: LIVE_STALE_TIME_MS,
  });
}

export function useStationLatest(stationId: number | null) {
  return useQuery({
    queryKey: ['live', 'station', stationId],
    queryFn: () => apiGet<StationLatest>(`/v1/stations/${stationId}/latest`),
    enabled: stationId !== null,
    staleTime: LIVE_STALE_TIME_MS,
    // The screen stays open while the feed moves on; check again every quarter hour.
    refetchInterval: 15 * 60 * 1000,
  });
}
