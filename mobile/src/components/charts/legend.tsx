import { StyleSheet, View } from 'react-native';

import { CategorySwatch } from '@/components/aqi-badge';
import { ThemedText } from '@/components/themed-text';
import type { AqiCategory } from '@/constants/aqi';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface LegendItem {
  key: string;
  label: string;
  color: string;
  /** AQI categories get a level-meter swatch, so the key doesn't depend on telling colours apart. */
  category?: AqiCategory;
}

/**
 * Colour key for a chart. Hidden from screen readers because every row already speaks its
 * categories by name; the outlined swatch keeps light colours (yellow on white) visible.
 */
export function Legend({ items, title }: { items: LegendItem[]; title?: string }) {
  const theme = useTheme();
  return (
    <View aria-hidden style={styles.wrapper}>
      {title ? (
        <ThemedText type="smallBold" themeColor="textSecondary">
          {title}
        </ThemedText>
      ) : null}
      <View style={styles.legend}>
        {items.map((item) => (
          <View key={item.key} style={styles.item}>
            {item.category ? (
              <CategorySwatch category={item.category} />
            ) : (
              <View style={[styles.swatch, { backgroundColor: item.color, borderColor: theme.border }]} />
            )}
            <ThemedText type="small" themeColor="textSecondary">
              {item.label}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.one,
  },
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
