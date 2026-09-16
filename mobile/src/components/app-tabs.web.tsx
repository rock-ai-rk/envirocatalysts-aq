import {
  TabList,
  TabSlot,
  TabTrigger,
  Tabs,
  type TabListProps,
  type TabTriggerSlotProps,
} from 'expo-router/ui';
import { StyleSheet, View } from 'react-native';

import { FocusablePressable } from '@/components/focusable-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, MinTouchTarget, Radius, Spacing } from '@/constants/theme';

/** Web has no native tab bar, so render a simple accessible one above the content. */
export default function AppTabs() {
  return (
    <Tabs style={styles.tabs}>
      {/* Tabs finds its screens from the TabTriggers, so they must be direct children of TabBar. */}
      <TabList asChild>
        <TabBar>
          <TabTrigger name="index" href="/" asChild>
            <TabButton>Overview</TabButton>
          </TabTrigger>
          <TabTrigger name="hourly" href="/hourly" asChild>
            <TabButton>Hourly</TabButton>
          </TabTrigger>
        </TabBar>
      </TabList>
      <TabSlot style={styles.slot} />
    </Tabs>
  );
}

function TabBar({ children, ...props }: TabListProps) {
  return (
    <View {...props} style={styles.bar}>
      <ThemedView type="backgroundElement" style={styles.inner}>
        <ThemedText type="smallBold" style={styles.brand}>
          EnviroCatalysts
        </ThemedText>
        {children}
      </ThemedView>
    </View>
  );
}

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <FocusablePressable
      {...props}
      role="tab"
      aria-label={typeof children === 'string' ? children : undefined}
      aria-selected={isFocused}
      style={styles.tabButton}>
      <ThemedView type={isFocused ? 'backgroundSelected' : 'backgroundElement'} style={styles.tabPill}>
        <ThemedText type={isFocused ? 'smallBold' : 'small'} themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </FocusablePressable>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flex: 1,
  },
  slot: {
    flex: 1,
  },
  bar: {
    padding: Spacing.two,
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.medium,
  },
  brand: {
    marginRight: 'auto',
  },
  tabButton: {
    borderRadius: Radius.medium,
  },
  tabPill: {
    minHeight: MinTouchTarget - 4,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.medium,
  },
});
