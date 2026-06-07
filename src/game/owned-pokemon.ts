import * as Sim from 'pokemon-showdown';
import type { OwnedPokemon, Stats6 } from './types';
import { maxHp } from './stats';
import { expForLevel, growthRateOf, type GrowthGroup } from './growth-rates';

let uidCounter = 0;
function newUid(): string { return `mon_${Date.now().toString(36)}_${uidCounter++}`; }

export function levelFromExp(exp: number, group: GrowthGroup): number {
  let level = 1;
  for (let l = 2; l <= 100; l++) { if (expForLevel(l, group) <= exp) level = l; else break; }
  return level;
}

interface CreateOpts {
  species: string; level: number; nickname?: string;
  ivs?: Partial<Stats6>; evs?: Partial<Stats6>; nature?: string;
  ability?: string; abilitySlot?: OwnedPokemon['abilitySlot'];
  gender?: OwnedPokemon['gender']; shiny?: boolean;
  moves?: string[]; heldItem?: string;
}

const ZERO: Stats6 = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
const PERFECT: Stats6 = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

export function createOwned(o: CreateOpts): OwnedPokemon {
  const species = (Sim.Dex as any).forGen(9).species.get(o.species);
  const ability = o.ability ?? species.abilities['0'];
  const mon: OwnedPokemon = {
    uid: newUid(), species: species.name, nickname: o.nickname,
    level: o.level, exp: expForLevel(o.level, growthRateOf(species.name)),
    ivs: { ...PERFECT, ...o.ivs }, evs: { ...ZERO, ...o.evs }, nature: o.nature ?? 'Hardy',
    ability, abilitySlot: o.abilitySlot ?? '0', gender: o.gender, shiny: o.shiny ?? false,
    moves: (o.moves ?? []).slice(0, 4).map((id) => {
      const m = (Sim.Dex as any).forGen(9).moves.get(id);
      return { id, pp: m.pp ?? 1, ppUps: 0 };
    }),
    heldItem: o.heldItem,
    currentHp: 0, status: '', friendship: 70, pokerus: 'none',
    caughtInfo: { ball: 'poke', location: 'unknown', metLevel: o.level, day: 0, originalTrainer: 'Player' },
  };
  mon.currentHp = maxHp(mon);
  return mon;
}

export function gainExp(mon: OwnedPokemon, amount: number): OwnedPokemon {
  const group = growthRateOf(mon.species);
  const exp = Math.min(mon.exp + Math.max(0, amount), expForLevel(100, group));
  return { ...mon, exp, level: levelFromExp(exp, group) };
}

export function setHp(mon: OwnedPokemon, hp: number): OwnedPokemon {
  return { ...mon, currentHp: Math.max(0, Math.min(maxHp(mon), Math.round(hp))) };
}

export function healFull(mon: OwnedPokemon): OwnedPokemon {
  return { ...mon, currentHp: maxHp(mon), status: '', moves: mon.moves.map((m) => ({ ...m })) };
}

export function addEvs(mon: OwnedPokemon, add: Partial<Stats6>): OwnedPokemon {
  const evs = { ...mon.evs };
  for (const k of Object.keys(add) as (keyof Stats6)[]) evs[k] = Math.min(252, evs[k] + (add[k] ?? 0));
  let total = Object.values(evs).reduce((a, b) => a + b, 0);
  if (total > 510) {
    // trim overflow off the stats we just raised, deterministically by stat order.
    for (const k of Object.keys(add) as (keyof Stats6)[]) {
      if (total <= 510) break;
      const cut = Math.min(evs[k], total - 510); evs[k] -= cut; total -= cut;
    }
  }
  return { ...mon, evs };
}
