/**
 * Raw colour tokens. Kept free of React Native imports so the contrast check script can load it
 * with plain Node.
 */

// "Halogen blue": icy silver-blue pages, white cards and a steel-blue accent (deep navy in the dark).
// Blue is the one hue no CPCB category uses, so buttons and selections never look like an air
// quality reading; the category colours stay the only warm, saturated things on screen.
export const palette = {
  light: {
    text: '#0F1B26',
    textSecondary: '#4B5C6D',
    background: '#E9F0F7',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#D6E4F5',
    border: '#6F8294',
    accent: '#0A5197',
    onAccent: '#FFFFFF',
    better: '#05603A',
    worse: '#B42318',
    noticeBackground: '#FEF3C7',
    noticeText: '#7A2E0E',
    // Behind the night hours of the hour-of-day chart; drawn on backgroundElement.
    nightBand: '#E3EAF2',
    // Loading placeholders. Decorative, so not held to a contrast ratio, but visible on both the
    // page and a card.
    skeleton: '#CBD8E6',
  },
  dark: {
    text: '#EAF2FA',
    textSecondary: '#A9B8C7',
    background: '#091320',
    backgroundElement: '#15273A',
    backgroundSelected: '#1E3247',
    border: '#6E8397',
    accent: '#93C9FA',
    onAccent: '#0B1622',
    better: '#5EE09A',
    worse: '#FF9B8F',
    noticeBackground: '#3A2A05',
    noticeText: '#FCD34D',
    nightBand: '#0C1826',
    skeleton: '#243B54',
  },
} as const;

export type PaletteName = keyof typeof palette;

/**
 * Colours for the dominant-pollutant chart: the Okabe-Ito palette, designed to stay
 * distinguishable with colour-vision deficiencies. It has exactly seven colours, one per pollutant.
 */
export const pollutantColors = {
  'PM2.5': '#D55E00',
  PM10: '#E69F00',
  NO2: '#0072B2',
  O3: '#009E73',
  CO: '#56B4E9',
  SO2: '#CC79A7',
  NH3: '#F0E442',
} as const;

/** CPCB AQI category colours, unchanged from the source dashboard so users recognise them. */
export const aqiColors = {
  good: '#009A47',
  satisfactory: '#92D050',
  moderate: '#FFFF00',
  poor: '#FF9900',
  very_poor: '#FF0000',
  severe: '#7B0000',
} as const;
