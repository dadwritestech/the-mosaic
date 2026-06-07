import type { GameState } from './types';
import { currentDay } from './clock';

export const COOLDOWN_DAYS = 1;
export const REMATCH_LEVEL_CAP = 75;

export function recordTrainerDefeat(state: GameState, trainerId: string): GameState {
  const day = currentDay(state);
  const prev = state.trainerLog[trainerId];
  const record = {
    defeats: (prev?.defeats ?? 0) + 1,
    lastDefeatedDay: day,
    readyDay: day + COOLDOWN_DAYS,
  };
  return { ...state, trainerLog: { ...state.trainerLog, [trainerId]: record } };
}

export function isReadyForRematch(state: GameState, trainerId: string): boolean {
  const r = state.trainerLog[trainerId];
  return !!r && currentDay(state) >= r.readyDay;
}

export function listReadyRematches(state: GameState): string[] {
  return Object.keys(state.trainerLog).filter((id) => isReadyForRematch(state, id));
}

export function rematchLevelCap(state: GameState): number {
  const strongest = state.party.reduce((max, m) => Math.max(max, m.level), 0);
  return Math.min(REMATCH_LEVEL_CAP, strongest + 2 + state.badges.length * 3);
}
