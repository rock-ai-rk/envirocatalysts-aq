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
      <ThemedText type="smallBold" style={{ color: category.textColor }}>
        {category.label}
      </ThemedText>
    </View>
  );
}

export function LevelMeter({ level, color }: { level: number; color: string }) {
  return (
    <View style={styles.meter} aria-hidden>
      {AQI_CATEGORIES.map((c, index) => (
        <View
          key={c.key}
          style={[
            styles.step,
            { height: 5 + index * 2, borderColor: color },
            index < level && { backgroundColor: color },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
    borderWidth: 1,
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
});
