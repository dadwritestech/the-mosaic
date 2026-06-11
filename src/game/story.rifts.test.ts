import { describe, it, expect } from 'vitest';
import { nextBeat, convergenceEnding, type StoryBeat } from './story';
import type { GameState } from './types';

const S = (over: Partial<GameState>) =>
  ({ badges: [], flags: {}, riftStates: {}, stabilizeMeter: 0, ...over } as GameState);

const beats: StoryBeat[] = [
  { id: 'b0', requiredRifts: 0, dialogue: ['x'], choices: [] },
  { id: 'b2', requiredRifts: 2, dialogue: ['x'], choices: [] },
];

describe('rift-gated beats', () => {
  it('a requiredRifts beat fires only once enough rifts are addressed', () => {
    expect(nextBeat(S({}), beats)?.id).toBe('b0');
    const seen0 = S({ flags: { 'beat:b0': 'neutral' } });
    expect(nextBeat(seen0, beats)).toBeNull();
    const two = S({ flags: { 'beat:b0': 'neutral' }, riftStates: { a: { status: 'sealed' }, b: { status: 'attuned' } } });
    expect(nextBeat(two, beats)?.id).toBe('b2');
  });
});

describe('convergenceEnding', () => {
  it('maps the meter to reset / embrace / third', () => {
    expect(convergenceEnding(S({ stabilizeMeter: -50 }))).toBe('reset');
    expect(convergenceEnding(S({ stabilizeMeter: 50 }))).toBe('embrace');
    expect(convergenceEnding(S({ stabilizeMeter: 0 }))).toBe('third');
  });
});
