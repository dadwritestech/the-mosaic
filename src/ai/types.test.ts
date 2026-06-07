import { describe, it, expect } from 'vitest';
import type { Knobs, Personality, BattleView, ActiveView } from './types';

describe('ai types', () => {
  it('constructs a minimal BattleView', () => {
    const set = {
      name: 'Pikachu', species: 'Pikachu', ability: 'Static', item: '',
      moves: ['thunderbolt'], nature: 'Hardy',
      evs: { hp: 0, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 },
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50,
    };
    const av: ActiveView = { set, hpPercent: 100, status: '' };
    const view: BattleView = {
      self: av, selfBench: [], opponent: av,
      moves: [{ index: 1, id: 'thunderbolt', name: 'Thunderbolt' }],
    };
    const knobs: Knobs = { randomness: 0, lookaheadDepth: 1, switchSmarts: 1 };
    const pers: Personality = { aggression: 0.5, caution: 0.5 };
    expect(view.moves[0].id).toBe('thunderbolt');
    expect(knobs.lookaheadDepth).toBe(1);
    expect(pers.aggression).toBe(0.5);
  });
});
