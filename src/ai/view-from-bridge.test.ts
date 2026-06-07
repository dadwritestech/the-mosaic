import { describe, it, expect } from 'vitest';
import { buildView } from './view-from-bridge';
import { PIKACHU_TEAM, GYARADOS_TEAM } from '../bridge/test-teams';

describe('buildView', () => {
  it('assembles a BattleView for the AI side from active species + teams', () => {
    const state = {
      isWild: false, turn: 1,
      active: {
        p1: { species: 'Pikachu', hpPercent: 100, status: '' },
        p2: { species: 'Gyarados', hpPercent: 100, status: '' },
      },
      winner: undefined,
    };
    const moves = [{ index: 1, id: 'waterfall', name: 'Waterfall' }];
    const view = buildView('p2', state, GYARADOS_TEAM, PIKACHU_TEAM, moves, []);
    expect(view.self.set.species).toBe('Gyarados');
    expect(view.opponent.set.species).toBe('Pikachu');
    expect(view.moves[0].id).toBe('waterfall');
  });
});
