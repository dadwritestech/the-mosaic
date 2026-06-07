import type { PokemonSet } from '../bridge/types';
import type { OwnedPokemon } from './types';

export function ownedToSet(mon: OwnedPokemon): PokemonSet {
  return {
    name: mon.nickname || mon.species,
    species: mon.species,
    ability: mon.ability,
    item: mon.heldItem ?? '',
    moves: mon.moves.map((m) => m.id),
    nature: mon.nature,
    evs: { ...mon.evs },
    ivs: { ...mon.ivs },
    level: mon.level,
    gender: mon.gender,
  };
}
