/** Response types for the historical endpoints. Mirrors backend/app/schemas/history.py. */

import type { Pollutant } from './live';

export type AqiCategoryKey = 'good' | 'satisfactory' | 'moderate' | 'poor' | 'very_poor' | 'severe';
export type CityGroup = 'NCAP' | 'MPC' | 'IGP' | 'DELHI_NCR' | 'STATE_CAPITALS';
export type RankBy = 'good_days' | 'PM2.5' | 'PM10' | 'NO2' | 'O3' | 'CO';
export type Direction = 'best' | 'worst';
export type ExclusionReason = 'no_data' | 'low_coverage' | 'pm25_floor';
export type HourlyPollutant = 'PM2.5' | 'PM10' | 'NO2' | 'SO2' | 'CO' | 'O3';

export interface Period {
  key: string;
  frequency: 'FY' | 'CY' | 'MONTH';
  label: string;
  start_date: string;
  end_date: string;
  days: number;
}

export interface Dataset {
  name: string;
  source: string;
  synthetic: boolean;
  imported_at: string;
}

export interface City {
  id: number;
  name: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  groups: CityGroup[];
}

export interface CoverageRules {
  min_coverage: number;
  pm25_floor: number;
}

export interface Meta {
  dataset: Dataset | null;
  periods: Period[];
  default_base: string | null;
  default_comparison: string | null;
  states: string[];
  groups: { code: CityGroup; label: string; description: string }[];
  rules: CoverageRules;
}

export interface CityPeriodStats {
  coverage: number;
  days_with_data: number;
  aqi_days: Record<AqiCategoryKey, number>;
  pollutant_means: Partial<Record<Pollutant, number>>;
  dominant_days: Partial<Record<Pollutant, number>>;
  pm25_below_floor: boolean;
}

export interface CityChange {
  aqi_days: Record<AqiCategoryKey, number>;
  pollutant_means: Partial<Record<Pollutant, number>>;
  dominant_days: Partial<Record<Pollutant, number>>;
  coverage: number;
}

export interface OverviewCity {
  rank: number;
  city: City;
  base: CityPeriodStats;
  comparison: CityPeriodStats | null;
  change: CityChange | null;
}

export interface ExcludedCity {
  city: City;
  reason: ExclusionReason;
  coverage: number | null;
}

export interface Overview {
  base: Period;
  comparison: Period;
  rank_by: RankBy;
  direction: Direction;
  top: number | null;
  cities_in_scope: number;
  eligible: number;
  cities: OverviewCity[];
  excluded: ExcludedCity[];
  rules: CoverageRules;
}

export interface CityDetail {
  city: City;
  base: Period;
  comparison: Period;
  base_stats: CityPeriodStats | null;
  comparison_stats: CityPeriodStats | null;
  change: CityChange | null;
  has_hourly_data: boolean;
}

export interface Station {
  id: number;
  name: string;
  code: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface HourlyCity {
  city: City;
  stations: Station[];
}

export interface Kpis {
  hours_with_data: number;
  expected_hours: number;
  coverage: number;
  mean: number | null;
  peak: number | null;
  peak_at: string | null;
  above_naaqs_pct: number | null;
  above_who_pct: number | null;
}

export interface HourBin {
  hour: number;
  label: string;
  mean: number | null;
  samples: number;
}

export interface DayMean {
  day: string;
  mean: number;
  hours: number;
  valid: boolean;
}

export interface MonthStats {
  month: string;
  samples: number;
  mean: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  max: number;
}

export interface HourlyPeriod {
  period: Period;
  kpis: Kpis;
  hours: HourBin[];
  days: DayMean[];
  months: MonthStats[];
  peak_day: string | null;
}

export interface HourlySummary {
  city: City;
  station: Station | null;
  pollutant: HourlyPollutant;
  unit: string;
  thresholds: { naaqs: number; who: number } | null;
  base: HourlyPeriod;
  comparison: HourlyPeriod;
}

export interface HeatmapRow {
  station: Station;
  mean: number;
  hours: (number | null)[];
}

export interface Heatmap {
  city: City;
  pollutant: HourlyPollutant;
  unit: string;
  period: Period;
  hour_labels: string[];
  stations_total: number;
  rows: HeatmapRow[];
}

export interface DayHeatmap {
  city: City;
  pollutant: HourlyPollutant;
  unit: string;
  day: string;
  hour_labels: string[];
  rows: HeatmapRow[];
}
