import type { Location, TrainerDef, GymDef } from '../types';
import type { ShopDef } from '../../game/shop';

export const BRAMBLE: TrainerDef = {
  id: 'bramble', name: 'Bramble', gymType: 'Grass', baseTier: 'easy',
  personality: { aggression: 0.6, caution: 0.4 }, teamSize: 2, levelCap: 12,
  basePayout: 20, dropTable: [{ itemId: 'superpotion', chance: 1 }],
};

export const ROUTE_YOUNGSTER: TrainerDef = {
  id: 'youngster-tim', name: 'Youngster Tim', baseTier: 'easy',
  personality: { aggression: 0.8, caution: 0.1 }, teamSize: 1, levelCap: 5, basePayout: 10,
};

export const VERDANT_GYM: GymDef = { id: 'verdant-gym', trainer: BRAMBLE, badgeId: 'mosaic-leaf', type: 'Grass' };

export const AETHEL_MART: ShopDef = {
  id: 'aethel-mart', name: 'Aethel Mart',
  stock: [{ itemId: 'pokeball', badgeGate: 0 }, { itemId: 'potion', badgeGate: 0 }],
};

export const LOCATIONS: Location[] = [
  {
    id: 'aethels-rest', name: "Aethel's Rest", kind: 'town', biome: 'kanto-plains',
    connections: ['whispering-path'], isPokemonCenter: true, shopId: 'aethel-mart',
    npcs: [{ id: 'aethel', name: 'Aethel', lines: ['The Core remembers every trainer who walked here.'] }],
  },
  {
    id: 'whispering-path', name: 'Whispering Path', kind: 'route', biome: 'kanto-plains',
    connections: ['aethels-rest', 'verdant-hollow'], isPokemonCenter: false, npcs: [],
    encounters: {
      morning: [{ species: 'Pidgey', minLevel: 2, maxLevel: 4, weight: 6 }, { species: 'Rattata', minLevel: 2, maxLevel: 4, weight: 4 }],
      day: [{ species: 'Pidgey', minLevel: 3, maxLevel: 5, weight: 5 }, { species: 'Caterpie', minLevel: 2, maxLevel: 4, weight: 5 }],
      night: [{ species: 'Rattata', minLevel: 3, maxLevel: 5, weight: 5 }, { species: 'Hoothoot', minLevel: 3, maxLevel: 5, weight: 5 }],
    },
  },
  {
    id: 'verdant-hollow', name: 'Verdant Hollow', kind: 'town', biome: 'johto-forests',
    connections: ['whispering-path'], isPokemonCenter: true, gymId: 'verdant-gym', npcs: [],
  },
];

export const TRAINERS: TrainerDef[] = [BRAMBLE, ROUTE_YOUNGSTER];
export const GYMS: GymDef[] = [VERDANT_GYM];
export const SHOPS: ShopDef[] = [AETHEL_MART];
