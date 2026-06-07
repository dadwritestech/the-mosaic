import { describe, it, expect } from 'vitest';
import { BattleBridge } from '../bridge/battle-bridge';
import { PIKACHU_TEAM, GYARADOS_TEAM } from '../bridge/test-teams';
import { chooseAction } from './decision-brain';
import { buildView } from './view-from-bridge';
import { makeRng } from './rng';
import type { BrainContext } from './types';
import type { Action } from '../bridge/types';

function brainCtx(seed: number, hard: boolean): BrainContext {
  return {
    gen: 9,
    knobs: hard
      ? { randomness: 0.0, lookaheadDepth: 1, switchSmarts: 1 }
      : { randomness: 0.85, lookaheadDepth: 0, switchSmarts: 0 },
    personality: { aggression: 1, caution: hard ? 1 : 0 },
    rng: makeRng(seed),
  };
}

// Runs one battle: p1 driven by `p1Ctx`, p2 by `p2Ctx`. Returns the winner.
async function playBattle(p1Ctx: BrainContext, p2Ctx: BrainContext): Promise<string> {
  const bridge = new BattleBridge();
  await bridge.startBattle(PIKACHU_TEAM, GYARADOS_TEAM, { formatid: 'gen9customgame' });
  let guard = 0;
  while (bridge.state.winner === undefined && guard++ < 200) {
    const c1 = bridge.getChoices('p1');
    const c2 = bridge.getChoices('p2');
    const v1 = buildView('p1', bridge.state, PIKACHU_TEAM, GYARADOS_TEAM, c1.moves, []);
    const v2 = buildView('p2', bridge.state, GYARADOS_TEAM, PIKACHU_TEAM, c2.moves, []);
    const a1: Action = chooseAction(v1, p1Ctx);
    const a2: Action = chooseAction(v2, p2Ctx);
    await bridge.submitTurn(a1, a2);
  }
  return bridge.state.winner ?? 'none';
}

describe('decision brain — integration through the Battle Bridge', () => {
  it('drives a battle to completion', async () => {
    const winner = await playBattle(brainCtx(1, true), brainCtx(2, true));
    expect(['p1', 'p2']).toContain(winner);
  });

  it('Hard beats Easy clearly more than half the time', async () => {
    let hardWins = 0;
    const N = 12;
    for (let i = 0; i < N; i++) {
      const winner = await playBattle(brainCtx(100 + i, true), brainCtx(500 + i, false));
      if (winner === 'p1') hardWins++;
    }
    expect(hardWins).toBeGreaterThan(N / 2);
  });
});
