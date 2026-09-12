/** "2:00 pm" in the device's locale and time zone. */
export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** "5 Dec 2024" for an ISO date (YYYY-MM-DD) or timestamp. */
export function formatDay(iso: string): string {
  const date = iso.length === 10 ? new Date(`${iso}T00:00:00`) : new Date(iso);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * "31 Jan 2025, 23:00" from a timestamp carrying the IST offset, as the API sends them. Read from
 * the string rather than a Date so the time stays in IST whatever the device's time zone is.
 */
export function formatIstTimestamp(iso: string): string {
  return `${formatDay(iso.slice(0, 10))}, ${iso.slice(11, 16)}`;
}

/** "Dec" for the first day of a month. */
export function formatMonth(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { month: 'short' });
}

/** Rounded reading for display; null means the station didn't report it. */
export function formatReading(value: number | null): string {
  return value === null ? '–' : String(Math.round(value));
}

/** The same reading, phrased for screen readers. */
export function speakReading(value: number | null): string {
  return value === null ? 'no data' : String(Math.round(value));
}

/** A number with `digits` decimals, or "–" when missing. */
export function formatNumber(value: number | null | undefined, digits = 0): string {
  return value === null || value === undefined ? '–' : value.toFixed(digits);
}

/** 0.964 -> "96%". */
export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/** "+20" or "−7.5" (with a real minus sign, which screen readers read as "minus"). */
export function formatSigned(value: number, digits = 0): string {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return '0';
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(digits)}`;
}
