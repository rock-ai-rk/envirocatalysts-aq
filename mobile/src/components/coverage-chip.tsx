import { StyleSheet } from 'react-native';

import { FocusablePressable } from '@/components/focusable-pressable';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatPercent } from '@/lib/format';

interface Props {
  /** Share of the period's days with data, 0-1. */
  coverage: number;
  minCoverage: number;
  pm25BelowFloor: boolean;
  /** e.g. "FY 24-25", when more than one period's chip sits side by side. */
  prefix?: string;
  onPress: () => void;
}

/**
 * "95% data": a city's coverage as a small pill that opens the explanation of the data rules.
 * Replaces the source dashboard's repeated "Coverage Note" expanders. A city that fails a rule
 * gets a warning sign and the word, not just a different colour.
 */
export function CoverageChip({ coverage, minCoverage, pm25BelowFloor, prefix, onPress }: Props) {
  const theme = useTheme();
  const low = coverage < minCoverage;
  const warning = low || pm25BelowFloor;
  // The warning sign sits on the part that fails, so "94% data · ⚠ PM2.5 flagged" doesn't read as
  // a coverage problem.
  const text = [
    prefix,
    `${low ? '⚠ ' : ''}${formatPercent(coverage)} data`,
    pm25BelowFloor ? '⚠ PM2.5 flagged' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const spoken =
    `${prefix ? `${prefix}: ` : ''}data on ${formatPercent(coverage)} of days, ` +
    `${low ? `below the ${formatPercent(minCoverage)} needed to be ranked` : `meets the ${formatPercent(minCoverage)} rule`}` +
    `${pm25BelowFloor ? '; PM2.5 average is implausibly low' : ''}`;

  return (
    <FocusablePressable
      role="button"
      aria-label={spoken}
      accessibilityHint="Explains the data coverage rules for this city"
      // A small pill, but a finger-sized target.
      hitSlop={10}
      onPress={onPress}
      style={[
        styles.chip,
        warning
          ? { backgroundColor: theme.noticeBackground, borderColor: theme.noticeText }
          : { backgroundColor: theme.background, borderColor: theme.border },
      ]}>
      {/* Wraps rather than truncating at large text sizes, so the warning part is never cut off. */}
      <ThemedText type="small" style={{ color: warning ? theme.noticeText : theme.text }}>
        {text}
      </ThemedText>
    </FocusablePressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.two,
  },
});
