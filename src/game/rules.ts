import type { GameState } from './types';

export function canSaveHere(state: GameState): boolean {
  if (state.settings.difficultyMode !== 'hardest') return true;
  return state.location.atPokemonCenter;
}

/** Nuzlocke permadeath: move fainted party mons to the graveyard. No-op if off. */
export function applyFaintConsequences(state: GameState): GameState {
  if (!state.settings.nuzlocke) return state;
  const fallen = state.party.filter((m) => m.currentHp <= 0);
  if (fallen.length === 0) return state;
  return {
    ...state,
    party: state.party.filter((m) => m.currentHp > 0),
    graveyard: [...state.graveyard, ...fallen],
  };
}

const key = (areaId: string) => `encounter:${areaId}`;
export function markEncounterUsed(state: GameState, areaId: string): GameState {
  return { ...state, flags: { ...state.flags, [key(areaId)]: true } };
}
export function isEncounterUsed(state: GameState, areaId: string): boolean {
  return state.flags[key(areaId)] === true;
}
