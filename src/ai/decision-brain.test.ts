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
  knobs: { randomness: 0, lookaheadDepth: 0, switchSmarts: 0 },
  personality: { aggression: 1, caution: 0 },
  rng: makeRng(7),
  ...over,
});

describe('chooseAction — move scoring', () => {
  it('picks the super-effective move over a weak one', () => {
    // Pikachu vs Gyarados: Thunderbolt (4x) should beat Quick Attack.
    const selfSet = set('Pikachu', ['thunderbolt', 'quickattack'], { evs: { spa: 252 } });
    const oppSet = set('Gyarados', ['waterfall']);
    const view: BattleView = {
      self: { set: selfSet, hpPercent: 100, status: '' },
      selfBench: [],
      opponent: { set: oppSet, hpPercent: 100, status: '' },
      moves: [
        { index: 1, id: 'thunderbolt', name: 'Thunderbolt' },
        { index: 2, id: 'quickattack', name: 'Quick Attack' },
      ],
    };
    const action = chooseAction(view, ctx());
    expect(action).toEqual({ kind: 'move', index: 1 });
  });

  it('prefers a lethal move over a stronger-looking non-lethal one', () => {
    // Against a nearly-fainted foe, the guaranteed KO move wins even if another
    // move has higher raw power but the foe would survive neither — KO bonus decides.
    const selfSet = set('Pikachu', ['thunderbolt', 'thunderwave'], { evs: { spa: 252 } });
    const oppSet = set('Snorlax', ['bodyslam'], { evs: { hp: 252 } });
    const view: BattleView = {
      self: { set: selfSet, hpPercent: 100, status: '' },
      selfBench: [],
      opponent: { set: oppSet, hpPercent: 8, status: '' },
      moves: [
        { index: 1, id: 'thunderbolt', name: 'Thunderbolt' },
        { index: 2, id: 'thunderwave', name: 'Thunder Wave' },
      ],
    };
    const action = chooseAction(view, ctx());
    expect(action).toEqual({ kind: 'move', index: 1 }); // the damaging KO, not status
  });

  it('randomness=1 still returns a legal move index', () => {
    const selfSet = set('Pikachu', ['thunderbolt', 'quickattack'], { evs: { spa: 252 } });
    const oppSet = set('Gyarados', ['waterfall']);
    const view: BattleView = {
      self: { set: selfSet, hpPercent: 100, status: '' },
      selfBench: [],
      opponent: { set: oppSet, hpPercent: 100, status: '' },
      moves: [
        { index: 1, id: 'thunderbolt', name: 'Thunderbolt' },
        { index: 2, id: 'quickattack', name: 'Quick Attack' },
      ],
    };
    const action = chooseAction(view, ctx({ knobs: { randomness: 1, lookaheadDepth: 0, switchSmarts: 0 } }));
    expect(action.kind).toBe('move');
    if (action.kind === 'move') expect([1, 2]).toContain(action.index);
  });
});
