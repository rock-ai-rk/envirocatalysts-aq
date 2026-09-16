import { LensScreen } from '@/components/lens-screen';

/**
 * The Overview: the AQI-days lens, opening with the verdict and the live estimates, and listing
 * the other three lenses at the foot. They are screens of their own under `/lens`.
 */
export default function OverviewScreen() {
  return <LensScreen lens="aqi_days" />;
}
