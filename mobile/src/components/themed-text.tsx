import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { FontFamily, Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'screenTitle'
    | 'sectionTitle'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'screenTitle' && styles.screenTitle,
        type === 'sectionTitle' && styles.sectionTitle,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && [styles.linkPrimary, { color: theme.accent }],
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FontFamily[500],
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FontFamily[700],
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: FontFamily[500],
  },
  title: {
    fontSize: 48,
    lineHeight: 52,
    fontFamily: FontFamily[800],
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontFamily: FontFamily[700],
    letterSpacing: -0.5,
  },
  screenTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: FontFamily[800],
    letterSpacing: -0.5,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: FontFamily[700],
    letterSpacing: -0.2,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
    fontFamily: FontFamily[600],
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    fontFamily: FontFamily[600],
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
