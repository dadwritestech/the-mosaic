import type { Biome } from '../content/types';

export const BIOME_GEN: Record<Biome, number> = {
  'kanto-plains': 1,
  'johto-forests': 2,
  'hoenn-beaches': 3,
  'sinnoh-tundra': 4,
  'unova-urban': 5,
  'kalos-gardens': 6,
  'alola-islands': 7,
  'galar-countryside': 8,
  'paldea-wilds': 9,
};

// Upper national-dex number of each generation, in order.
const GEN_MAX: ReadonlyArray<readonly [number, number]> = [
  [151, 1], [251, 2], [386, 3], [493, 4], [649, 5],
  [721, 6], [809, 7], [905, 8], [1025, 9],
];

/** National-dex number -> generation (1..9), or 0 if out of range. */
export function speciesGeneration(num: number): number {
  if (num < 1) return 0;
  for (const [max, gen] of GEN_MAX) if (num <= max) return gen;
  return 0;
}
