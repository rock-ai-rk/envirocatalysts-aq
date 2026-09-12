/**
 * Plain-language summaries of charts. Each chart shows its summary as a caption and uses it as its
 * screen-reader label, since the bars themselves mean nothing to someone who can't see them.
 */

import type { Pollutant } from '../api/live';
import type { AqiCategoryKey, CityPeriodStats, HourBin, HourlyPeriod } from '../api/types';
import { AQI_CATEGORIES } from '../constants/aqi';
import { POLLUTANT_ORDER, spokenUnitFor } from '../constants/pollutants';
import { formatPercent } from './format';

/** "320 good, 30 satisfactory and 5 moderate days" (categories with zero days are skipped). */
export function describeAqiDays(aqiDays: Record<AqiCategoryKey, number>): string {
  const parts = AQI_CATEGORIES.filter((c) => aqiDays[c.key] > 0).map(
    (c) => `${aqiDays[c.key]} ${c.label.toLowerCase()}`,
  );
  return parts.length ? `${joinWithAnd(parts)} days` : 'no days with data';
}

/** "PM2.5 on 200 days, PM10 on 150 days" in pollutant order, largest first. */
export function describeDominant(dominant: CityPeriodStats['dominant_days']): string {
  const entries = POLLUTANT_ORDER.filter((p) => (dominant[p] ?? 0) > 0).sort(
    (a, b) => (dominant[b] ?? 0) - (dominant[a] ?? 0),
  );
  if (!entries.length) return 'no dominant pollutant recorded';
  return entries.map((p) => `${p} on ${dominant[p]} days`).join(', ');
}

export function describeCoverage(stats: CityPeriodStats): string {
  return `data on ${formatPercent(stats.coverage)} of days`;
}

/** Peak and low hours, e.g. for the hour-of-day chart. */
export function describeHourProfile(hours: HourBin[], pollutant: Pollutant, periodLabel: string): string {
  const withData = hours.filter((h): h is HourBin & { mean: number } => h.mean !== null);
  if (!withData.length) return `No hourly ${pollutant} data for ${periodLabel}.`;
  const high = withData.reduce((a, b) => (b.mean > a.mean ? b : a));
  const low = withData.reduce((a, b) => (b.mean < a.mean ? b : a));
  return (
    `${periodLabel}: ${pollutant} is highest at ${high.label}, averaging ${Math.round(high.mean)}, ` +
    `and lowest at ${low.label}, averaging ${Math.round(low.mean)} ${spokenUnitFor(pollutant)}.`
  );
}

/** One sentence on how often the limits were exceeded in a period. */
export function describeExceedance(period: HourlyPeriod, pollutant: Pollutant): string | null {
  const { above_naaqs_pct: naaqs, above_who_pct: who } = period.kpis;
  if (naaqs === null || who === null) return null;
  return `${pollutant} was above the Indian standard in ${naaqs}% of hours and above the WHO guideline in ${who}%.`;
}

function joinWithAnd(parts: string[]): string {
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}
