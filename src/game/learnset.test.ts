import { describe, it, expect } from 'vitest';
import { levelUpMovesAt, levelUpMovesBetween } from './learnset';

describe('learnset', () => {
  it('finds the moves a species learns at a given level', () => {
    expect(levelUpMovesAt('Charmander', 4)).toContain('ember');
    expect(levelUpMovesAt('Charmander', 24)).toContain('flamethrower');
    expect(levelUpMovesAt('Charmander', 999)).toEqual([]);
  });
  it('collects moves across a level range (from, to]', () => {
    const moves = levelUpMovesBetween('Charmander', 3, 24);
    expect(moves.some((m) => m.moveId === 'ember' && m.level === 4)).toBe(true);
    expect(moves.some((m) => m.moveId === 'flamethrower' && m.level === 24)).toBe(true);
    // a move learned at exactly `from` is excluded:
    expect(levelUpMovesBetween('Charmander', 4, 24).some((m) => m.moveId === 'ember')).toBe(false);
  });
});
