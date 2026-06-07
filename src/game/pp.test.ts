import { describe, it, expect } from 'vitest';
import { maxPp, restorePp } from './pp';
import { createOwned } from './owned-pokemon';

describe('pp', () => {
  it('maxPp scales with PP ups: floor(base*(5+ups)/5)', () => {
    expect(maxPp({ id: 'thunderbolt', pp: 0, ppUps: 0 })).toBe(15);
    expect(maxPp({ id: 'thunderbolt', pp: 0, ppUps: 3 })).toBe(24); // floor(15*8/5)
  });
  it('restorePp refills every move to its max', () => {
    let mon = createOwned({ species: 'Pikachu', level: 20, moves: ['thunderbolt', 'quickattack'] });
    mon.moves[0].pp = 1;
    mon = restorePp(mon);
    expect(mon.moves[0].pp).toBe(maxPp(mon.moves[0]));
  });
});
