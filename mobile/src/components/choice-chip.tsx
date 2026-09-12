import { StyleSheet } from 'react-native';

import { FocusablePressable } from '@/components/focusable-pressable';
import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** 'radio' for pick-one groups, 'checkbox' for pick-many. */
  kind?: 'radio' | 'checkbox';
  accessibilityHint?: string;
}

/** A tappable option chip. Selected chips are filled and show a check mark, not just a colour. */
export function ChoiceChip({ label, selected, onPress, kind = 'radio', accessibilityHint }: Props) {
  const theme = useTheme();

  return (
    <FocusablePressable
      role={kind}
      aria-checked={selected}
      aria-label={label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.accent : theme.background,
          borderColor: selected ? theme.accent : theme.border,
        },
      ]}>
      <ThemedText
        type={selected ? 'smallBold' : 'small'}
        style={{ color: selected ? theme.onAccent : theme.text }}>
        {selected ? `✓ ${label}` : label}
      </ThemedText>
    </FocusablePressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: MinTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: MinTouchTarget / 2,
  },
});
