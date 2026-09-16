import { StyleSheet } from 'react-native';

import { useMeta } from '@/api/history';
import type { Dataset } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';

type Screen = 'overview' | 'hourly';

/** The dataset behind a screen's numbers. Falls back to the newest one for older cached answers. */
export function useScreenDataset(screen: Screen): Dataset | null {
  const { data } = useMeta();
  return data?.datasets ? data.datasets[screen] : (data?.dataset ?? null);
}

/**
 * Shown on a screen while its numbers come from the synthetic development dataset, so they can
 * never be mistaken for real measurements. Each screen checks its own data: the Overview can be
 * real while the Hourly screen is still on demo station data.
 */
export function DemoDataBanner({ screen }: { screen: Screen }) {
  const dataset = useScreenDataset(screen);
  if (!dataset?.synthetic) return null;

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
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
