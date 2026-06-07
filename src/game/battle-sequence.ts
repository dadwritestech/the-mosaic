import type { PokemonSet, MonCondition } from '../bridge/types';
import type { OwnedPokemon } from './types';
import { maxHp } from './stats';

export interface SeqOpponent { id: string; name: string; team: PokemonSet[]; }
export interface SeqState { opponents: SeqOpponent[]; index: number; status: 'active' | 'complete' | 'failed'; itemsAllowed: boolean; }

export function startSequence(opponents: SeqOpponent[], opts: { itemsAllowed: boolean }): SeqState {
  return { opponents, index: 0, status: opponents.length ? 'active' : 'complete', itemsAllowed: opts.itemsAllowed };
}

export function currentOpponent(seq: SeqState): SeqOpponent | null {
  return seq.status === 'active' ? seq.opponents[seq.index] : null;
}

/** No-heal carry: the next battle starts the party at its current HP/status. */
export function carryConditions(party: OwnedPokemon[]): { p1: MonCondition[] } {
  return { p1: party.map((m) => ({ hpPercent: Math.round((m.currentHp / maxHp(m)) * 100), status: m.status })) };
}

export function recordBattle(seq: SeqState, won: boolean): SeqState {
  if (seq.status !== 'active') return seq;
  if (!won) return { ...seq, status: 'failed' };
  const index = seq.index + 1;
  return { ...seq, index, status: index >= seq.opponents.length ? 'complete' : 'active' };
}
