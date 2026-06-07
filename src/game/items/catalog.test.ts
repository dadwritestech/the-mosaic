import { describe, it, expect } from 'vitest';
import { ITEMS, getItem } from './catalog';

describe('item catalog', () => {
  it('has core items with prices and effects', () => {
    expect(getItem('potion').effect).toEqual({ kind: 'heal', amount: 20 });
    expect(getItem('ultraball').effect).toEqual({ kind: 'ball', ballType: 'ultra' });
    expect(getItem('thunderstone').effect).toEqual({ kind: 'evoStone', stone: 'Thunder Stone' });
    expect(getItem('potion').buyPrice).toBeGreaterThan(getItem('potion').sellPrice);
  });
  it('getItem throws on an unknown id', () => {
    expect(() => getItem('nonsense')).toThrow();
  });
});
