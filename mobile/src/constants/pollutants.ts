/** Pollutant names, units and the CPCB bands used to colour concentrations. */

import type { Pollutant } from '../api/live';
import { readableTextOn } from '../lib/contrast';
import { AQI_CATEGORIES, type AqiCategory } from './aqi';
import { pollutantColors } from './palette';

export const POLLUTANT_ORDER: Pollutant[] = ['PM2.5', 'PM10', 'NO2', 'O3', 'CO', 'SO2', 'NH3'];

/** Pollutants the Overview's concentration view ranks, as in the source dashboard. */
export const CONCENTRATION_POLLUTANTS: Pollutant[] = ['PM2.5', 'PM10', 'NO2', 'O3', 'CO'];

export function unitFor(pollutant: Pollutant): string {
  return pollutant === 'CO' ? 'mg/m³' : 'µg/m³';
}

/** Unit spelled out for screen readers, which read "µg/m³" unpredictably. */
export function spokenUnitFor(pollutant: Pollutant): string {
  return pollutant === 'CO' ? 'milligrams per cubic metre' : 'micrograms per cubic metre';
}

export function pollutantColor(pollutant: Pollutant): { color: string; textColor: string } {
  const color = pollutantColors[pollutant];
  return { color, textColor: readableTextOn(color) };
}

/**
 * Upper bounds of the Good, Satisfactory, Moderate, Poor and Very Poor bands in CPCB's National
 * AQI (24-hour limits; 8-hour for O3 and CO). Anything above the last bound is Severe.
 */
const BREAKPOINTS: Record<Pollutant, [number, number, number, number, number]> = {
  'PM2.5': [30, 60, 90, 120, 250],
  PM10: [50, 100, 250, 350, 430],
  NO2: [40, 80, 180, 280, 400],
  O3: [50, 100, 168, 208, 748],
  CO: [1, 2, 10, 17, 34],
  SO2: [40, 80, 380, 800, 1600],
  NH3: [200, 400, 800, 1200, 1800],
};

/** The CPCB category a concentration falls into, for colouring bars and heatmap cells. */
export function categoryForConcentration(pollutant: Pollutant, value: number): AqiCategory {
  const index = BREAKPOINTS[pollutant].findIndex((upper) => value <= upper);
  return AQI_CATEGORIES[index === -1 ? AQI_CATEGORIES.length - 1 : index];
}
