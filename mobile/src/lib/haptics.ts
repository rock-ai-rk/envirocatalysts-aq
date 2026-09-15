/**
 * Small haptic confirmations: a tick when a choice changes or the trend's scrub crosses into a new
 * point, and a light tap when the filters apply.
 *
 * They are never the only feedback (every change is also visible and spoken). They do nothing on
 * the web, iOS turns them off with the phone's System Haptics setting, and the tick is throttled
 * so a fast scrub doesn't buzz continuously.
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const enabled = Platform.OS !== 'web';
const MIN_GAP_MS = 35;
let lastTick = 0;

export function selectionTick(): void {
  if (!enabled) return;
  const now = Date.now();
  if (now - lastTick < MIN_GAP_MS) return;
  lastTick = now;
  Haptics.selectionAsync().catch(() => {});
}

export function lightImpact(): void {
  if (!enabled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
