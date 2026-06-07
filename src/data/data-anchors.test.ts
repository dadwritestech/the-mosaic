import { describe, it, expect } from 'vitest';
import { baseCatchRate, CATCH_RATES } from './catch-rates';
import { baseExpYield } from '../game/exp-yield';
import { growthRateOf } from '../game/growth-rates';
import { evYield } from './ev-yield';

describe('data anchors (sourced from PokeAPI)', () => {
  it('matches known catch rates', () => {
    expect(baseCatchRate('Pikachu')).toBe(190);
    expect(baseCatchRate('Caterpie')).toBe(255);
    expect(baseCatchRate('Dratini')).toBe(45);
  });
  it('matches known base exp', () => {
    expect(baseExpYield('Magikarp')).toBe(40);
    expect(baseExpYield('Pikachu')).toBe(112);
  });
  it('matches known growth groups', () => {
    expect(growthRateOf('Charizard')).toBe('mediumslow');
    expect(growthRateOf('Pikachu')).toBe('mediumfast');
    expect(growthRateOf('Gyarados')).toBe('slow');
  });
  it('matches known EV yields', () => {
    expect(evYield('Pikachu')).toEqual({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 2 });
    expect(evYield('Gyarados').atk).toBe(2);
  });
  it('covers the full dex (>1000 species)', () => {
    expect(Object.keys(CATCH_RATES).length).toBeGreaterThan(1000);
  });
});
