import type { GameState, OwnedPokemon } from './types';
import { meterTier } from './story';

export type EndingId = 'reset' | 'embrace' | 'balance';

export function availableEndings(state: GameState): EndingId[] {
  const t = meterTier(state);
  if (t === 'reset') return ['reset', 'balance'];
  if (t === 'embrace') return ['embrace', 'balance'];
  return ['reset', 'embrace', 'balance'];
}

export function applyEnding(state: GameState, ending: EndingId): { state: GameState; narrationKey: string } {
  if (ending === 'reset') {
    const boxed: OwnedPokemon[] = state.boxes.flatMap((b) => b.slots.filter((m): m is OwnedPokemon => m !== null));
    const released = [...state.graveyard, ...state.party, ...boxed];
    const emptyBoxes = state.boxes.map((b) => ({ ...b, slots: b.slots.map(() => null) }));
    return {
      state: { ...state, party: [], boxes: emptyBoxes, graveyard: released, flags: { ...state.flags, ending: 'reset' } },
      narrationKey: 'ending.reset',
    };
  }
  return { state: { ...state, flags: { ...state.flags, ending } }, narrationKey: `ending.${ending}` };
}
