import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatSigned } from '@/lib/format';

interface Props {
  delta: number;
  /** e.g. "good days" or "µg/m³". */
  unit: string;
  /** Good days: more is better. Concentrations: less is better. */
  higherIsBetter: boolean;
  digits?: number;
}

/**
 * A change between periods, with an arrow AND the words "better"/"worse", so the meaning never
 * rests on red versus green.
 */
export function DeltaChip({ delta, unit, higherIsBetter, digits = 0 }: Props) {
  const theme = useTheme();
  const rounded = Number(delta.toFixed(digits));
  const verdict = rounded === 0 ? 'no change' : rounded > 0 === higherIsBetter ? 'better' : 'worse';
  const color = verdict === 'better' ? theme.better : verdict === 'worse' ? theme.worse : theme.textSecondary;
  const arrow = rounded > 0 ? '▲' : rounded < 0 ? '▼' : '•';

  return (
    <View style={styles.chip}>
      <ThemedText type="smallBold" style={{ color }}>
        {rounded === 0 ? `${arrow} No change` : `${arrow} ${formatSigned(delta, digits)} ${unit} · ${verdict}`}
      </ThemedText>
    </View>
  );
}

/** Words for screen readers: "up 20 good days, better". */
export function describeDelta(delta: number, unit: string, higherIsBetter: boolean, digits = 0): string {
  const rounded = Number(delta.toFixed(digits));
  if (rounded === 0) return 'no change';
  const direction = rounded > 0 ? 'up' : 'down';
  const verdict = rounded > 0 === higherIsBetter ? 'better' : 'worse';
  return `${direction} ${Math.abs(rounded).toFixed(digits)} ${unit}, ${verdict}`;
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
