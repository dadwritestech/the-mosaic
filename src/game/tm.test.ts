import { describe, it, expect } from 'vitest';
import { teachMove } from './tm';
import { createOwned } from './owned-pokemon';

describe('teachMove', () => {
  it('teaches a learnable move into an empty slot', () => {
    const mon = createOwned({ species: 'Pikachu', level: 20, moves: ['thunderbolt'] });
    const { mon: after, result } = teachMove(mon, 'irontail');
    expect(result.ok).toBe(true);
    expect(after.moves.map((m) => m.id)).toContain('irontail');
  });

  it('rejects an un-learnable move', () => {
    const mon = createOwned({ species: 'Pikachu', level: 20, moves: ['thunderbolt'] });
    const { result } = teachMove(mon, 'hydrocannon');
    expect(result.ok).toBe(false);
  });

  it('replaces the move at replaceIndex when the moveset is full', () => {
    const mon = createOwned({ species: 'Pikachu', level: 20, moves: ['thunderbolt', 'quickattack', 'irontail', 'thunderwave'] });
    const { mon: after, result } = teachMove(mon, 'surf', 1);
    expect(result.ok).toBe(true);
    expect(after.moves[1].id).toBe('surf');
    expect(after.moves.length).toBe(4);
  });
});
