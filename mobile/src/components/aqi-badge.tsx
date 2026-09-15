import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AQI_CATEGORIES, type AqiCategory } from '@/constants/aqi';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface Props {
  category: AqiCategory;
  /** Screen readers hear this instead of the label alone, e.g. when the badge sits in a sentence. */
  accessibilityLabel?: string;
}

/**
 * A CPCB category shown three ways, so it never depends on colour: the category colour, the name,
 * and a six-step meter filled up to the category's level (1 for Good ... 6 for Severe).
 * The outline keeps pale colours such as Moderate's yellow visible against a white background.
 */
export function AqiBadge({ category, accessibilityLabel }: Props) {
  const theme = useTheme();
  const level = AQI_CATEGORIES.findIndex((c) => c.key === category.key) + 1;

  return (
    <View
      accessible
      aria-label={accessibilityLabel ?? `${category.label}, level ${level} of 6`}
      style={[styles.badge, { backgroundColor: category.color, borderColor: theme.border }]}>
      <LevelMeter level={level} color={category.textColor} />
      {/* Capped at 2x so "Satisfactory" stays on one line inside a phone-width card; the name is
          also in the spoken label and next to most badges. */}
      <ThemedText
        type="smallBold"
        maxFontSizeMultiplier={2}
        style={[styles.label, { color: category.textColor }]}>
        {category.label}
      </ThemedText>
    </View>
  );
}

export function LevelMeter({
  level,
  color,
  small = false,
}: {
  level: number;
  color: string;
  small?: boolean;
}) {
  return (
    <View style={[styles.meter, small && styles.meterSmall]} aria-hidden>
      {AQI_CATEGORIES.map((c, index) => (
        <View
          key={c.key}
          style={[
            small ? styles.stepSmall : styles.step,
            { height: (small ? 3 : 5) + index * 2, borderColor: color },
            index < level && { backgroundColor: color },
          ]}
        />
      ))}
    </View>
  );
}

/**
 * The badge in swatch size, for legends and tables: the category colour with its level meter
 * inside, so neighbouring categories differ in shape as well as colour.
 */
export function CategorySwatch({ category }: { category: AqiCategory }) {
  const theme = useTheme();
  const level = AQI_CATEGORIES.findIndex((c) => c.key === category.key) + 1;
  return (
    <View
      aria-hidden
      style={[styles.swatch, { backgroundColor: category.color, borderColor: theme.border }]}>
      <LevelMeter level={level} color={category.textColor} small />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    flexShrink: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
    borderWidth: 1,
    maxWidth: '100%',
  },
  meter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  step: {
    width: 4,
    borderWidth: 1,
    borderRadius: 1,
  },
  meterSmall: {
    gap: 1,
  },
  stepSmall: {
    width: 3,
    borderWidth: 0.5,
    borderRadius: 0.5,
  },
  swatch: {
    width: 30,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
  },
});
