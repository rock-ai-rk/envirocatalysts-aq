import type { OverviewMetric } from '@/components/overview-deck';

/**
 * The four questions the Overview can answer. `aqi_days` is the one the Overview itself shows; the
 * other three are screens of their own, reached from the cards at the foot of the Overview, so each
 * gets the whole width for its chart and its own colour key instead of sharing one layout.
 */
export interface Lens {
  key: OverviewMetric;
  /** The screen's title, and the card's. */
  title: string;
  /** The question it answers, on the card under the title. */
  question: string;
  /** Route segment. `aqi_days` has none: it is the Overview. */
  slug: 'pollutants' | 'dominant' | 'map' | null;
}

export const LENSES: Lens[] = [
  {
    key: 'aqi_days',
    title: 'AQI days',
    question: 'How many days fell in each category?',
    slug: null,
  },
  {
    key: 'pollutants',
    title: 'Pollutant levels',
    question: 'What did each pollutant average?',
    slug: 'pollutants',
  },
  {
    key: 'dominant',
    title: 'Dominant pollutant',
    question: 'Which pollutant led on the most days?',
    slug: 'dominant',
  },
  {
    key: 'map',
    title: 'Map',
    question: 'Where are these cities?',
    slug: 'map',
  },
];

/** A lens that has a screen of its own, so its slug is always a real route segment. */
export type LinkedLens = Lens & { slug: NonNullable<Lens['slug']> };

/** The three that are screens of their own, in the order the Overview lists them. */
export const LINKED_LENSES: LinkedLens[] = LENSES.filter((lens): lens is LinkedLens => lens.slug !== null);

export function lensBySlug(slug: string | undefined): Lens {
  return LENSES.find((lens) => lens.slug === slug) ?? LENSES[0];
}

export function lensByKey(key: OverviewMetric): Lens {
  return LENSES.find((lens) => lens.key === key) ?? LENSES[0];
}
