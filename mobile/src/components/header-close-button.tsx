import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { FocusablePressable } from '@/components/focusable-pressable';
import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A visible way out of every modal. Swiping a sheet down isn't discoverable, and isn't available
 * to many screen-reader and switch-access users.
 */
export function HeaderCloseButton({ label = 'Close' }: { label?: string }) {
  const router = useRouter();
  const theme = useTheme();
  return (
    <FocusablePressable
      role="button"
      aria-label={label}
      onPress={() => router.back()}
      style={styles.button}>
      <ThemedText type="default" style={{ color: theme.accent }}>
        {label}
      </ThemedText>
    </FocusablePressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MinTouchTarget,
    minWidth: MinTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.small,
  },
});
