import type { EncounterTable, TimeBucket } from './types';

export function rollEncounter(table: EncounterTable, bucket: TimeBucket, rng: () => number): { species: string; level: number } | null {
  const entries = table[bucket];
  if (!entries || entries.length === 0) return null;
  const total = entries.reduce((a, e) => a + e.weight, 0);
  let r = rng() * total;
  for (const e of entries) {
    r -= e.weight;
    if (r <= 0) {
      const level = e.minLevel + Math.floor(rng() * (e.maxLevel - e.minLevel + 1));
      return { species: e.species, level };
    }
  }
  const last = entries[entries.length - 1];
  return { species: last.species, level: last.minLevel };
}
