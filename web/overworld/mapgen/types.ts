import type { Biome } from '../../../src/content/types';

export interface GenKnobs {
  width: number;          // map width in tiles (28–40)
  height: number;         // map height in tiles (24–36)
  orientation: 'vertical' | 'diagonal'; // seam runs top-to-bottom, or corner-to-corner
  jaggedness: number;     // 0..1 — how far the seam wanders row to row
  featureDensity: number; // 0..1 — chance a non-path ground cell gets a blocking feature
  grassDensity: number;   // 0..1 — chance a clear ground cell is an encounter-grass cell
  forcedBiome?: Biome;    // when set, BOTH sides use this biome (the sealed single-biome variant)
  entryTo?: string;       // entry warp target map id (wired in SP4c; '' for now)
  exitTo?: string;        // exit warp target map id (wired in SP4c; '' for now)
}

export const DEFAULT_KNOBS: GenKnobs = {
  width: 32,
  height: 28,
  orientation: 'vertical',
  jaggedness: 0.5,
  featureDensity: 0.12,
  grassDensity: 0.25,
};
