import * as Sim from 'pokemon-showdown';
import type { OwnedMove, OwnedPokemon } from './types';

export function maxPp(move: OwnedMove): number {
  const base = (Sim.Dex as any).forGen(9).moves.get(move.id).pp ?? 5;
  return Math.floor((base * (5 + move.ppUps)) / 5);
}

export function restorePp(mon: OwnedPokemon): OwnedPokemon {
  return { ...mon, moves: mon.moves.map((m) => ({ ...m, pp: maxPp(m) })) };
}
