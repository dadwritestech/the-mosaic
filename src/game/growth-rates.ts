export type GrowthGroup = 'fast' | 'mediumfast' | 'mediumslow' | 'slow' | 'erratic' | 'fluctuating';

/** Total experience required to BE at `level` (level 1 = 0). Standard mainline curves. */
export function expForLevel(level: number, group: GrowthGroup): number {
  const n = level;
  if (n <= 1) return 0;
  switch (group) {
    case 'fast': return Math.floor((4 * n ** 3) / 5);
    case 'mediumfast': return n ** 3;
    case 'mediumslow': return Math.floor((6 / 5) * n ** 3 - 15 * n ** 2 + 100 * n - 140);
    case 'slow': return Math.floor((5 * n ** 3) / 4);
    case 'erratic':
      if (n < 50) return Math.floor((n ** 3 * (100 - n)) / 50);
      if (n < 68) return Math.floor((n ** 3 * (150 - n)) / 100);
      if (n < 98) return Math.floor((n ** 3 * Math.floor((1911 - 10 * n) / 3)) / 500);
      return Math.floor((n ** 3 * (160 - n)) / 100);
    case 'fluctuating':
      if (n < 15) return Math.floor((n ** 3 * (Math.floor((n + 1) / 3) + 24)) / 50);
      if (n < 36) return Math.floor((n ** 3 * (n + 14)) / 50);
      return Math.floor((n ** 3 * (Math.floor(n / 2) + 32)) / 50);
  }
}

// Seeded species->group table (the gap Showdown omits). Full National-Dex table is
// bundled later (bulk); these cover tests + early use. Default: mediumfast.
const GROUPS: Record<string, GrowthGroup> = {
  bulbasaur: 'mediumslow', charmander: 'mediumslow', squirtle: 'mediumslow',
  pikachu: 'mediumfast', gyarados: 'slow', magikarp: 'slow', garchomp: 'slow',
  caterpie: 'mediumfast', snorlax: 'slow',
  pidgey: 'mediumslow', rattata: 'mediumfast', hoothoot: 'mediumfast',
};

export function growthRateOf(species: string): GrowthGroup {
  return GROUPS[species.toLowerCase()] ?? 'mediumfast';
}
