import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { FocusablePressable } from '@/components/focusable-pressable';
import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props =
  | { kind: 'loading'; message?: string }
  | { kind: 'empty'; title: string; message?: string }
  | { kind: 'error'; message: string; onRetry: () => void };

/** Loading, empty and error states. Announced politely to screen readers when they appear. */
export function StatusMessage(props: Props) {
  const theme = useTheme();

  if (props.kind === 'loading') {
    return (
      <View style={styles.row} aria-live="polite">
        <ActivityIndicator color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary">
          {props.message ?? 'Loading…'}
        </ThemedText>
      </View>
    );
  }

  if (props.kind === 'empty') {
    return (
      <View style={styles.block} aria-live="polite">
        <ThemedText type="smallBold">{props.title}</ThemedText>
        {props.message ? (
          <ThemedText type="small" themeColor="textSecondary">
            {props.message}
          </ThemedText>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.block} aria-live="polite">
      <ThemedText type="small" style={{ color: theme.worse }}>
        {props.message}
      </ThemedText>
      <FocusablePressable
        role="button"
        aria-label="Try again"
        onPress={props.onRetry}
        style={[styles.retry, { borderColor: theme.border }]}>
        <ThemedText type="smallBold">Try again</ThemedText>
      </FocusablePressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  block: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  retry: {
    alignSelf: 'flex-start',
    minHeight: MinTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
});
