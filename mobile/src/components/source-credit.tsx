import { Linking, StyleSheet } from 'react-native';

import { FocusablePressable } from '@/components/focusable-pressable';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/**
 * The credit Open-Meteo's licence (CC BY 4.0) asks for next to its data, with a link. The whole
 * line is the link, so the touch target is the full width rather than a few words.
 */
export function SourceCredit({ attribution, url }: { attribution: string; url: string }) {
  const theme = useTheme();
  const site = url.replace(/^https?:\/\//, '').replace(/\/$/, '');

  return (
    <FocusablePressable
      role="link"
      aria-label={`Source: ${attribution}. Opens ${site}`}
      onPress={() => Linking.openURL(url)}
      style={styles.link}>
      <ThemedText type="small" themeColor="textSecondary">
        {'Source: '}
        <ThemedText type="small" style={{ color: theme.accent, textDecorationLine: 'underline' }}>
          {attribution}
        </ThemedText>
      </ThemedText>
    </FocusablePressable>
  );
}

const styles = StyleSheet.create({
  link: {
    minHeight: 44,
    justifyContent: 'center',
  },
});
