import { describe, it, expect } from 'vitest';
import { healParty } from './center';
import { createNewGame, addToParty } from './game-state';
import { createOwned, setHp } from './owned-pokemon';
import { maxHp } from './stats';
import { maxPp } from './pp';

describe('healParty', () => {
  it('restores HP, status, and PP across the whole party', () => {
    let hurt = createOwned({ species: 'Snorlax', level: 50, moves: ['bodyslam'] });
    hurt = setHp(hurt, 5); hurt.status = 'par'; hurt.moves[0].pp = 0;
    let g = addToParty(createNewGame({ difficultyMode: 'normal', nuzlocke: false }), hurt);
    g = healParty(g);
    const m = g.party[0];
    expect(m.currentHp).toBe(maxHp(m));
    expect(m.status).toBe('');
    expect(m.moves[0].pp).toBe(maxPp(m.moves[0]));
  });
});
