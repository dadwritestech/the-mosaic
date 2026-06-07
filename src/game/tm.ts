import * as Sim from 'pokemon-showdown';
import type { OwnedPokemon } from './types';

export interface TeachResult { ok: boolean; reason?: string; }

export function teachMove(mon: OwnedPokemon, moveId: string, replaceIndex?: number): { mon: OwnedPokemon; result: TeachResult } {
  const dex = (Sim.Dex as any).forGen(9);
  const pool: Set<string> = dex.species.getMovePool(mon.species.toLowerCase().replace(/[^a-z0-9]/g, ''));
  if (!pool.has(moveId)) return { mon, result: { ok: false, reason: 'not learnable' } };
  if (mon.moves.some((m) => m.id === moveId)) return { mon, result: { ok: false, reason: 'already known' } };

  const base = dex.moves.get(moveId);
  const newMove = { id: moveId, pp: base.pp ?? 5, ppUps: 0 };
  let moves = mon.moves.slice();
  if (moves.length < 4) moves.push(newMove);
  else if (replaceIndex !== undefined && replaceIndex >= 0 && replaceIndex < 4) moves[replaceIndex] = newMove;
  else return { mon, result: { ok: false, reason: 'moveset full; replaceIndex required' } };
  return { mon: { ...mon, moves }, result: { ok: true } };
}
