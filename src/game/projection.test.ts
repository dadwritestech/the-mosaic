import { describe, it, expect } from 'vitest';
import { ownedToSet } from './projection';
import { createOwned } from './owned-pokemon';

describe('ownedToSet', () => {
  it('projects an owned mon into a Battle Bridge PokemonSet', () => {
    const mon = createOwned({ species: 'Pikachu', level: 50, nickname: 'Sparky', moves: ['thunderbolt', 'quickattack'], nature: 'Timid' });
    const set = ownedToSet(mon);
    expect(set.species).toBe('Pikachu');
    expect(set.name).toBe('Sparky');         // nickname carries
    expect(set.level).toBe(50);
    expect(set.moves).toEqual(['thunderbolt', 'quickattack']);
    expect(set.nature).toBe('Timid');
    expect(set.ivs.spa).toBe(31);
  });
});
