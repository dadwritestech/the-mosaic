import { describe, it, expect } from 'vitest';
import { BattleBridge } from './battle-bridge';
import { PIKACHU_TEAM, GYARADOS_TEAM } from './test-teams';

describe('BattleBridge — trainer battle', () => {
  it('runs a scripted battle to completion with a declared winner', async () => {
    const bridge = new BattleBridge();
    await bridge.startBattle(PIKACHU_TEAM, GYARADOS_TEAM, { formatid: 'gen9customgame' });

    let guard = 0;
    while (bridge.state.winner === undefined && guard++ < 100) {
      const result = await bridge.submitTurn(
        { kind: 'move', index: 1 },
        { kind: 'move', index: 1 },
      );
      expect(Array.isArray(result.events)).toBe(true);
    }
    expect(bridge.state.winner === 'p1' || bridge.state.winner === 'p2').toBe(true);
  });

  it('reports legal move choices for the active pokemon', async () => {
    const bridge = new BattleBridge();
    await bridge.startBattle(PIKACHU_TEAM, GYARADOS_TEAM, { formatid: 'gen9customgame' });
    const choices = bridge.getChoices('p1');
    expect(choices.moves.length).toBeGreaterThan(0);
    expect(choices.moves[0]).toHaveProperty('id');
    expect(choices.canCatch).toBe(false); // trainer battle
  });
});
