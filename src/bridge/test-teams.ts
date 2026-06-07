import type { TeamSpec } from './types';

const fullEVs = { hp: 0, atk: 85, def: 85, spa: 85, spd: 85, spe: 85 };
const fullIVs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

export const PIKACHU_TEAM: TeamSpec = [
  {
    name: 'Pikachu', species: 'Pikachu', ability: 'Static', item: '',
    moves: ['thunderbolt', 'quickattack', 'irontail', 'thunderwave'],
    nature: 'Hardy', evs: fullEVs, ivs: fullIVs, level: 50,
  },
];

export const GYARADOS_TEAM: TeamSpec = [
  {
    name: 'Gyarados', species: 'Gyarados', ability: 'Intimidate', item: '',
    moves: ['waterfall', 'crunch', 'icefang', 'dragondance'],
    nature: 'Hardy', evs: fullEVs, ivs: fullIVs, level: 50,
  },
];
