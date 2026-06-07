import * as Sim from 'pokemon-showdown';

export interface SpeciesLite {
  name: string;
  id: string;
  num: number;
  types: string[];
  baseStats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  isNonstandard: string | null;
  ability: string;
}

export function baseStatTotal(b: SpeciesLite['baseStats']): number {
  return b.hp + b.atk + b.def + b.spa + b.spd + b.spe;
}

/** Standard species whose typing includes `type` (or all standard species if omitted). */
export function gymSpeciesPool(gen: number, type?: string): SpeciesLite[] {
  const dex = (Sim.Dex as any).forGen(gen);
  const out: SpeciesLite[] = [];
  for (const s of dex.species.all() as any[]) {
    if (s.isNonstandard || s.num <= 0) continue;
    if (type && !s.types.includes(type)) continue;
    out.push({
      name: s.name, id: s.id, num: s.num, types: s.types.slice(),
      baseStats: s.baseStats, isNonstandard: s.isNonstandard,
      ability: (s.abilities && (s.abilities['0'] as string)) || 'No Ability',
    });
  }
  return out;
}
