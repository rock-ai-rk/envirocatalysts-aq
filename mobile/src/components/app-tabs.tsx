import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

/** Native tab bar (UITabBar / Material bottom navigation), so screen readers get it for free. */
export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      // iOS otherwise makes the bar transparent over scrolled content, and the tab labels end up
      // drawn on top of list text, unreadable.
      disableTransparentOnScrollEdge
      indicatorColor={colors.backgroundSelected}
      // The system grey for unselected tabs is under 3:1 on white; use the theme's checked colours.
      labelStyle={{ default: { color: colors.textSecondary }, selected: { color: colors.text } }}
      iconColor={{ default: colors.textSecondary, selected: colors.accent }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Overview</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} md="bar_chart" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="hourly">
        <NativeTabs.Trigger.Label>Hourly</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'clock', selected: 'clock.fill' }} md="schedule" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
