import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useOnline } from '@/hooks/use-online';
import { useTheme } from '@/hooks/use-theme';

/** Shown while the phone is offline; screen readers hear it when it appears. */
export function OfflineBanner() {
  const theme = useTheme();
  const online = useOnline();
  if (online) return null;

  return (
    <View aria-live="polite" style={[styles.banner, { backgroundColor: theme.noticeBackground }]}>
      <ThemedText type="smallBold" style={{ color: theme.noticeText }}>
        You’re offline. Showing what’s saved on this phone; it updates when you’re back online.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
