// Checks every colour pairing the app uses against WCAG 2.1 AA and exits non-zero on failure.
// Run with `npm run check:contrast` (Node 22.18+ loads the TypeScript sources directly).

import { palette, aqiColors } from '../src/constants/palette.ts';
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
  for (const bg of ['background', 'backgroundElement']) {
    add(theme, `border vs ${bg}`, c.border, c[bg], GRAPHIC);
    add(theme, `selected fill (accent) vs ${bg}`, c.accent, c[bg], GRAPHIC);
    add(theme, `focus ring (text) vs ${bg}`, c.text, c[bg], GRAPHIC);
  }
}

for (const [category, color] of Object.entries(aqiColors)) {
  add('aqi', `label on ${category}`, readableTextOn(color), color, TEXT);
}

let failures = 0;
for (const { theme, what, ratio, min } of checks) {
  const ok = ratio >= min;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${theme.padEnd(5)} ${what.padEnd(40)} ${ratio.toFixed(2)}:1 (needs ${min}:1)`);
}
console.log(`\n${checks.length - failures}/${checks.length} pairings pass WCAG 2.1 AA`);
process.exit(failures ? 1 : 0);
