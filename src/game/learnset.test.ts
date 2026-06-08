import { describe, it, expect } from 'vitest';
import { levelUpMovesAt, levelUpMovesBetween, wildMoveset } from './learnset';

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

describe('wildMoveset', () => {
  it('gives up to 4 of the most recent level-up moves at that level', () => {
    const moves = wildMoveset('Charmander', 24);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.length).toBeLessThanOrEqual(4);
    expect(moves).toContain('flamethrower'); // learned at 24, the most recent
    expect(new Set(moves).size).toBe(moves.length); // no duplicates
  });
  it('a low-level mon only knows its early moves, not endgame coverage', () => {
    const low = wildMoveset('Charmander', 5);
    expect(low).not.toContain('flamethrower'); // not learned until 24
  });
  it('is deterministic and never empty', () => {
    expect(wildMoveset('Sentret', 5)).toEqual(wildMoveset('Sentret', 5));
    expect(wildMoveset('Sentret', 5).length).toBeGreaterThan(0);
  });
});
