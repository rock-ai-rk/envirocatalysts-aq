import { useState } from 'react';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type Props = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> };

/**
 * Pressable with a visible focus ring for keyboard and switch-access users, plus a pressed state.
 * The 2px border is always there (transparent) so focusing never shifts the layout.
 */
export function FocusablePressable({ style, onFocus, onBlur, ...props }: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      {...props}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={({ pressed }) => [
        styles.base,
        style,
        focused && { borderColor: theme.text },
        pressed && styles.pressed,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pressed: {
    opacity: 0.7,
  },
});
