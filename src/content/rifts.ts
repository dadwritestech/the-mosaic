import type { RiftDef } from './types';

// ── Rift 1: Thornmarsh — kanto-plains (Gen 1) ⇄ johto-forests (Gen 2), lv 10–14
const THORNMARSH: RiftDef = {
  id: 'thornmarsh',
  name: 'Thornmarsh Rift',
  biomeA: 'kanto-plains',
  biomeB: 'johto-forests',
  levelBand: { min: 10, max: 14 },
  warden: {
    id: 'bramble', name: 'Bramble', baseTier: 'easy',
    personality: { aggression: 0.45, caution: 0.6 },
    teamSize: 3, levelCap: 14, basePayout: 40,
    dropTable: [{ itemId: 'superpotion', chance: 1 }],
    signatureTactic: 'overgrowth-hazards', // grassy terrain + entry hazards, slow attrition
  },
  // Seam mix: Kanto plains + Johto forest species bleeding together.
  fusedEncounters: {
    morning: [
      { species: 'Pidgey', minLevel: 10, maxLevel: 13, weight: 5 },
      { species: 'Hoothoot', minLevel: 10, maxLevel: 13, weight: 5 },
      { species: 'Sentret', minLevel: 11, maxLevel: 14, weight: 4 },
    ],
    day: [
      { species: 'Rattata', minLevel: 10, maxLevel: 13, weight: 5 },
      { species: 'Ledyba', minLevel: 10, maxLevel: 13, weight: 4 },
      { species: 'Caterpie', minLevel: 10, maxLevel: 12, weight: 4 },
    ],
    night: [
      { species: 'Spinarak', minLevel: 11, maxLevel: 14, weight: 5 },
      { species: 'Hoothoot', minLevel: 11, maxLevel: 14, weight: 5 },
      { species: 'Rattata', minLevel: 10, maxLevel: 13, weight: 4 },
    ],
  },
  // Sealed -> Kanto plains (Gen 1) species only.
  pureEncountersA: {
    morning: [
      { species: 'Pidgey', minLevel: 10, maxLevel: 13, weight: 6 },
      { species: 'Rattata', minLevel: 10, maxLevel: 13, weight: 4 },
    ],
    day: [
      { species: 'Pidgey', minLevel: 10, maxLevel: 13, weight: 5 },
      { species: 'Spearow', minLevel: 11, maxLevel: 14, weight: 3 },
      { species: 'Caterpie', minLevel: 10, maxLevel: 12, weight: 2 },
    ],
    night: [
      { species: 'Rattata', minLevel: 10, maxLevel: 13, weight: 6 },
      { species: 'Zubat', minLevel: 11, maxLevel: 14, weight: 4 },
    ],
  },
  // Sealed -> Johto forest (Gen 2) species only.
  pureEncountersB: {
    morning: [
      { species: 'Hoothoot', minLevel: 10, maxLevel: 13, weight: 6 },
      { species: 'Sentret', minLevel: 10, maxLevel: 13, weight: 4 },
    ],
    day: [
      { species: 'Ledyba', minLevel: 10, maxLevel: 13, weight: 5 },
      { species: 'Hoppip', minLevel: 10, maxLevel: 13, weight: 3 },
      { species: 'Sentret', minLevel: 11, maxLevel: 14, weight: 2 },
    ],
    night: [
      { species: 'Spinarak', minLevel: 10, maxLevel: 13, weight: 6 },
      { species: 'Hoothoot', minLevel: 11, maxLevel: 14, weight: 4 },
    ],
  },
};

export const RIFTS: RiftDef[] = [THORNMARSH];

export const ALL_RIFTS = RIFTS;
export function getRift(id: string): RiftDef | undefined {
  return RIFTS.find((r) => r.id === id);
}
