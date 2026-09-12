import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { ExcludedCity } from '@/api/types';
import { FocusablePressable } from '@/components/focusable-pressable';
import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * One line saying how many cities were left out of the ranking, with a way to find out why.
 * Replaces the source dashboard's "Coverage Note" expander, which appeared three times.
 */
export function CoverageBanner({ excluded, periodLabel }: { excluded: ExcludedCity[]; periodLabel: string }) {
  const theme = useTheme();
  const router = useRouter();
  if (!excluded.length) return null;

  const count = excluded.length;
  const text = `${count} ${count === 1 ? 'city is' : 'cities are'} not ranked for ${periodLabel}`;

  return (
    <FocusablePressable
      role="button"
      aria-label={`${text}. Why?`}
      accessibilityHint="Explains the data coverage rules and lists the cities"
      onPress={() => router.push('/coverage')}
      style={[styles.banner, { borderColor: theme.border }]}>
      <View style={styles.text}>
        <ThemedText type="small">{text}</ThemedText>
      </View>
      <ThemedText type="smallBold" style={{ color: theme.accent }}>
        Why?
      </ThemedText>
    </FocusablePressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    minHeight: MinTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  text: {
    flex: 1,
  },
});
