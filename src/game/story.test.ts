import { describe, it, expect } from 'vitest';
import { pushMeter, meterTier, nextBeat, resolveBeat, type StoryBeat } from './story';
import { createNewGame, grantBadge } from './game-state';

const BEATS: StoryBeat[] = [
  { id: 'b0', requiredBadges: 0, dialogue: ['...'], choices: [
    { label: 'Split it', faction: 'purist', meterDelta: -20 },
    { label: 'Unite it', faction: 'synthesist', meterDelta: 20 },
    { label: 'Wait', faction: 'neutral', meterDelta: 0 }] },
  { id: 'b2', requiredBadges: 2, dialogue: ['...'], choices: [
    { label: 'Split', faction: 'purist', meterDelta: -20 },
    { label: 'Unite', faction: 'synthesist', meterDelta: 20 }] },
];

describe('story engine', () => {
  it('pushMeter clamps to [-100,100]; meterTier thresholds', () => {
    let g = createNewGame({ difficultyMode: 'normal', nuzlocke: false });
    expect(meterTier(g)).toBe('balance');
    g = pushMeter(g, -50); expect(meterTier(g)).toBe('reset');
    g = pushMeter(g, 200); expect(g.stabilizeMeter).toBe(100); expect(meterTier(g)).toBe('embrace');
  });

  it('nextBeat returns badge-gated unresolved beats in order', () => {
    let g = createNewGame({ difficultyMode: 'normal', nuzlocke: false });
    expect(nextBeat(g, BEATS)!.id).toBe('b0');
    g = resolveBeat(g, BEATS, 'b0', 0);
    expect(g.stabilizeMeter).toBe(-20);
    expect(g.flags['beat:b0']).toBe('purist');
    expect(nextBeat(g, BEATS)).toBeNull();
    g = grantBadge(grantBadge(g, 'x'), 'y');
    expect(nextBeat(g, BEATS)!.id).toBe('b2');
  });
});
