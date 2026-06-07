import { describe, it, expect } from 'vitest';
import { baseCatchRate } from '../data/catch-rates';
import { baseExpYield } from '../game/exp-yield';
import { growthRateOf } from '../game/growth-rates';

describe('slice species seeds', () => {
  it('Pidgey/Rattata/Hoothoot are seeded in all three tables', () => {
    for (const s of ['pidgey', 'rattata', 'hoothoot']) {
      expect(baseCatchRate(s)).toBe(255);
      expect(baseExpYield(s)).toBeGreaterThan(0);
    }
    expect(growthRateOf('Pidgey')).toBe('mediumslow');
    expect(growthRateOf('Rattata')).toBe('mediumfast');
  });
});
