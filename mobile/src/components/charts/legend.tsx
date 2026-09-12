import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface LegendItem {
  key: string;
  label: string;
  color: string;
}

/**
 * Colour key for a chart. Hidden from screen readers because every row already speaks its
 * categories by name; the outlined swatch keeps light colours (yellow on white) visible.
 */
export function Legend({ items }: { items: LegendItem[] }) {
  const theme = useTheme();
  return (
    <View aria-hidden style={styles.legend}>
      {items.map((item) => (
        <View key={item.key} style={styles.item}>
          <View style={[styles.swatch, { backgroundColor: item.color, borderColor: theme.border }]} />
          <ThemedText type="small" themeColor="textSecondary">
            {item.label}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.three,
    rowGap: Spacing.one,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
  },
});
