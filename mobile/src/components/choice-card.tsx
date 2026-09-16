import { StyleSheet, View } from 'react-native';

import { FocusablePressable } from '@/components/focusable-pressable';
import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { selectionTick } from '@/lib/haptics';

interface Props {
  label: string;
  /** One line under the label saying what the option means. */
  description?: string;
  selected: boolean;
  onPress: () => void;
}

/**
 * A pick-one option with room to explain itself, for choices whose names aren't self-evident
 * ("IGP"). Like ChoiceChip, the selected card is marked by a check and an outline as well as a
 * fill, and screen readers hear it as a radio button with its description.
 */
export function ChoiceCard({ label, description, selected, onPress }: Props) {
  const theme = useTheme();
  return (
    <FocusablePressable
      role="radio"
      aria-checked={selected}
      aria-label={description ? `${label}: ${description}` : label}
      onPress={() => {
        if (!selected) selectionTick();
        onPress();
      }}
      style={[
        styles.card,
        {
          backgroundColor: selected ? theme.backgroundSelected : theme.background,
          borderColor: selected ? theme.accent : theme.border,
        },
        selected && styles.selected,
      ]}>
      <View style={styles.text}>
        <ThemedText type="smallBold">{label}</ThemedText>
        {description ? (
          <ThemedText type="small" themeColor="textSecondary">
            {description}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="smallBold" aria-hidden style={{ color: theme.accent }}>
        {selected ? '✓' : ''}
      </ThemedText>
    </FocusablePressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: MinTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: 1,
  },
  // A thicker outline when selected, so the choice doesn't rest on the fill colour alone.
  selected: {
    borderWidth: 2,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
});
