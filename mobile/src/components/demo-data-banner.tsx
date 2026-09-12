import { StyleSheet } from 'react-native';

import { useMeta } from '@/api/history';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

/**
 * Shown on every screen while the API is serving the synthetic development dataset, so its
 * numbers can never be mistaken for real measurements.
 */
export function DemoDataBanner() {
  const { data } = useMeta();
  if (!data?.dataset?.synthetic) return null;

  return (
    <ThemedView type="noticeBackground" role="alert" style={styles.banner}>
      <ThemedText type="smallBold" themeColor="noticeText">
        Demo data: these numbers are generated, not real measurements.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
