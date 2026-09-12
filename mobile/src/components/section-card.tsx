import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

interface Props {
  title: string;
  subtitle?: string;
  /** Rendered at the end of the title row, e.g. an "updated 14:00" label. */
  accessory?: ReactNode;
  children: ReactNode;
}

/** A titled block of content. The title is a header so screen-reader users can jump between cards. */
export function SectionCard({ title, subtitle, accessory, children }: Props) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.titleRow}>
        <ThemedText type="sectionTitle" role="heading" style={styles.title}>
          {title}
        </ThemedText>
        {accessory}
      </View>
      {subtitle ? (
        <ThemedText type="small" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      ) : null}
      {children}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
  },
});
