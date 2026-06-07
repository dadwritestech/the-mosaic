import * as Sim from 'pokemon-showdown';
import type { OwnedPokemon } from './types';
import { gainExp } from './owned-pokemon';
import { baseExpYield } from './exp-yield';
import { levelUpMovesBetween } from './learnset';
import { evolutionFor } from './evolution';

/** Gen-5 scaled experience for one KO. */
export function expForKO(baseExp: number, defeatedLevel: number, winnerLevel: number, participants: number): number {
  const Lo = defeatedLevel, Lp = winnerLevel, s = Math.max(1, participants);
  const ratio = Math.pow((2 * Lo + 10) / (Lo + Lp + 10), 2.5);
  return Math.floor(((baseExp * Lo) / 5) * (1 / s) * ratio + 1);
}

export interface DistributeContext {
  defeatedTeam: { species: string; level: number }[];
  participantUids: string[];
  mode: 'normal' | 'hard' | 'hardest';
}

/** EXP each party member earns. Bench: 50% on normal, 0 on hard/hardest. */
export function distributeExp(party: OwnedPokemon[], ctx: DistributeContext): Map<string, number> {
  const s = ctx.participantUids.length || 1;
  const out = new Map<string, number>();
  for (const mon of party) {
    const isPart = ctx.participantUids.includes(mon.uid);
    const factor = isPart ? 1 : ctx.mode === 'normal' ? 0.5 : 0;
    let total = 0;
    if (factor > 0) {
      for (const d of ctx.defeatedTeam) {
        total += Math.floor(expForKO(baseExpYield(d.species), d.level, mon.level, s) * factor);
      }
    }
    out.set(mon.uid, total);
  }
  return out;
}

export interface LevelUpResult {
  mon: OwnedPokemon;
  levelsGained: number;
  movesToLearn: { level: number; moveId: string }[];
  evolutionInto: string | null;
}

export function applyExpGain(mon: OwnedPokemon, amount: number): LevelUpResult {
  const beforeLevel = mon.level;
  let after = gainExp(mon, amount);
  const levelsGained = after.level - beforeLevel;

  const candidates = levelsGained > 0 ? levelUpMovesBetween(after.species, beforeLevel, after.level) : [];
  const movesToLearn: { level: number; moveId: string }[] = [];
  let moves = after.moves.slice();
  for (const cand of candidates) {
    if (moves.some((m) => m.id === cand.moveId)) continue;
    if (moves.length < 4) {
      const base = (Sim.Dex as any).forGen(9).moves.get(cand.moveId);
      moves.push({ id: cand.moveId, pp: base.pp ?? 5, ppUps: 0 }); // auto-learn
    } else {
      movesToLearn.push(cand); // queue the decision
    }
  }
  after = { ...after, moves };

  const evolutionInto = levelsGained > 0 ? evolutionFor(after, { kind: 'level' }) : null;
  return { mon: after, levelsGained, movesToLearn, evolutionInto };
}
