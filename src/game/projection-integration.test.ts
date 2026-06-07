import { describe, it, expect } from 'vitest';
import { BattleBridge } from '../bridge/battle-bridge';
import { createOwned } from './owned-pokemon';
import { ownedToSet } from './projection';

describe('projection -> Battle Bridge', () => {
  it('a team of owned mons projects to a legal team that battles to completion', async () => {
    const p1 = [createOwned({ species: 'Pikachu', level: 50, moves: ['thunderbolt', 'quickattack', 'irontail', 'thunderwave'], nature: 'Timid' })];
    const p2 = [createOwned({ species: 'Gyarados', level: 50, moves: ['waterfall', 'crunch', 'icefang', 'dragondance'] })];

    const bridge = new BattleBridge();
    await bridge.startBattle(p1.map(ownedToSet), p2.map(ownedToSet), { formatid: 'gen9customgame' });
    let guard = 0;
    while (bridge.state.winner === undefined && guard++ < 200) {
      await bridge.submitTurn({ kind: 'move', index: 1 }, { kind: 'move', index: 1 });
    }
    expect(['p1', 'p2']).toContain(bridge.state.winner);
  });
});
