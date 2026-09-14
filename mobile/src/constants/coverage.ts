/**
 * The share of a period's days a city needs data for to be ranked. The API sends the real rule
 * with /v1/meta, /v1/overview and /v1/coverage; this only covers the moment before it answers.
 */
export const DEFAULT_MIN_COVERAGE = 0.7;
