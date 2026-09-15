import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AQI_CATEGORIES, categoryForAqi } from '@/constants/aqi';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const SCALE_MAX = 500;
// Where each band starts on CPCB's 0-500 scale; the bands are 50, 50, then 100 points wide.
const BAND_STARTS = [0, 50, 100, 200, 300, 400];

/**
 * An AQI value on CPCB's whole 0-500 scale: six category bands in proportion, with a marker at
 * the value and the band edges numbered underneath. It answers "how bad is 80?" at a glance,
 * which the number alone doesn't. The same answer is its spoken label.
 */
export function AqiScale({ value }: { value: number }) {
  const theme = useTheme();
  const category = categoryForAqi(value);
  const index = AQI_CATEGORIES.indexOf(category);
  const from = index === 0 ? 0 : BAND_STARTS[index] + 1;
  const to = index === AQI_CATEGORIES.length - 1 ? SCALE_MAX : BAND_STARTS[index + 1];
  const position = Math.min(Math.max(value, 0), SCALE_MAX) / SCALE_MAX;

  return (
    <View
      accessible
      aria-label={`On CPCB's 0 to 500 scale, ${value} is in the ${category.label} band, ${from} to ${to}.`}
      style={styles.scale}>
      <View style={styles.track}>
        {AQI_CATEGORIES.map((c, i) => (
          <View
            key={c.key}
            style={[
              styles.band,
              {
                flex: (BAND_STARTS[i + 1] ?? SCALE_MAX) - BAND_STARTS[i],
                backgroundColor: c.color,
                borderColor: theme.border,
              },
              i === 0 && styles.first,
              i === AQI_CATEGORIES.length - 1 && styles.last,
            ]}
          />
        ))}
        <View
          style={[styles.marker, { left: `${position * 100}%`, backgroundColor: theme.text, borderColor: theme.background }]}
        />
      </View>
      <View style={styles.ticks}>
        {[...BAND_STARTS, SCALE_MAX].map((edge) => (
          <ThemedText
            key={edge}
            type="small"
            themeColor="textSecondary"
            // The numbers sit under fixed points on the bar, so they can't grow much.
            maxFontSizeMultiplier={1.3}
            style={[styles.tick, { left: `${(edge / SCALE_MAX) * 100}%` }]}>
            {edge}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

const MARKER = 6;

const styles = StyleSheet.create({
  scale: {
    gap: Spacing.one,
    // Room for the first and last numbers, which are centred on the bar's ends.
    paddingHorizontal: Spacing.two,
  },
  track: {
    flexDirection: 'row',
    height: 12,
    gap: Spacing.half,
  },
  band: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  first: {
    borderTopLeftRadius: 999,
    borderBottomLeftRadius: 999,
  },
  last: {
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
  },
  marker: {
    position: 'absolute',
    top: -4,
    width: MARKER,
    height: 20,
    marginLeft: -MARKER / 2,
    borderRadius: MARKER / 2,
    borderWidth: 1.5,
  },
  ticks: {
    height: 20,
  },
  tick: {
    position: 'absolute',
    width: 40,
    marginLeft: -20,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
