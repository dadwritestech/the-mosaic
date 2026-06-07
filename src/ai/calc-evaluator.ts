import * as calc from '@smogon/calc';
import type { ActiveView } from './types';

export interface MoveEval {
  avgDamagePercent: number;   // mean damage as % of defender max HP
  koThisTurnChance: number;   // 0..1 probability of KO this turn (0 if needs >1 turn)
}

function toCalcPokemon(gen: any, v: ActiveView): any {
  const s = v.set;
  const maxHP = new calc.Pokemon(gen, s.species, {
    level: s.level, evs: s.evs, ivs: s.ivs, nature: s.nature,
    item: s.item || undefined, ability: s.ability || undefined,
  }).maxHP();
  const curHP = Math.max(1, Math.round((v.hpPercent / 100) * maxHP));
  return new calc.Pokemon(gen, s.species, {
    level: s.level, evs: s.evs, ivs: s.ivs, nature: s.nature,
    item: s.item || undefined, ability: s.ability || undefined,
    status: (v.status || undefined) as any,
    curHP,
    boosts: v.boosts as any,
  });
}

export function evaluateMove(genNum: number, attacker: ActiveView, defender: ActiveView, moveName: string): MoveEval {
  const gen = calc.Generations.get(genNum as any);
  const atk = toCalcPokemon(gen, attacker);
  const def = toCalcPokemon(gen, defender);
  const move = new calc.Move(gen, moveName);
  const result = calc.calculate(gen, atk, def, move);

  const dmg = result.damage;
  const rolls: number[] = Array.isArray(dmg) ? (dmg as number[]) : [Number(dmg)];
  const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
  const avgDamagePercent = (avg / def.maxHP()) * 100;

  // kochance() throws when damage is 0 (e.g. Splash, status moves).
  const koThisTurnChance = avg <= 0 ? 0 : (() => {
    const ko = result.kochance();
    // chance is present only for a one-turn KO (n===1). Absent/n>1 => cannot KO now.
    return ko && ko.n === 1 && typeof ko.chance === 'number' ? ko.chance : 0;
  })();

  return { avgDamagePercent, koThisTurnChance };
}
