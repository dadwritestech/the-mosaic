import { describe, it, expect } from 'vitest';
import { BattleBridge } from './battle-bridge';
import { PIKACHU_TEAM } from './test-teams';

describe('BattleBridge — catching', () => {
  it('catches a weakened, statused wild pokemon at high odds', async () => {
    let caught = 0;
    for (let i = 0; i < 20; i++) {
      const bridge = new BattleBridge();
      await bridge.startBattle(PIKACHU_TEAM, PIKACHU_TEAM, {
        formatid: 'gen9customgame', isWild: true,
      });
      // Force the wild mon to near-death + asleep for the formula.
      (bridge as any)._state.active.p2 = { species: 'Caterpie', hpPercent: 3, status: 'slp' };
      if (bridge.attemptCatch('ultra').caught) caught++;
    }
    expect(caught).toBeGreaterThan(15); // overwhelmingly succeeds
  });

  it('rarely catches a full-hp wild pokemon with a poke ball', () => {
    let caught = 0;
    for (let i = 0; i < 40; i++) {
      const bridge = new BattleBridge();
      (bridge as any)._state.isWild = true;
      (bridge as any)._state.active.p2 = { species: 'Gyarados', hpPercent: 100, status: '' };
      if (bridge.attemptCatch('poke').caught) caught++;
    }
    expect(caught).toBeLessThan(10);
  });

  it('rejects catching in a trainer battle', () => {
    const bridge = new BattleBridge();
    (bridge as any)._state.isWild = false;
    expect(() => bridge.attemptCatch('poke')).toThrow();
  });
});
