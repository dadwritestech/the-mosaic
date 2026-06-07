import { describe, it, expect } from 'vitest';
import { evolutionFor, evolve } from './evolution';
import { createOwned } from './owned-pokemon';
import { maxHp } from './stats';

describe('evolution', () => {
  it('finds a level-up evolution at the right level', () => {
    const low = createOwned({ species: 'Charmander', level: 15 });
    const ready = createOwned({ species: 'Charmander', level: 16 });
    expect(evolutionFor(low, { kind: 'level' })).toBeNull();
    expect(evolutionFor(ready, { kind: 'level' })).toBe('Charmeleon');
  });

  it('finds a stone evolution for the matching item', () => {
    const pika = createOwned({ species: 'Pikachu', level: 20 });
    expect(evolutionFor(pika, { kind: 'item', item: 'Thunder Stone' })).toBe('Raichu');
    expect(evolutionFor(pika, { kind: 'item', item: 'Water Stone' })).toBeNull();
  });

  it('evolve changes species, keeps ability slot, and raises stats', () => {
    const before = createOwned({ species: 'Charmander', level: 16 });
    const hpBefore = maxHp(before);
    const after = evolve(before, 'Charmeleon');
    expect(after.species).toBe('Charmeleon');
    expect(maxHp(after)).toBeGreaterThan(hpBefore);
    expect(after.uid).toBe(before.uid); // same individual
  });

  it('returns null for a non-evolving species', () => {
    expect(evolutionFor(createOwned({ species: 'Tauros', level: 50 }), { kind: 'level' })).toBeNull();
  });
});
