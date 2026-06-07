import { describe, it, expect } from 'vitest';
import { createNewGame } from './game-state';
import { serialize, deserialize } from './save';

describe('trainerLog field', () => {
  it('createNewGame initializes an empty trainerLog', () => {
    expect(createNewGame({ difficultyMode: 'normal', nuzlocke: false }).trainerLog).toEqual({});
  });
  it('trainerLog round-trips through save', () => {
    const g = createNewGame({ difficultyMode: 'normal', nuzlocke: false });
    g.trainerLog['rival'] = { defeats: 2, lastDefeatedDay: 3, readyDay: 4 };
    expect(deserialize(serialize(g)).trainerLog.rival.defeats).toBe(2);
  });
});
