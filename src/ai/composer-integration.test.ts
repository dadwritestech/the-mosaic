import { describe, it, expect } from 'vitest';
import { BattleBridge } from '../bridge/battle-bridge';
import { composeTeam } from './team-composer';
import { makeRng } from './rng';

describe('composer -> Bridge integration', () => {
  it('a composed gym team is a legal team that battles to completion', async () => {
    const steelTeam = composeTeam(
      { baseTier: 'hard', teamSize: 3, levelCap: 50, gymType: 'Steel' },
      { gen: 9, counterDraftStrength: 0.5, rng: makeRng(21) },
    );
    const fireTeam = composeTeam(
      { baseTier: 'normal', teamSize: 3, levelCap: 50, gymType: 'Fire' },
      { gen: 9, counterDraftStrength: 0, rng: makeRng(22) },
    );

    const bridge = new BattleBridge();
    await bridge.startBattle(steelTeam, fireTeam, { formatid: 'gen9customgame', autoResolveSwitch: true });

    let guard = 0;
    while (bridge.state.winner === undefined && guard++ < 300) {
      // simple scripted play: both sides use move 1 / default switch handled by Bridge.
      await bridge.submitTurn({ kind: 'move', index: 1 }, { kind: 'move', index: 1 });
    }
    expect(['p1', 'p2']).toContain(bridge.state.winner);
  });
});
