/**
 * Hooks for the values the scraper stores from Open-Meteo (the CAMS air-quality model). Types
 * mirror backend/app/schemas/live.py.
 *
 * The values are model estimates for the ~45 km area around a city, not station measurements, and
 * the AQI is CPCB's formula applied to them, so the cards always say so and show the source credit
 * that the data's licence asks for.
 */

import { useQuery } from '@tanstack/react-query';

import { apiGet } from './client';
import type { AqiCategoryKey, City, CityGroup } from './types';

export type Pollutant = 'PM2.5' | 'PM10' | 'NO2' | 'SO2' | 'CO' | 'O3' | 'NH3';

export interface LiveReading {
  pollutant: Pollutant;
  value: number;
  unit: string;
  observed_at: string;
}

export interface EstimatedAqi {
  value: number;
  category: AqiCategoryKey;
  dominant: Pollutant;
  sub_indices: Partial<Record<Pollutant, number>>;
}

/** Where live values come from; `attribution` must be shown, linked, next to them. */
export interface LiveSource {
  source: string;
  attribution: string;
  attribution_url: string;
  stale_after_hours: number;
}

/** GET /v1/live/cities/{id} */
export interface CityLive extends LiveSource {
  city: City;
  status: 'ok' | 'stale' | 'no_recent_readings' | 'not_in_feed';
  measure: 'model_estimate';
  observed_at: string | null;
  fetched_at: string | null;
  aqi: EstimatedAqi | null;
  readings: LiveReading[];
}

/** GET /v1/live/cities */
export interface LiveCitiesResponse extends LiveSource {
  cities: { city: City; aqi: EstimatedAqi; observed_at: string }[];
}

// The scraper stores a new hour once an hour, so refetching more often than this is wasted work.
const LIVE_STALE_TIME_MS = 5 * 60 * 1000;

export function useLiveCities(params: {
  state?: string | null;
  group?: CityGroup | null;
  order?: 'asc' | 'desc';
  limit?: number;
}) {
  return useQuery({
    queryKey: ['live', 'cities', params],
    queryFn: () => apiGet<LiveCitiesResponse>('/v1/live/cities', params),
    staleTime: LIVE_STALE_TIME_MS,
  });
}

export function useCityLive(cityId: number | null) {
  return useQuery({
    queryKey: ['live', 'city', cityId],
    queryFn: () => apiGet<CityLive>(`/v1/live/cities/${cityId}`),
    enabled: cityId !== null,
    staleTime: LIVE_STALE_TIME_MS,
    // The screen stays open while new hours arrive; check again every quarter hour.
    refetchInterval: 15 * 60 * 1000,
  });
}
