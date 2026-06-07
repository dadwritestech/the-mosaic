import * as Sim from 'pokemon-showdown';
import type { OwnedPokemon, Stats6 } from './types';

function baseStats(species: string): Stats6 {
  return (Sim.Dex as any).forGen(9).species.get(species).baseStats;
}

function natureMod(nature: string, stat: keyof Stats6): number {
  const n = (Sim.Dex as any).natures.get(nature);
  if (n.plus === stat) return 1.1;
  if (n.minus === stat) return 0.9;
  return 1.0;
}

/** Gen 3+ stat formula. HP has its own formula; others apply nature. */
export function computeStats(mon: OwnedPokemon): Stats6 {
  const base = baseStats(mon.species);
  const out = {} as Stats6;
  (['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as (keyof Stats6)[]).forEach((k) => {
    const common = Math.floor((2 * base[k] + mon.ivs[k] + Math.floor(mon.evs[k] / 4)) * mon.level / 100);
    if (k === 'hp') {
      out[k] = mon.species.toLowerCase() === 'shedinja' ? 1 : common + mon.level + 10;
    } else {
      out[k] = Math.floor((common + 5) * natureMod(mon.nature, k));
    }
  });
  return out;
}

export function maxHp(mon: OwnedPokemon): number { return computeStats(mon).hp; }

const HP_TYPES = [
  'Fighting', 'Flying', 'Poison', 'Ground', 'Rock', 'Bug', 'Ghost', 'Steel',
  'Fire', 'Water', 'Grass', 'Electric', 'Psychic', 'Ice', 'Dragon', 'Dark',
];

/** Gen 3-7 Hidden Power type from IVs (bit-0 of HP,Atk,Def,Spe,SpA,SpD). */
export function hiddenPowerType(ivs: Stats6): string {
  const b = (v: number) => v & 1;
  const sum = b(ivs.hp) + 2 * b(ivs.atk) + 4 * b(ivs.def) + 8 * b(ivs.spe) + 16 * b(ivs.spa) + 32 * b(ivs.spd);
  return HP_TYPES[Math.floor((sum * 15) / 63)];
}
