// Native modules with no JavaScript implementation under Jest get a mock: their libraries' own
// where there is one, and a small one here for Reanimated, whose mock loads the native worklets
// runtime. Animations are not what these tests check; that they render and behave is.
jest.mock('react-native-reanimated', () => {
  const { ScrollView, Text, View } = require('react-native');
  return {
    __esModule: true,
    default: { View, Text, ScrollView },
    useSharedValue: (initial) => ({ value: initial }),
    useAnimatedStyle: (style) => style(),
    useDerivedValue: (value) => ({ value: value() }),
    useAnimatedProps: (props) => props(),
    useAnimatedRef: () => ({ current: null }),
    useReducedMotion: () => false,
    withTiming: (to) => to,
    withSpring: (to) => to,
    withRepeat: (animation) => animation,
    withDelay: (_delay, animation) => animation,
    cancelAnimation: () => {},
    runOnJS:
      (fn) =>
      (...args) =>
        fn(...args),
    runOnUI:
      (fn) =>
      (...args) =>
        fn(...args),
    Easing: { linear: (t) => t, ease: (t) => t, inOut: (fn) => fn, out: (fn) => fn },
  };
});

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);
