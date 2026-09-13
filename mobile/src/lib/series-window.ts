/**
 * The time window the Hourly trend shows: a preset length placed somewhere inside a financial
 * year. The position is stored as "days from the start of the year", so switching between
 * FY 2024-25 and FY 2025-26 keeps the same part of the year (the same week in both), which is what
 * the Change view compares.
 */

import type { Period } from '../api/types';
import { addDays, daysBetween, formatDayRange, speakDayRange } from './dates';

export type RangePreset = 'day' | 'week' | 'month' | 'year';

export const RANGE_PRESETS: { value: RangePreset; label: string; spoken: string; days: number | null }[] = [
  { value: 'day', label: '24 h', spoken: '24 hours', days: 1 },
  { value: 'week', label: '7 days', spoken: '7 days', days: 7 },
  { value: 'month', label: '30 days', spoken: '30 days', days: 30 },
  { value: 'year', label: 'Full year', spoken: 'Full financial year', days: null },
];

export interface SeriesWindow {
  /** First day shown. */
  from: string;
  /** The day after the last one shown; the API's `to` (hour-ending, so it includes that day's 00:00). */
  to: string;
  days: number;
  /** Where the window ends, in days from the start of the period (see `endOffset`). */
  endOffset: number;
  periodDays: number;
}

export function periodDays(period: Pick<Period, 'start_date' | 'end_date'>): number {
  return daysBetween(period.start_date, period.end_date) + 1;
}

/**
 * The window of `preset` length ending `endOffset` days after the period starts, kept inside the
 * period. Pass Infinity for "as late as possible".
 */
export function windowIn(
  period: Pick<Period, 'start_date' | 'end_date'>,
  preset: RangePreset,
  endOffset: number,
): SeriesWindow {
  const total = periodDays(period);
  const days = RANGE_PRESETS.find((p) => p.value === preset)?.days ?? total;
  const end = Math.min(Math.max(Math.round(endOffset), days), total);
  return {
    from: addDays(period.start_date, end - days),
    to: addDays(period.start_date, end),
    days,
    endOffset: end,
    periodDays: total,
  };
}

/** "1–7 Mar 2025" */
export function windowLabel(window: SeriesWindow): string {
  return formatDayRange(window.from, addDays(window.to, -1));
}

/** "1 to 7 March 2025" */
export function speakWindow(window: SeriesWindow): string {
  return speakDayRange(window.from, addDays(window.to, -1));
}
