import { StyleSheet, View } from 'react-native';

import { FocusablePressable } from '@/components/focusable-pressable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Verdict } from '@/lib/describe';

interface Props {
  verdict: Verdict;
  /** Whether the list already shows the change, in which case the card doesn't offer it. */
  showingChange: boolean;
  onShowChange: () => void;
}

/**
 * The first thing on the Overview: one sentence answering "did the air get better or worse?",
 * before any bar. What's on the card is exactly what a screen reader hears. Tapping it switches
 * the list to Change, where each city's part of the answer is shown.
 */
export function VerdictCard({ verdict, showingChange, onShowChange }: Props) {
  const theme = useTheme();
  const spoken = `${verdict.sentence}. ${verdict.spokenDetail}`;
  const body = (
    <>
      <ThemedText style={styles.sentence}>{verdict.sentence}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {verdict.detail}
      </ThemedText>
    </>
  );

  // Same height in both states: the controls pinned below the header would otherwise be left
  // out of place when the card shrinks while the list is scrolled.
  if (showingChange) {
    return (
      <View
        accessible
        aria-label={spoken}
        style={[styles.card, styles.focusRingSpace, { backgroundColor: theme.backgroundElement }]}>
        {body}
        <ThemedText type="smallBold" themeColor="textSecondary">
          Each city’s change is in the list below
        </ThemedText>
      </View>
    );
  }
  return (
    <FocusablePressable
      role="button"
      aria-label={spoken}
      accessibilityHint="Shows the change for each city"
      onPress={onShowChange}
      style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      {body}
      <ThemedText type="smallBold" style={{ color: theme.accent }}>
        See each city’s change →
      </ThemedText>
    </FocusablePressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three + Spacing.one,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  // FocusablePressable always carries a 2pt transparent border for its focus ring; match it.
  focusRingSpace: {
    borderWidth: 2,
    borderColor: 'transparent',
  },
  // Larger than a section title: this is the screen's answer, not a label.
  sentence: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 700,
  },
});
