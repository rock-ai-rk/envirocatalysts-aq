/**
 * Plain-language summaries of charts. Each chart shows its summary as a caption and uses it as its
 * screen-reader label, since the bars themselves mean nothing to someone who can't see them.
 */

import type { Pollutant } from '../api/live';
import type {
  AqiCategoryKey,
  CityPeriodStats,
  HourBin,
  HourlyPeriod,
  OverviewCity,
  SeriesPoint,
  StationSeries,
} from '../api/types';
import { AQI_CATEGORIES } from '../constants/aqi';
import {
  POLLUTANT_ORDER,
  categoryForConcentration,
  spokenUnitFor,
  unitFor,
} from '../constants/pollutants';
import { speakDay } from './dates';
import { formatConcentration, formatIstClock, formatPercent, formatSigned } from './format';

export type VerdictLens = { kind: 'good_days' } | { kind: 'pollutant'; pollutant: Pollutant };

export interface Verdict {
  /** "7 of 10 cities had more good days in FY 25-26". */
  sentence: string;
  /** "Median +12 good days · Biggest drop: Delhi (−18)". */
  detail: string;
  /** The detail with units written out, for screen readers. */
  spokenDetail: string;
}

/**
 * The Overview's answer to "did the air get better or worse?", from the listed cities that have
 * data for both periods. Good days: more is better. A pollutant: a lower average is better, and
 * PM2.5 averages under the sensor-fault floor are left out, as the list leaves them out.
 */
export function describeVerdict(
  cities: OverviewCity[],
  lens: VerdictLens,
  comparisonLabel: string,
): Verdict | null {
  const digits = lens.kind === 'pollutant' && lens.pollutant === 'CO' ? 2 : lens.kind === 'pollutant' ? 1 : 0;
  const changes = cities.flatMap(({ city, base, comparison, change }) => {
    if (!change || !comparison) return [];
    if (lens.kind === 'good_days') return [{ name: city.name, delta: change.aqi_days.good }];
    const delta = change.pollutant_means[lens.pollutant];
    const hidden = lens.pollutant === 'PM2.5' && (base.pm25_below_floor || comparison.pm25_below_floor);
    return delta === undefined || hidden ? [] : [{ name: city.name, delta: Number(delta.toFixed(digits)) }];
  });
  if (!changes.length) return null;

  const n = changes.length;
  const ofN = (count: number) => `${count} of ${n} ${n === 1 ? 'city' : 'cities'}`;
  const up = changes.filter((c) => c.delta > 0).length;
  const down = changes.filter((c) => c.delta < 0).length;
  const sorted = [...changes].sort((a, b) => a.delta - b.delta);
  const middle = Math.floor(n / 2);
  const median = n % 2 ? sorted[middle].delta : (sorted[middle - 1].delta + sorted[middle].delta) / 2;

  if (lens.kind === 'good_days') {
    const sentence =
      up === 0 && down === 0
        ? `None of the ${n} cities changed their number of good days in ${comparisonLabel}`
        : up >= down
          ? `${ofN(up)} had more good days in ${comparisonLabel}`
          : `${ofN(down)} had fewer good days in ${comparisonLabel}`;
    // The city that lost the most good days, or if none lost any, the one that gained the most.
    const standout = down ? { word: 'drop', ...sorted[0] } : up ? { word: 'gain', ...sorted[n - 1] } : null;
    const parts = [`Median ${formatSigned(median)} good days`];
    if (standout) parts.push(`Biggest ${standout.word}: ${standout.name} (${formatSigned(standout.delta)})`);
    const detail = parts.join(' · ');
    return { sentence, detail, spokenDetail: `${detail.replaceAll(' · ', '. ')}.` };
  }

  const { pollutant } = lens;
  const sentence =
    up === 0 && down === 0
      ? `None of the ${n} cities changed their average ${pollutant} in ${comparisonLabel}`
      : down >= up
        ? `${ofN(down)} had lower ${pollutant} in ${comparisonLabel}`
        : `${ofN(up)} had higher ${pollutant} in ${comparisonLabel}`;
  // For a pollutant the worst change is the biggest rise.
  const standout = up ? { word: 'rise', ...sorted[n - 1] } : down ? { word: 'fall', ...sorted[0] } : null;
  const shown = (unit: string) => {
    const parts = ['Lower is better', `Median ${formatSigned(median, digits)} ${unit}`];
    if (standout) {
      parts.push(`Biggest ${standout.word}: ${standout.name} (${formatSigned(standout.delta, digits)})`);
    }
    return parts;
  };
  return {
    sentence,
    detail: shown(unitFor(pollutant)).join(' · '),
    spokenDetail: `${shown(spokenUnitFor(pollutant)).join('. ')}.`,
  };
}

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

/** "4 March 2025, hour ending 21:00" for an hour-ending IST timestamp. */
export function speakHour(iso: string): string {
  return `${speakDay(iso.slice(0, 10))}, hour ending ${formatIstClock(iso)}`;
}

/** One point of a trend, as the chart announces it while stepping through. */
export function describePoint(
  point: SeriesPoint,
  series: Pick<StationSeries, 'pollutant' | 'resolution'>,
): string {
  const { pollutant } = series;
  const when = series.resolution === 'hour' ? speakHour(point.t) : speakDay(point.t.slice(0, 10));
  if (point.value === null) return `${when}: no data`;
  const category = categoryForConcentration(pollutant, point.value).label.toLowerCase();
  const unit = spokenUnitFor(pollutant);
  const value = formatConcentration(point.value, pollutant);
  if (series.resolution === 'day' && point.min !== null && point.max !== null) {
    return (
      `${when}: daily average ${value} ${unit}, ${category}; hours ranged from ` +
      `${formatConcentration(point.min, pollutant)} to ${formatConcentration(point.max, pollutant)}`
    );
  }
  return `${when}: ${value} ${unit}, ${category}`;
}

/**
 * The trend chart's text equivalent, e.g. "PM2.5 at Anand Vihar, 1 to 7 March 2025: averaged 187
 * micrograms per cubic metre; highest 312 at 21:00 on 4 March 2025, lowest 88 at 14:00 on
 * 6 March 2025. 7 of 168 hours have no data."
 */
export function describeSeries(
  series: StationSeries,
  windowSpoken: string,
  comparison?: { series: StationSeries; label: string; ownLabel: string },
): string {
  const { stats, pollutant } = series;
  const where = `${pollutant} at ${series.station.name}, ${windowSpoken}`;
  if (stats.mean === null) return `${where}: no data.`;

  const show = (value: number | null) => formatConcentration(value, pollutant);
  const at = (iso: string | null) =>
    iso ? ` at ${formatIstClock(iso)} on ${speakDay(iso.slice(0, 10))}` : '';
  let text =
    `${where}: averaged ${show(stats.mean)} ${spokenUnitFor(pollutant)}; ` +
    `highest ${show(stats.max)}${at(stats.max_at)}, lowest ${show(stats.min)}${at(stats.min_at)}.`;

  const missing = stats.expected_hours - stats.hours_with_data;
  if (missing > 0) text += ` ${missing} of ${stats.expected_hours} hours have no data.`;

  const before = comparison?.series.stats.mean ?? null;
  if (comparison && before !== null) {
    const change = Number(show(stats.mean)) - Number(show(before));
    const verdict =
      change === 0
        ? 'no change'
        : `${show(Math.abs(change))} ${change > 0 ? 'higher' : 'lower'} in ${comparison.ownLabel}`;
    text += ` The same days in ${comparison.label} averaged ${show(before)}, so ${verdict}.`;
  }
  return text;
}

function joinWithAnd(parts: string[]): string {
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}
