# Mobile app

React Native (Expo SDK 57, expo-router) client for the EnviroCatalysts air quality API.

```bash
npm install
npm start            # then press i for the iOS simulator, a for Android, or scan the QR code with Expo Go
npm run typecheck
npm run check:contrast
```

The app talks to the API on port 8000 of the machine running `npm start`, which works for
simulators and for phones on the same Wi-Fi (start the API with `--host 0.0.0.0`). Set
`EXPO_PUBLIC_API_URL` to point somewhere else.

| Path | What's in it |
|------|--------------|
| `src/app/` | Routes: the two tabs, plus modal screens |
| `src/api/` | Typed API client and React Query hooks |
| `src/components/` | Screen building blocks and charts |
| `src/constants/` | Colours (contrast-checked), AQI categories, periods |
| `src/state/` | Filter state shared between screens |
