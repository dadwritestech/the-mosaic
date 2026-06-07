import { describe, it, expect } from 'vitest';
import { BattleBridge } from './battle-bridge';
import { PIKACHU_TEAM, GYARADOS_TEAM } from './test-teams';

describe('BattleBridge HP conditions', () => {
  it('injects starting HP/status and reads final conditions', async () => {
    const bridge = new BattleBridge();
    await bridge.startBattle(PIKACHU_TEAM, GYARADOS_TEAM, {
      formatid: 'gen9customgame',
      initialConditions: { p1: [{ hpPercent: 50, status: 'par' }], p2: [{ hpPercent: 100, status: '' }] },
    });
    const fc = bridge.finalConditions();
    expect(fc.p1[0].hpPercent).toBeLessThanOrEqual(55); // injected ~50%
    expect(fc.p1[0].hpPercent).toBeGreaterThanOrEqual(45);
    expect(fc.p1[0].status).toBe('par');
    expect(fc.p2[0].hpPercent).toBe(100);
  });

  it('finalConditions reports a fainted mon after a battle ends', async () => {
    const bridge = new BattleBridge();
    await bridge.startBattle(PIKACHU_TEAM, GYARADOS_TEAM, { formatid: 'gen9customgame' });
    let guard = 0;
    while (bridge.state.winner === undefined && guard++ < 200) await bridge.submitTurn({ kind: 'move', index: 1 }, { kind: 'move', index: 1 });
    const fc = bridge.finalConditions();
    const someoneFainted = [...fc.p1, ...fc.p2].some((m) => m.fainted);
    expect(someoneFainted).toBe(true);
  });
});
