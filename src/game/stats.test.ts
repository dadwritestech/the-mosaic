import { describe, it, expect } from 'vitest';
import { computeStats, hiddenPowerType, maxHp } from './stats';
import type { OwnedPokemon } from './types';
import * as calc from '@smogon/calc';

const perfectIvs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
const owned = (over: Partial<OwnedPokemon> = {}): OwnedPokemon => ({
  uid: 'x', species: 'Garchomp', level: 78, exp: 0,
  ivs: perfectIvs, evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
  nature: 'Adamant', ability: 'Rough Skin', abilitySlot: 'H', shiny: false,
  moves: [], currentHp: 1, status: '', friendship: 70, pokerus: 'none',
  caughtInfo: { ball: 'poke', location: 'test', metLevel: 1, day: 0, originalTrainer: 'P' },
  ...over,
});

describe('computeStats', () => {
  it('matches @smogon/calc final stats (the authoritative oracle)', () => {
    const mon = owned();
    const gen = calc.Generations.get(9);
    const oracle = new calc.Pokemon(gen, mon.species, {
      level: mon.level, nature: mon.nature, evs: mon.evs as any, ivs: mon.ivs as any,
    }).stats;
    expect(computeStats(mon)).toEqual({
      hp: oracle.hp, atk: oracle.atk, def: oracle.def, spa: oracle.spa, spd: oracle.spd, spe: oracle.spe,
    });
  });

  it('nature raises the plus stat and lowers the minus stat vs neutral', () => {
    const neutral = computeStats(owned({ nature: 'Hardy' }));
    const adamant = computeStats(owned({ nature: 'Adamant' })); // +Atk -SpA
    expect(adamant.atk).toBeGreaterThan(neutral.atk);
    expect(adamant.spa).toBeLessThan(neutral.spa);
  });

  it('maxHp equals computeStats().hp', () => {
    const mon = owned();
    expect(maxHp(mon)).toBe(computeStats(mon).hp);
  });

  it('hiddenPowerType returns a known type for a known IV spread', () => {
    // all-31 IVs -> Dark (the canonical max-IV Hidden Power type)
    expect(hiddenPowerType(perfectIvs)).toBe('Dark');
  });
});
