/** The sentences the app builds from numbers: what the screen shows and screen readers hear. */

import type { CityPeriodStats, OverviewCity } from '@/api/types';
import { concentrationBands } from '@/constants/pollutants';
import { describeVerdict } from '@/lib/describe';
import { countActiveFilters, DEFAULT_FILTERS, describeFilters, describeMatches } from '@/state/overview-filters';

function stats(good: number, pm25: number): CityPeriodStats {
  return {
    coverage: 0.95,
    days_with_data: 347,
    aqi_days: { good, satisfactory: 100, moderate: 50, poor: 0, very_poor: 0, severe: 0 },
    pollutant_means: { 'PM2.5': pm25 },
    dominant_days: { 'PM2.5': 200 },
    pm25_below_floor: false,
  };
}

function city(id: number, name: string, before: [number, number], after: [number, number]): OverviewCity {
  const base = stats(...before);
  const comparison = stats(...after);
  return {
    rank: id,
    city: { id, name, state: 'Karnataka', latitude: null, longitude: null } as OverviewCity['city'],
    base,
    comparison,
    change: {
      aqi_days: { good: after[0] - before[0], satisfactory: 0, moderate: 0, poor: 0, very_poor: 0, severe: 0 },
      pollutant_means: { 'PM2.5': after[1] - before[1] },
      dominant_days: {},
      coverage: 0,
    },
  };
}

describe('describeVerdict', () => {
  it('counts the cities that got better or worse, with the median and the biggest drop', () => {
    const verdict = describeVerdict(
      [city(1, 'Mysuru', [300, 40], [280, 42]), city(2, 'Hassan', [250, 50], [240, 45]), city(3, 'Udupi', [200, 30], [210, 29])],
      { kind: 'good_days' },
      'FY 25-26',
    );
    expect(verdict?.sentence).toBe('2 of 3 cities had fewer good days in FY 25-26');
    expect(verdict?.detail).toBe('Median −10 good days · Biggest drop: Mysuru (−20)');
  });

  it('names a single listed city instead of saying "1 cities"', () => {
    const verdict = describeVerdict([city(1, 'Delhi', [0, 100], [0, 105])], { kind: 'good_days' }, 'FY 25-26');
    expect(verdict?.sentence).toBe('Delhi had the same number of good days in FY 25-26');
    expect(verdict?.detail).toBe('From 0 to 0 good days');
  });

  it('treats a lower pollutant average as better, and says so', () => {
    const verdict = describeVerdict(
      [city(1, 'Delhi', [0, 100], [0, 104.2])],
      { kind: 'pollutant', pollutant: 'PM2.5' },
      'FY 25-26',
    );
    expect(verdict?.sentence).toBe('Delhi had higher PM2.5 in FY 25-26');
    expect(verdict?.spokenDetail).toBe('Lower is better. From 100.0 to 104.2 micrograms per cubic metre.');
  });
});

describe('filter descriptions', () => {
  it('counts the matches the way the Show results button reads', () => {
    expect(describeMatches(218, 10)).toBe('Show top 10 of 218 cities');
    expect(describeMatches(218, 'all')).toBe('Show 218 cities');
    expect(describeMatches(7, 10)).toBe('Show 7 cities');
    expect(describeMatches(1, 10)).toBe('Show 1 city');
    expect(describeMatches(0, 10)).toBe('Show 0 cities');
  });

  it('summarises the filters and counts the ones changed from the defaults', () => {
    const filters = { ...DEFAULT_FILTERS, state: 'Delhi', direction: 'worst' as const };
    expect(describeFilters(filters)).toBe('Delhi · All groups · Top 10 by Good days, worst first');
    expect(countActiveFilters(filters)).toBe(2);
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
  });
});

describe('concentrationBands', () => {
  it("writes CPCB's PM2.5 ranges for the map legend", () => {
    expect(concentrationBands('PM2.5').map((b) => `${b.category.label} ${b.range}`)).toEqual([
      'Good 0–30',
      'Satisfactory 31–60',
      'Moderate 61–90',
      'Poor 91–120',
      'Very Poor 121–250',
      'Severe >250',
    ]);
  });

  it('keeps one decimal for CO, in mg/m³', () => {
    expect(concentrationBands('CO').map((b) => b.range)).toEqual([
      '0–1.0',
      '1.1–2.0',
      '2.1–10.0',
      '10.1–17.0',
      '17.1–34.0',
      '>34.0',
    ]);
  });
});
