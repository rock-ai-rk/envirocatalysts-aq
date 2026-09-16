import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { StatusMessage } from '@/components/status-message';
import { Radius, Spacing } from '@/constants/theme';
import { useOnline } from '@/hooks/use-online';
import { useTheme } from '@/hooks/use-theme';

/**
 * Grey shapes where content is about to appear, so the screen keeps its layout while it loads
 * instead of jumping when a spinner is replaced. Each skeleton is one screen-reader element that
 * says what is loading. Offline, requests are paused, so it says so rather than pulse forever.
 */
export function Skeleton({
  label,
  children,
  style,
}: {
  label: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const online = useOnline();
  if (!online) return <StatusMessage kind="loading" />;
  return (
    <View accessible aria-label={label} aria-live="polite" style={[styles.group, style]}>
      {children}
    </View>
  );
}

/** One placeholder shape. It pulses gently, and holds still when the system asks for less motion. */
export function Bone({
  width = '100%',
  height = 14,
  radius = 6,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withRepeat(withTiming(0.5, { duration: 750 }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity, reduceMotion]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: theme.skeleton }, pulse]}
    />
  );
}

/** The Overview's city rows: rank, name and state, headline figure, bar and coverage pill. */
export function SkeletonCityRows({ count = 4 }: { count?: number }) {
  const theme = useTheme();
  return (
    <Skeleton label="Loading cities">
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.titleRow}>
            <Bone width={20} height={16} />
            <View style={styles.place}>
              <Bone width="55%" height={16} />
              <Bone width="35%" height={12} />
            </View>
            <Bone width={44} height={28} />
          </View>
          <Bone height={24} radius={4} />
          <Bone width={76} height={24} radius={12} />
        </View>
      ))}
    </Skeleton>
  );
}

/** A chart: its heading and the plot area, at the chart's own height. */
export function SkeletonChart({ label, height = 180 }: { label: string; height?: number }) {
  return (
    <Skeleton label={label}>
      <Bone width="45%" height={16} />
      <Bone height={height} radius={8} />
    </Skeleton>
  );
}

/** A few lines of text, for sheets and lists of names. */
export function SkeletonLines({ label, lines = 3 }: { label: string; lines?: number }) {
  // Uneven widths read as text rather than as a table.
  const widths: DimensionValue[] = ['90%', '75%', '82%', '60%', '70%', '85%'];
  return (
    <Skeleton label={label}>
      {Array.from({ length: lines }, (_, index) => (
        <Bone key={index} width={widths[index % widths.length]} height={16} />
      ))}
    </Skeleton>
  );
}

/** The live cards' city capsules. */
export function SkeletonCapsules({ label, count = 2 }: { label: string; count?: number }) {
  return (
    <Skeleton label={label} style={styles.capsules}>
      {Array.from({ length: count }, (_, index) => (
        <Bone key={index} width={150} height={84} radius={Spacing.three} />
      ))}
    </Skeleton>
  );
}

/** The live estimate: the AQI figure and badge, then the 0–500 scale. */
export function SkeletonEstimate() {
  return (
    <Skeleton label="Loading the latest estimate">
      <View style={styles.titleRow}>
        <Bone width={72} height={44} />
        <Bone width={120} height={28} radius={14} />
      </View>
      <Bone height={16} radius={8} />
      <Bone width="60%" height={14} />
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  card: {
    // The same radius as the cards it stands in for, so nothing reshapes when the data lands.
    borderRadius: Radius.large,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  place: {
    flex: 1,
    gap: Spacing.one,
  },
  capsules: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
