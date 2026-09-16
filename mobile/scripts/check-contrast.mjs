// Checks every colour pairing the app uses against WCAG 2.1 AA and exits non-zero on failure.
// Run with `npm run check:contrast` (Node 22.18+ loads the TypeScript sources directly).

import { palette, aqiColors, pollutantColors } from '../src/constants/palette.ts';
import { contrastRatio, readableTextOn } from '../src/lib/contrast.ts';

const TEXT = 4.5; // WCAG 1.4.3, normal text
const GRAPHIC = 3; // WCAG 1.4.11, UI components and graphical objects

const checks = [];
const add = (theme, what, fg, bg, min) => checks.push({ theme, what, ratio: contrastRatio(fg, bg), min });

for (const [theme, c] of Object.entries(palette)) {
  const surfaces = ['background', 'backgroundElement', 'backgroundSelected'];
  for (const fg of ['text', 'textSecondary', 'accent', 'better', 'worse']) {
    for (const bg of surfaces) add(theme, `${fg} text on ${bg}`, c[fg], c[bg], TEXT);
  }
  add(theme, 'onAccent text on accent', c.onAccent, c.accent, TEXT);
  add(theme, 'noticeText on noticeBackground', c.noticeText, c.noticeBackground, TEXT);
  add(theme, 'textSecondary text on nightBand', c.textSecondary, c.nightBand, TEXT);
  for (const bg of ['background', 'backgroundElement']) {
    add(theme, `border vs ${bg}`, c.border, c[bg], GRAPHIC);
    add(theme, `selected fill (accent) vs ${bg}`, c.accent, c[bg], GRAPHIC);
    add(theme, `focus ring (text) vs ${bg}`, c.text, c[bg], GRAPHIC);
  }
}

for (const [category, color] of Object.entries(aqiColors)) {
  add('aqi', `label on ${category}`, readableTextOn(color), color, TEXT);
}

// A stacked-bar segment sits on the card, not on its neighbour: StackedBar leaves a 2pt gap
// between segments, so the card is the adjacent colour for every one of them. Three category
// colours are under 3:1 there (Moderate's yellow is 1.07:1 on white), so those segments are
// outlined and it is the outline that has to carry 1.4.11.
for (const [theme, c] of Object.entries(palette)) {
  for (const [category, color] of Object.entries(aqiColors)) {
    const fill = contrastRatio(color, c.backgroundElement);
    if (fill >= GRAPHIC) {
      add(theme, `${category} fill vs card`, color, c.backgroundElement, GRAPHIC);
    } else {
      add(theme, `${category} outline vs card (fill only ${fill.toFixed(2)}:1)`, c.border, c.backgroundElement, GRAPHIC);
    }
  }
  add(theme, 'no-data track outline vs card', c.border, c.backgroundElement, GRAPHIC);
}
for (const [pollutant, color] of Object.entries(pollutantColors)) {
  add('pol', `label on ${pollutant}`, readableTextOn(color), color, TEXT);
}

let failures = 0;
for (const { theme, what, ratio, min } of checks) {
  const ok = ratio >= min;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${theme.padEnd(5)} ${what.padEnd(40)} ${ratio.toFixed(2)}:1 (needs ${min}:1)`);
}
console.log(`\n${checks.length - failures}/${checks.length} pairings pass WCAG 2.1 AA`);
process.exit(failures ? 1 : 0);
