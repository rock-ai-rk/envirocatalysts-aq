/** Periods and the base / comparison / change toggle used on both screens. */

import type { Period } from '../api/types';

// The assignment brief fixes these as the default comparison on both screens.
export const DEFAULT_BASE_PERIOD = 'FY2024-25';
export const DEFAULT_COMPARISON_PERIOD = 'FY2025-26';

export type PeriodView = 'base' | 'comparison' | 'change';

/** "FY 2024-25" -> "FY 24-25", so three options fit side by side on a phone. */
export function shortPeriodLabel(label: string): string {
  return label.replace(/\b\d{2}(\d{2})-(\d{2})\b/, '$1-$2');
}

export function periodViewOptions(base: Pick<Period, 'label'>, comparison: Pick<Period, 'label'>) {
  return [
    { value: 'base' as const, label: shortPeriodLabel(base.label), accessibilityLabel: base.label },
    {
      value: 'comparison' as const,
      label: shortPeriodLabel(comparison.label),
      accessibilityLabel: comparison.label,
    },
    {
      value: 'change' as const,
      label: 'Change',
      accessibilityLabel: `Change from ${base.label} to ${comparison.label}`,
    },
  ];
}

/** Labels to use before the API has answered, so the toggle doesn't jump. */
export const PLACEHOLDER_PERIODS = {
  base: { label: 'FY 2024-25' },
  comparison: { label: 'FY 2025-26' },
};
