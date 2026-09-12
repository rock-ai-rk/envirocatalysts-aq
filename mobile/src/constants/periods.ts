/** The two periods every screen compares, fixed by the assignment brief. */

export const BASE_PERIOD = { key: 'FY2024-25', label: 'FY 2024-25', short: 'FY 24-25' } as const;
export const COMPARISON_PERIOD = { key: 'FY2025-26', label: 'FY 2025-26', short: 'FY 25-26' } as const;

export type PeriodView = 'base' | 'comparison' | 'change';

export const PERIOD_VIEW_OPTIONS: { value: PeriodView; label: string; accessibilityLabel: string }[] = [
  { value: 'base', label: BASE_PERIOD.short, accessibilityLabel: BASE_PERIOD.label },
  { value: 'comparison', label: COMPARISON_PERIOD.short, accessibilityLabel: COMPARISON_PERIOD.label },
  {
    value: 'change',
    label: 'Change',
    accessibilityLabel: `Change from ${BASE_PERIOD.label} to ${COMPARISON_PERIOD.label}`,
  },
];
