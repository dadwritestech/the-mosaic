import type { GameState } from './types';

export const MINUTES_PER_DAY = 1440;
export const MINUTES_PER_STEP = 5;

export function advanceTime(state: GameState, minutes: number): GameState {
  let total = state.time.minutes + Math.max(0, minutes);
  let day = state.time.day;
  while (total >= MINUTES_PER_DAY) { total -= MINUTES_PER_DAY; day += 1; }
  return { ...state, time: { day, minutes: total } };
}

export function advanceStep(state: GameState): GameState {
  return advanceTime(state, MINUTES_PER_STEP);
}

export function currentDay(state: GameState): number {
  return state.time.day;
}

export function timeOfDay(state: GameState): 'morning' | 'day' | 'night' {
  const m = state.time.minutes;
  if (m >= 240 && m < 600) return 'morning';
  if (m >= 600 && m < 1080) return 'day';
  return 'night';
}
