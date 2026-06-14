import type { GameState } from './types';
import { setHp } from './owned-pokemon';
import { maxHp } from './stats';
import { applyFaintConsequences } from './rules';
import { distributeExp, applyExpGain, type LevelUpResult } from './leveling';
import * as Sim from 'pokemon-showdown';
import { evolve } from './evolution';
import { computeRewards } from './rewards';
import { addMoney, addItem, registerCaught } from './game-state';
import { getItem } from './items/catalog';

export interface BattleOutcome {
  won: boolean;
  finalConditions: { uid: string; hpPercent: number; status: string }[];
  defeatedTeam: { species: string; level: number }[];
  participantUids: string[];
  isWild: boolean;
  trainer?: { basePayout: number; tier: string; dropTable?: { itemId: string; chance: number }[] };
  rng: () => number;
}

export interface BattleSummary {
  expGained: Map<string, number>;
  levelUps: { uid: string; levelsGained: number; movesToLearn: LevelUpResult['movesToLearn']; evolutionInto: string | null }[];
  money: number;
  items: string[];
}

export function applyBattleResult(state: GameState, outcome: BattleOutcome): { state: GameState; summary: BattleSummary } {
  // 1. Write back HP/status onto party mons.
  let party = state.party.map((mon) => {
    const fc = outcome.finalConditions.find((c) => c.uid === mon.uid);
    if (!fc) return mon;
    const healed = setHp({ ...mon, status: fc.status }, Math.round((fc.hpPercent / 100) * maxHp(mon)));
    return healed;
  });
  let s: GameState = { ...state, party };

  // 2. EXP + level-ups (only on a win).
  const expGained = new Map<string, number>();
  const levelUps: BattleSummary['levelUps'] = [];
  if (outcome.won) {
    const dist = distributeExp(s.party, { defeatedTeam: outcome.defeatedTeam, participantUids: outcome.participantUids, mode: s.settings.difficultyMode });
    party = s.party.map((mon) => {
      const amt = dist.get(mon.uid) ?? 0;
      expGained.set(mon.uid, amt);
      if (amt <= 0) return mon;
      let r = applyExpGain(mon, amt);
      if (r.evolutionInto) {
        r.mon = evolve(r.mon, r.evolutionInto);
        const dexNum = (Sim.Dex as any).forGen(9).species.get(r.evolutionInto)?.num;
        if (dexNum) s = registerCaught(s, dexNum);
      }
      if (r.levelsGained > 0 || r.evolutionInto) levelUps.push({ uid: mon.uid, levelsGained: r.levelsGained, movesToLearn: r.movesToLearn, evolutionInto: r.evolutionInto });
      return r.mon;
    });
    s = { ...s, party };
  }

  // 3. Nuzlocke permadeath on fainted party mons.
  s = applyFaintConsequences(s);

  // 4. Rewards (only on a win).
  let money = 0, items: string[] = [];
  if (outcome.won) {
    const rewards = computeRewards({ isWild: outcome.isWild, trainer: outcome.trainer, opponentLevels: outcome.defeatedTeam.map((d) => d.level), mode: s.settings.difficultyMode, rng: outcome.rng });
    money = rewards.money; items = rewards.items;
    s = addMoney(s, money);
    for (const itemId of items) s = addItem(s, getItem(itemId).pocket, itemId, 1);
  }

  return { state: s, summary: { expGained, levelUps, money, items } };
}
