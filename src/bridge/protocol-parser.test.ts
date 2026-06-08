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

  it('parses boosts/unboosts as signed amounts', () => {
    expect(parseLine('|-boost|p1a: Pikachu|atk|2')).toEqual({ type: 'boost', side: 'p1', stat: 'atk', amount: 2 });
    expect(parseLine('|-unboost|p2a: Foe|spe|1')).toEqual({ type: 'boost', side: 'p2', stat: 'spe', amount: -1 });
  });

  it('parses weather (and clears on "none")', () => {
    expect(parseLine('|-weather|RainDance')).toEqual({ type: 'weather', weather: 'RainDance' });
    expect(parseLine('|-weather|none')).toEqual({ type: 'weather', weather: '' });
  });

  it('parses cure, heal, volatiles, items, abilities, terrain', () => {
    expect(parseLine('|-curestatus|p1a: Pikachu|par')).toEqual({ type: 'cure', side: 'p1', status: 'par' });
    expect(parseLine('|-heal|p1a: Pikachu|80/100')).toEqual({ type: 'heal', side: 'p1', hpPercent: 80 });
    expect(parseLine('|-start|p2a: Foe|confusion')).toEqual({ type: 'volatile', side: 'p2', effect: 'confusion', start: true });
    expect(parseLine('|-end|p2a: Foe|confusion')).toEqual({ type: 'volatile', side: 'p2', effect: 'confusion', start: false });
    expect(parseLine('|-item|p1a: Pikachu|Leftovers')).toEqual({ type: 'item', side: 'p1', item: 'Leftovers', ended: false });
    expect(parseLine('|-enditem|p1a: Pikachu|Sitrus Berry')).toEqual({ type: 'item', side: 'p1', item: 'Sitrus Berry', ended: true });
    expect(parseLine('|-ability|p2a: Foe|Intimidate')).toEqual({ type: 'ability', side: 'p2', ability: 'Intimidate' });
    expect(parseLine('|-fieldstart|move: Electric Terrain')).toEqual({ type: 'field', effect: 'Electric Terrain', start: true });
  });
});
