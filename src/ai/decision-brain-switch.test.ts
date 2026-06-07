import { describe, it, expect } from 'vitest';
import { chooseAction } from './decision-brain';
import type { BattleView, BrainContext } from './types';
import { makeRng } from './rng';

const set = (species: string, moves: string[], extra: Partial<any> = {}) => ({
  name: species, species, ability: extra.ability ?? '', item: extra.item ?? '',
  moves, nature: 'Hardy',
  evs: extra.evs ?? { hp: 0, atk: 252, def: 0, spa: 252, spd: 0, spe: 0 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50,
});

const ctx = (over: Partial<BrainContext> = {}): BrainContext => ({
  gen: 9,
  knobs: { randomness: 0, lookaheadDepth: 1, switchSmarts: 1 },
  personality: { aggression: 1, caution: 1 },
  rng: makeRng(3),
  ...over,
});

describe('chooseAction — switching + lookahead', () => {
  it('switches away when the active mon faces a hopeless matchup and a great answer is benched', () => {
    // Active Magikarp (only Splash) vs Pikachu; benched Sandshrew (Ground, immune to Electric, strong).
    const view: BattleView = {
      self: { set: set('Magikarp', ['splash']), hpPercent: 100, status: '' },
      selfBench: [{ set: set('Sandshrew', ['earthquake'], { evs: { atk: 252 } }), hpPercent: 100, status: '' }],
      opponent: { set: set('Pikachu', ['thunderbolt'], { evs: { spa: 252 } }), hpPercent: 100, status: '' },
      moves: [{ index: 1, id: 'splash', name: 'Splash' }],
      switchIndices: [2],
    };
    const action = chooseAction(view, ctx());
    expect(action).toEqual({ kind: 'switch', index: 2 });
  });

  it('does NOT switch when switchSmarts=0 even in a bad matchup', () => {
    const view: BattleView = {
      self: { set: set('Magikarp', ['splash']), hpPercent: 100, status: '' },
      selfBench: [{ set: set('Sandshrew', ['earthquake'], { evs: { atk: 252 } }), hpPercent: 100, status: '' }],
      opponent: { set: set('Pikachu', ['thunderbolt'], { evs: { spa: 252 } }), hpPercent: 100, status: '' },
      moves: [{ index: 1, id: 'splash', name: 'Splash' }],
      switchIndices: [2],
    };
    const action = chooseAction(view, ctx({ knobs: { randomness: 0, lookaheadDepth: 1, switchSmarts: 0 } }));
    expect(action).toEqual({ kind: 'move', index: 1 });
  });
});
