/** Hooks for the scraped CPCB real-time readings (`/v1/live/*`). Types mirror backend/app/schemas.py. */

import { useQuery } from '@tanstack/react-query';

import { apiGet } from './client';

export type Pollutant = 'PM2.5' | 'PM10' | 'NO2' | 'SO2' | 'CO' | 'O3' | 'NH3';

export interface PollutantReading {
  pollutant: Pollutant;
  avg: number | null;
  min: number | null;
  max: number | null;
  observed_at: string;
  stale: boolean;
}

export interface StationLatest {
  id: number;
  name: string;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  readings: PollutantReading[];
}

export interface LiveLatestResponse {
  as_of: string | null;
  stale_after_hours: number;
  stations: StationLatest[];
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

export function useLiveLatest(params: { state?: string | null; city?: string | null }) {
  return useQuery({
    queryKey: ['live', 'latest', params],
    queryFn: () => apiGet<LiveLatestResponse>('/v1/live/latest', params),
    staleTime: LIVE_STALE_TIME_MS,
  });
}
