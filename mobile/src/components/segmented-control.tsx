import { StyleSheet, View } from 'react-native';

import { FocusablePressable } from '@/components/focusable-pressable';
import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { useLargeText } from '@/hooks/use-large-text';
import { useTheme } from '@/hooks/use-theme';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Spoken instead of `label`, e.g. "FY 2024-25" for the visible "FY 24-25". */
  accessibilityLabel?: string;
}

interface Props<T extends string> {
  /** Names the group for screen readers ("Period", "Metric"). */
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * Single choice among a few options (replaces the source app's side-by-side panels and
 * dropdowns). Exposed to screen readers as a radio group; the selected segment is filled and bold,
 * so it doesn't rely on colour alone.
 */
export function SegmentedControl<T extends string>({ label, options, value, onChange }: Props<T>) {
  const theme = useTheme();
  // At large text sizes three side-by-side segments would truncate ("FY 2…"), so they stack.
  const stacked = useLargeText();

  return (
    <View
      role="radiogroup"
      aria-label={label}
      style={[
        styles.track,
        stacked && styles.trackStacked,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <FocusablePressable
            key={option.value}
            role="radio"
            aria-checked={selected}
            aria-label={option.accessibilityLabel ?? option.label}
            onPress={() => onChange(option.value)}
            style={[styles.segment, stacked && styles.segmentStacked, selected && { backgroundColor: theme.accent }]}>
            <ThemedText
              type={selected ? 'smallBold' : 'small'}
              numberOfLines={stacked ? undefined : 1}
              style={{ color: selected ? theme.onAccent : theme.text }}>
              {option.label}
            </ThemedText>
          </FocusablePressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Capsule-shaped, like the other controls.
  track: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    padding: Spacing.half,
    gap: Spacing.half,
  },
  trackStacked: {
    flexDirection: 'column',
  },
  segment: {
    flex: 1,
    minHeight: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    borderRadius: 999,
  },
  segmentStacked: {
    flex: 0,
    paddingVertical: Spacing.one,
  },
});
