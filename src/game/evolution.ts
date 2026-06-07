import * as Sim from 'pokemon-showdown';
import type { OwnedPokemon } from './types';
import { maxHp } from './stats';

export type EvoTrigger = { kind: 'level' } | { kind: 'item'; item: string };

const FRIENDSHIP_EVO_THRESHOLD = 220;

/** Returns the species name `mon` should evolve into under `trigger`, or null. */
export function evolutionFor(mon: OwnedPokemon, trigger: EvoTrigger): string | null {
  const dex = (Sim.Dex as any).forGen(9);
  const me = dex.species.get(mon.species);
  for (const targetName of me.evos ?? []) {
    const t = dex.species.get(targetName);
    if (trigger.kind === 'item') {
      if (t.evoType === 'useItem' && t.evoItem === trigger.item) return t.name;
    } else { // level trigger
      if (t.evoType === 'levelFriendship') {
        if (mon.friendship >= FRIENDSHIP_EVO_THRESHOLD && (!t.evoLevel || mon.level >= t.evoLevel)) return t.name;
      } else if (!t.evoType && typeof t.evoLevel === 'number') {
        if (mon.level >= t.evoLevel) return t.name;
      }
    }
  }
  return null;
}

/** Evolve into `intoSpecies`: change species, re-resolve ability slot, scale HP up. */
export function evolve(mon: OwnedPokemon, intoSpecies: string): OwnedPokemon {
  const dex = (Sim.Dex as any).forGen(9);
  const target = dex.species.get(intoSpecies);
  const oldMax = maxHp(mon);
  const ability = (target.abilities[mon.abilitySlot] as string) ?? target.abilities['0'];
  const evolved: OwnedPokemon = { ...mon, species: target.name, ability };
  const newMax = maxHp(evolved);
  evolved.currentHp = Math.min(newMax, mon.currentHp + (newMax - oldMax));
  return evolved;
}
