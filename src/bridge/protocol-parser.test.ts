import { describe, it, expect } from 'vitest';
import { parseLine, sideOf } from './protocol-parser';

describe('protocol parser', () => {
  it('extracts the side from a pokemon identifier', () => {
    expect(sideOf('p1a: Pikachu')).toBe('p1');
    expect(sideOf('p2a: Gyarados')).toBe('p2');
  });

  it('parses a move line', () => {
    expect(parseLine('|move|p1a: Pikachu|Thunderbolt|p2a: Gyarados'))
      .toEqual({ type: 'move', side: 'p1', move: 'Thunderbolt' });
  });

  it('parses a damage line with hp fraction', () => {
    expect(parseLine('|-damage|p2a: Gyarados|62/100'))
      .toEqual({ type: 'damage', side: 'p2', hpPercent: 62 });
  });

  it('parses faint, status, turn, and win', () => {
    expect(parseLine('|faint|p2a: Gyarados')).toEqual({ type: 'faint', side: 'p2' });
    expect(parseLine('|-status|p1a: Pikachu|par')).toEqual({ type: 'status', side: 'p1', status: 'par' });
    expect(parseLine('|turn|2')).toEqual({ type: 'turn', turn: 2 });
    expect(parseLine('|win|P1')).toEqual({ type: 'win', side: 'p1' });
  });

  it('returns null for irrelevant lines', () => {
    expect(parseLine('|upkeep')).toBeNull();
  });
});
