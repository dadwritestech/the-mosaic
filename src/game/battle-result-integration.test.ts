import { describe, it, expect } from 'vitest';
import { BattleBridge } from '../bridge/battle-bridge';
import { createOwned } from './owned-pokemon';
import { ownedToSet } from './projection';
import { applyBattleResult } from './battle-result';
import { createNewGame, addToParty } from './game-state';
import { makeRng } from '../ai/rng';

describe('full battle -> result loop', () => {
  it('owned teams battle, then result writeback grants EXP to the winner', async () => {
    const mine = createOwned({ species: 'Pikachu', level: 30, moves: ['thunderbolt', 'quickattack', 'irontail', 'thunderwave'], nature: 'Timid' });
    const foe = createOwned({ species: 'Magikarp', level: 12, moves: ['splash', 'tackle'] });
    let g = addToParty(createNewGame({ difficultyMode: 'normal', nuzlocke: false }), mine);

    const bridge = new BattleBridge();
    await bridge.startBattle([ownedToSet(mine)], [ownedToSet(foe)], { formatid: 'gen9customgame' });
    let guard = 0;
    while (bridge.state.winner === undefined && guard++ < 200) await bridge.submitTurn({ kind: 'move', index: 1 }, { kind: 'move', index: 1 });

    const fc = bridge.finalConditions();
    const out = applyBattleResult(g, {
      won: bridge.state.winner === 'p1',
      finalConditions: [{ uid: mine.uid, hpPercent: fc.p1[0].hpPercent, status: fc.p1[0].status }],
      defeatedTeam: [{ species: 'Magikarp', level: 12 }],
      participantUids: [mine.uid], isWild: true, rng: makeRng(1),
    });
    // Pikachu should beat a L12 Magikarp; winner gains exp.
    expect(out.summary.expGained.get(mine.uid)!).toBeGreaterThan(0);
  });
});
