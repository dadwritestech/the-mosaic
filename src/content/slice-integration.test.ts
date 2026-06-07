import { describe, it, expect } from 'vitest';
import { getLocation, getGym } from './region';
import { rollEncounter } from './encounters';
import { makeRng } from '../ai/rng';
import { BattleBridge } from '../bridge/battle-bridge';
import { createOwned } from '../game/owned-pokemon';
import { ownedToSet } from '../game/projection';
import { composeTeam } from '../ai/team-composer';
import { createNewGame, addToParty, grantBadge } from '../game/game-state';
import { applyBattleResult } from '../game/battle-result';
import { recordTrainerDefeat } from '../game/rematch';
import * as Sim from 'pokemon-showdown';

describe('vertical slice — end to end through the whole stack', () => {
  it('wild encounter on Whispering Path runs a catchable battle', async () => {
    const path = getLocation('whispering-path');
    const enc = rollEncounter(path.encounters!, 'day', makeRng(3))!;
    expect(enc.species).toBeTruthy();

    const player = createOwned({ species: 'Pikachu', level: 12, moves: ['thunderbolt', 'quickattack'] });
    const wild = createOwned({ species: enc.species, level: enc.level, moves: ['tackle'] });
    const bridge = new BattleBridge();
    await bridge.startBattle([ownedToSet(player)], [ownedToSet(wild)], { formatid: 'gen9customgame', isWild: true });
    (bridge as any)._state.active.p2 = { species: enc.species, hpPercent: 3, status: 'slp' };
    expect(bridge.attemptCatch('ultra').caught).toBe(true);
  });

  it('Bramble gym: composed Grass team battles and a win grants the badge + progression', async () => {
    const gym = getGym('verdant-gym');
    const gymTeam = composeTeam(gym.trainer, { gen: 9, counterDraftStrength: 0.3, rng: makeRng(7) });
    // every drafted mon includes the gym type
    for (const set of gymTeam) {
      expect((Sim.Dex as any).forGen(9).species.get(set.species).types).toContain('Grass');
    }

    const player = createOwned({ species: 'Charizard', level: 14, moves: ['flamethrower', 'airslash', 'dragonpulse', 'roost'] });
    const bridge = new BattleBridge();
    await bridge.startBattle([ownedToSet(player)], gymTeam, { formatid: 'gen9customgame' });
    let guard = 0;
    while (bridge.state.winner === undefined && guard++ < 300) {
      await bridge.submitTurn({ kind: 'move', index: 1 }, { kind: 'move', index: 1 });
    }
    expect(['p1', 'p2']).toContain(bridge.state.winner);

    // Simulate a player win and run the progression chain.
    let g = addToParty(createNewGame({ difficultyMode: 'normal', nuzlocke: false }), player);
    const out = applyBattleResult(g, {
      won: true,
      finalConditions: [{ uid: player.uid, hpPercent: 60, status: '' }],
      defeatedTeam: gymTeam.map((s) => ({ species: s.species, level: s.level })),
      participantUids: [player.uid], isWild: false,
      trainer: { basePayout: gym.trainer.basePayout, tier: gym.trainer.baseTier, dropTable: gym.trainer.dropTable },
      rng: makeRng(1),
    });
    let state = grantBadge(out.state, gym.badgeId);
    state = recordTrainerDefeat(state, gym.trainer.id);

    expect(state.badges).toContain('mosaic-leaf');
    expect(state.money).toBeGreaterThan(0);
    expect(state.trainerLog[gym.trainer.id].defeats).toBe(1);
  });
});
