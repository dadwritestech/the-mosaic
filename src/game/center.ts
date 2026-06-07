import type { GameState } from './types';
import { healFull } from './owned-pokemon';
import { restorePp } from './pp';

export function healParty(state: GameState): GameState {
  return { ...state, party: state.party.map((m) => restorePp(healFull(m))) };
}
