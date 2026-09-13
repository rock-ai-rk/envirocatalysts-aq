/**
 * CPCB National AQI categories. Label colours are picked by contrast: the source dashboard used
 * black labels on every segment, which is 1.84:1 on Severe.
 */

import { readableTextOn } from '../lib/contrast';
import { aqiColors } from './palette';

export type AqiCategoryKey = keyof typeof aqiColors;

export interface AqiCategory {
  key: AqiCategoryKey;
  label: string;
  /** Upper bound of the AQI range, inclusive. */
  maxAqi: number;
  color: string;
  textColor: '#000000' | '#FFFFFF';
}

const categories: { key: AqiCategoryKey; label: string; maxAqi: number }[] = [
  { key: 'good', label: 'Good', maxAqi: 50 },
  { key: 'satisfactory', label: 'Satisfactory', maxAqi: 100 },
  { key: 'moderate', label: 'Moderate', maxAqi: 200 },
  { key: 'poor', label: 'Poor', maxAqi: 300 },
  { key: 'very_poor', label: 'Very Poor', maxAqi: 400 },
  { key: 'severe', label: 'Severe', maxAqi: Number.POSITIVE_INFINITY },
];

export const AQI_CATEGORIES: AqiCategory[] = categories.map((c) => ({
  ...c,
  color: aqiColors[c.key],
  textColor: readableTextOn(aqiColors[c.key]),
}));

export function categoryByKey(key: AqiCategoryKey): AqiCategory {
  return AQI_CATEGORIES.find((c) => c.key === key) ?? AQI_CATEGORIES[0];
}

export function categoryForAqi(aqi: number): AqiCategory {
  return AQI_CATEGORIES.find((c) => aqi <= c.maxAqi) ?? AQI_CATEGORIES[AQI_CATEGORIES.length - 1];
}
