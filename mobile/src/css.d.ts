// Lets `tsc` understand the web stylesheet import in constants/theme.ts without first running
// `expo start` (which generates expo-env.d.ts).
declare module '*.css';
