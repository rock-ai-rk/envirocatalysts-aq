import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ComparisonRow {
  key: string;
  label: string;
  swatch?: string;
  base: string;
  comparison: string;
  change: ReactNode;
  /** The whole row, read as one sentence by screen readers. */
  spoken: string;
}

interface Props {
  baseLabel: string;
  comparisonLabel: string;
  rows: ComparisonRow[];
}

/** Base, comparison and change side by side: the one place both periods share a screen. */
export function ComparisonTable({ baseLabel, comparisonLabel, rows }: Props) {
  const theme = useTheme();
  return (
    <View>
      <View aria-hidden style={[styles.row, styles.headerRow, { borderColor: theme.border }]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.label} />
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.value}>
          {baseLabel}
        </ThemedText>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.value}>
          {comparisonLabel}
        </ThemedText>
      </View>
      {rows.map((row) => (
        <View key={row.key} accessible aria-label={row.spoken} style={styles.rowBlock}>
          <View style={styles.row}>
            <View style={[styles.label, styles.labelWithSwatch]}>
              {row.swatch ? (
                <View style={[styles.swatch, { backgroundColor: row.swatch, borderColor: theme.border }]} />
              ) : null}
              <ThemedText type="small">{row.label}</ThemedText>
            </View>
            <ThemedText type="smallBold" style={styles.value}>
              {row.base}
            </ThemedText>
            <ThemedText type="smallBold" style={styles.value}>
              {row.comparison}
            </ThemedText>
          </View>
          <View style={styles.change}>{row.change}</View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: Spacing.one,
    marginBottom: Spacing.one,
  },
  rowBlock: {
    paddingVertical: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  label: {
    flex: 1.4,
  },
  labelWithSwatch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
  },
  value: {
    flex: 1,
    textAlign: 'right',
  },
  change: {
    alignItems: 'flex-end',
  },
});
