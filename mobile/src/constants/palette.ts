/**
 * Raw colour tokens. Kept free of React Native imports so the contrast check script can load it
 * with plain Node.
 */

export const palette = {
  light: {
    text: '#000000',
    textSecondary: '#60646C',
    background: '#FFFFFF',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    border: '#7C7F88',
    accent: '#1D4ED8',
    onAccent: '#FFFFFF',
    better: '#05603A',
    worse: '#B42318',
    noticeBackground: '#FEF3C7',
    noticeText: '#7A2E0E',
  },
  dark: {
    text: '#FFFFFF',
    textSecondary: '#B0B4BA',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    border: '#7C7F88',
    accent: '#8AB4FF',
    onAccent: '#000000',
    better: '#5EE09A',
    worse: '#FF9B8F',
    noticeBackground: '#3A2A05',
    noticeText: '#FCD34D',
  },
} as const;

export type PaletteName = keyof typeof palette;

/** CPCB AQI category colours, unchanged from the source dashboard so users recognise them. */
export const aqiColors = {
  good: '#00B050',
  satisfactory: '#92D050',
  moderate: '#FFFF00',
  poor: '#FF9900',
  very_poor: '#FF0000',
  severe: '#7B0000',
} as const;
