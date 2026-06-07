import { describe, it, expect } from 'vitest';
import { gymSpeciesPool, baseStatTotal } from './species-pool';

describe('gymSpeciesPool', () => {
  it('returns only species whose typing INCLUDES the gym type (dual-types pass)', () => {
    const pool = gymSpeciesPool(9, 'Steel');
    expect(pool.length).toBeGreaterThan(20);
    for (const s of pool) expect(s.types.includes('Steel')).toBe(true);
    // a Steel/Flying mon qualifies; a pure Fire mon does not.
    expect(pool.some((s) => s.name === 'Skarmory')).toBe(true);
    expect(pool.some((s) => s.name === 'Charizard')).toBe(false);
  });

  it('excludes non-standard species and missingno (num<=0)', () => {
    const pool = gymSpeciesPool(9, 'Steel');
    for (const s of pool) { expect(s.isNonstandard).toBeFalsy(); expect(s.num).toBeGreaterThan(0); }
  });

  it('with no type returns a large standard pool', () => {
    expect(gymSpeciesPool(9).length).toBeGreaterThan(500);
  });

  it('baseStatTotal sums the six base stats', () => {
    expect(baseStatTotal({ hp: 1, atk: 2, def: 3, spa: 4, spd: 5, spe: 6 })).toBe(21);
  });
});
