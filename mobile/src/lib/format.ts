/** "2:00 pm" in the device's locale and time zone. */
export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Rounded reading for display; null means the station didn't report it. */
export function formatReading(value: number | null): string {
  return value === null ? '–' : String(Math.round(value));
}

/** The same reading, phrased for screen readers. */
export function speakReading(value: number | null): string {
  return value === null ? 'no data' : String(Math.round(value));
}
