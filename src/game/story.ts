import type { GameState } from './types';

export interface StoryChoice { label: string; faction: 'purist' | 'synthesist' | 'neutral'; meterDelta: number; }
export interface StoryBeat { id: string; requiredBadges: number; dialogue: string[]; choices: StoryChoice[]; }
export type MeterTier = 'reset' | 'balance' | 'embrace';

export function pushMeter(state: GameState, delta: number): GameState {
  return { ...state, stabilizeMeter: Math.max(-100, Math.min(100, state.stabilizeMeter + delta)) };
}

export function meterTier(state: GameState): MeterTier {
  if (state.stabilizeMeter <= -34) return 'reset';
  if (state.stabilizeMeter >= 34) return 'embrace';
  return 'balance';
}

export function nextBeat(state: GameState, beats: StoryBeat[]): StoryBeat | null {
  return beats.find((b) => b.requiredBadges <= state.badges.length && !state.flags[`beat:${b.id}`]) ?? null;
}

export function resolveBeat(state: GameState, beats: StoryBeat[], beatId: string, choiceIndex: number): GameState {
  const beat = beats.find((b) => b.id === beatId);
  const choice = beat?.choices[choiceIndex];
  if (!beat || !choice) return state;
  const pushed = pushMeter(state, choice.meterDelta);
  return { ...pushed, flags: { ...pushed.flags, [`beat:${beatId}`]: choice.faction } };
}
