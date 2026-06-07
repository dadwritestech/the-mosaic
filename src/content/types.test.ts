import { describe, it, expect } from 'vitest';
import type { Location, GymDef, EncounterTable } from './types';

describe('content schema', () => {
  it('constructs a minimal route location', () => {
    const enc: EncounterTable = { day: [{ species: 'Pidgey', minLevel: 2, maxLevel: 4, weight: 1 }] };
    const route: Location = {
      id: 'r1', name: 'Route', kind: 'route', biome: 'kanto-plains',
      connections: ['town'], isPokemonCenter: false, npcs: [], encounters: enc,
    };
    expect(route.encounters!.day![0].species).toBe('Pidgey');
  });
  it('constructs a gym def', () => {
    const gym: GymDef = {
      id: 'g1', badgeId: 'leaf', type: 'Grass',
      trainer: { id: 't1', name: 'Bramble', gymType: 'Grass', baseTier: 'easy',
        personality: { aggression: 0.6, caution: 0.3 }, teamSize: 2, levelCap: 12, basePayout: 20 },
    };
    expect(gym.type).toBe('Grass');
  });
});
