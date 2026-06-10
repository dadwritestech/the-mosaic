import { describe, it, expect } from 'vitest';
import { createNewGame } from './game-state';
import { deserialize } from './save';

describe('riftStates migration', () => {
  it('a new game starts with no rift states', () => {
    const g = createNewGame({} as never);
    expect(g.riftStates).toEqual({});
  });
  it('deserialize defaults riftStates for an old save that lacks it', () => {
    const g = createNewGame({} as never);
    const { riftStates: _omit, ...rest } = g;
    const oldJson = JSON.stringify({ ...rest, pokedex: { seen: [], caught: [] } });
    expect(deserialize(oldJson).riftStates).toEqual({});
  });
});
