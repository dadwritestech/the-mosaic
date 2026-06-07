import { describe, it, expect } from 'vitest';
import { applyBattleResult } from './battle-result';
import { createNewGame, addToParty } from './game-state';
import { createOwned } from './owned-pokemon';
import { makeRng } from '../ai/rng';
import { maxHp } from './stats';

describe('applyBattleResult', () => {
  it('persists final HP/status onto party mons', () => {
    const mon = createOwned({ species: 'Pikachu', level: 20 });
    let g = addToParty(createNewGame({ difficultyMode: 'normal', nuzlocke: false }), mon);
    const out = applyBattleResult(g, {
      won: true,
      finalConditions: [{ uid: mon.uid, hpPercent: 30, status: 'brn' }],
      defeatedTeam: [{ species: 'Caterpie', level: 18 }],
      participantUids: [mon.uid],
      isWild: true,
      rng: makeRng(1),
    });
    expect(out.state.party[0].status).toBe('brn');
    expect(out.state.party[0].currentHp).toBeLessThan(maxHp(out.state.party[0]));
    expect(out.summary.expGained.get(mon.uid)!).toBeGreaterThan(0);
  });

  it('awards trainer money and respects no-reward on loss', () => {
    const mon = createOwned({ species: 'Pikachu', level: 20 });
    let g = addToParty(createNewGame({ difficultyMode: 'normal', nuzlocke: false }), mon);
    const won = applyBattleResult(g, {
      won: true, finalConditions: [{ uid: mon.uid, hpPercent: 100, status: '' }],
      defeatedTeam: [{ species: 'Caterpie', level: 18 }], participantUids: [mon.uid],
      isWild: false, trainer: { basePayout: 50, tier: 'normal' }, rng: makeRng(1),
    });
    expect(won.state.money).toBe(50 * 18); // basePayout * highest level * 1.0
    const lost = applyBattleResult(g, {
      won: false, finalConditions: [{ uid: mon.uid, hpPercent: 0, status: '' }],
      defeatedTeam: [], participantUids: [mon.uid], isWild: false,
      trainer: { basePayout: 50, tier: 'normal' }, rng: makeRng(1),
    });
    expect(lost.state.money).toBe(0); // no reward on loss
  });

  it('routes a Nuzlocke faint to the graveyard', () => {
    const mon = createOwned({ species: 'Caterpie', level: 10 });
    let g = addToParty(createNewGame({ difficultyMode: 'normal', nuzlocke: true }), mon);
    const out = applyBattleResult(g, {
      won: false, finalConditions: [{ uid: mon.uid, hpPercent: 0, status: '' }],
      defeatedTeam: [], participantUids: [mon.uid], isWild: true, rng: makeRng(1),
    });
    expect(out.state.party.length).toBe(0);
    expect(out.state.graveyard.length).toBe(1);
  });
});
