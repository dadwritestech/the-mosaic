import { describe, it, expect } from 'vitest';
import { createNewGame } from './game-state';
import { serialize, deserialize } from './save';

describe('stabilizeMeter field', () => {
  it('starts at 0 and round-trips through save', () => {
    const g = createNewGame({ difficultyMode: 'normal', nuzlocke: false });
    expect(g.stabilizeMeter).toBe(0);
    g.stabilizeMeter = -20;
    expect(deserialize(serialize(g)).stabilizeMeter).toBe(-20);
  });
});
