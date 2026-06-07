import { describe, it, expect } from 'vitest';
import { baseExpYield } from './exp-yield';

describe('baseExpYield', () => {
  it('returns seeded values and a sane default', () => {
    expect(baseExpYield('Pikachu')).toBe(112);
    expect(baseExpYield('Charizard')).toBe(240); // authoritative PokeAPI value (the old seed's 267 was wrong)
    expect(baseExpYield('SomethingUnknown')).toBe(100); // default
  });
  it('is case-insensitive', () => {
    expect(baseExpYield('pikachu')).toBe(112);
  });
});
