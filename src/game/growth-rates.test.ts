import { describe, it, expect } from 'vitest';
import { expForLevel, growthRateOf } from './growth-rates';

describe('growth rates', () => {
  it('medium-fast curve is level^3', () => {
    expect(expForLevel(1, 'mediumfast')).toBe(0);
    expect(expForLevel(5, 'mediumfast')).toBe(125);
    expect(expForLevel(100, 'mediumfast')).toBe(1000000);
  });
  it('fast curve is 4/5 * level^3', () => {
    expect(expForLevel(100, 'fast')).toBe(800000);
  });
  it('slow curve is 5/4 * level^3', () => {
    expect(expForLevel(100, 'slow')).toBe(1250000);
  });
  it('exp is non-decreasing across levels for every group', () => {
    for (const g of ['fast', 'mediumfast', 'mediumslow', 'slow', 'erratic', 'fluctuating'] as const) {
      for (let l = 2; l <= 100; l++) expect(expForLevel(l, g)).toBeGreaterThanOrEqual(expForLevel(l - 1, g));
    }
  });
  it('maps seeded species to their group, defaulting to mediumfast', () => {
    expect(growthRateOf('Gyarados')).toBe('slow');
    expect(growthRateOf('Bulbasaur')).toBe('mediumslow');
    expect(growthRateOf('Pikachu')).toBe('mediumfast');
    expect(growthRateOf('SomethingUnknown')).toBe('mediumfast');
  });
});
