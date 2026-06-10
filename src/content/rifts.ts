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

// ── Rift 2: Drowning Coast — johto-forests (2) ⇄ hoenn-beaches (3), lv 18–22
const DROWNING_COAST: RiftDef = {
  id: 'drowning-coast', name: 'Drowning Coast',
  biomeA: 'johto-forests', biomeB: 'hoenn-beaches',
  levelBand: { min: 18, max: 22 },
  warden: {
    id: 'maris', name: 'Maris', baseTier: 'normal',
    personality: { aggression: 0.4, caution: 0.7 }, teamSize: 3, levelCap: 22,
    basePayout: 60, dropTable: [{ itemId: 'hyperpotion', chance: 0.8 }],
    signatureTactic: 'rain-stall',
  },
  fusedEncounters: {
    morning: [
      { species: 'Hoppip', minLevel: 18, maxLevel: 21, weight: 5 },
      { species: 'Wingull', minLevel: 18, maxLevel: 21, weight: 5 },
      { species: 'Lotad', minLevel: 18, maxLevel: 20, weight: 4 },
    ],
    day: [
      { species: 'Yanma', minLevel: 18, maxLevel: 21, weight: 4 },
      { species: 'Wingull', minLevel: 19, maxLevel: 22, weight: 5 },
      { species: 'Carvanha', minLevel: 19, maxLevel: 22, weight: 3 },
    ],
    night: [
      { species: 'Wooper', minLevel: 18, maxLevel: 21, weight: 5 },
      { species: 'Carvanha', minLevel: 19, maxLevel: 22, weight: 4 },
    ],
  },
  pureEncountersA: {
    morning: [{ species: 'Hoppip', minLevel: 18, maxLevel: 21, weight: 6 }, { species: 'Aipom', minLevel: 19, maxLevel: 22, weight: 3 }],
    day: [{ species: 'Yanma', minLevel: 18, maxLevel: 21, weight: 5 }, { species: 'Noctowl', minLevel: 20, maxLevel: 22, weight: 2 }],
    night: [{ species: 'Wooper', minLevel: 18, maxLevel: 21, weight: 6 }, { species: 'Hoothoot', minLevel: 18, maxLevel: 21, weight: 4 }],
  },
  pureEncountersB: {
    morning: [{ species: 'Wingull', minLevel: 18, maxLevel: 21, weight: 6 }, { species: 'Lotad', minLevel: 18, maxLevel: 20, weight: 4 }],
    day: [{ species: 'Wingull', minLevel: 19, maxLevel: 22, weight: 5 }, { species: 'Wailmer', minLevel: 20, maxLevel: 22, weight: 3 }],
    night: [{ species: 'Carvanha', minLevel: 18, maxLevel: 21, weight: 6 }, { species: 'Corphish', minLevel: 19, maxLevel: 22, weight: 4 }],
  },
};

// ── Rift 3: Emberreef — hoenn-beaches (3) ⇄ alola-islands (7), lv 25–29
const EMBERREEF: RiftDef = {
  id: 'emberreef', name: 'Emberreef',
  biomeA: 'hoenn-beaches', biomeB: 'alola-islands',
  levelBand: { min: 25, max: 29 },
  warden: {
    id: 'ignis', name: 'Ignis', baseTier: 'normal',
    personality: { aggression: 0.85, caution: 0.2 }, teamSize: 3, levelCap: 29,
    basePayout: 80, dropTable: [{ itemId: 'hyperpotion', chance: 0.8 }],
    signatureTactic: 'sun-aggro',
  },
  fusedEncounters: {
    morning: [
      { species: 'Numel', minLevel: 25, maxLevel: 28, weight: 5 },
      { species: 'Salandit', minLevel: 25, maxLevel: 28, weight: 4 },
      { species: 'Wingull', minLevel: 25, maxLevel: 27, weight: 4 },
    ],
    day: [
      { species: 'Torkoal', minLevel: 26, maxLevel: 29, weight: 4 },
      { species: 'Wimpod', minLevel: 25, maxLevel: 28, weight: 4 },
      { species: 'Mareanie', minLevel: 26, maxLevel: 29, weight: 3 },
    ],
    night: [
      { species: 'Salandit', minLevel: 26, maxLevel: 29, weight: 5 },
      { species: 'Carvanha', minLevel: 25, maxLevel: 28, weight: 4 },
    ],
  },
  pureEncountersA: {
    morning: [{ species: 'Numel', minLevel: 25, maxLevel: 28, weight: 6 }, { species: 'Wingull', minLevel: 25, maxLevel: 27, weight: 4 }],
    day: [{ species: 'Torkoal', minLevel: 26, maxLevel: 29, weight: 5 }, { species: 'Trapinch', minLevel: 25, maxLevel: 28, weight: 3 }],
    night: [{ species: 'Carvanha', minLevel: 25, maxLevel: 28, weight: 6 }, { species: 'Corphish', minLevel: 26, maxLevel: 29, weight: 4 }],
  },
  pureEncountersB: {
    morning: [{ species: 'Salandit', minLevel: 25, maxLevel: 28, weight: 6 }, { species: 'Wimpod', minLevel: 25, maxLevel: 28, weight: 4 }],
    day: [{ species: 'Mareanie', minLevel: 26, maxLevel: 29, weight: 5 }, { species: 'Fomantis', minLevel: 25, maxLevel: 28, weight: 3 }],
    night: [{ species: 'Salandit', minLevel: 26, maxLevel: 29, weight: 6 }, { species: 'Crabrawler', minLevel: 26, maxLevel: 29, weight: 4 }],
  },
};

// ── Rift 4: Neon Wilds — alola-islands (7) ⇄ unova-urban (5), lv 32–36
const NEON_WILDS: RiftDef = {
  id: 'neon-wilds', name: 'Neon Wilds',
  biomeA: 'alola-islands', biomeB: 'unova-urban',
  levelBand: { min: 32, max: 36 },
  warden: {
    id: 'zap', name: 'Zap', baseTier: 'normal',
    personality: { aggression: 0.7, caution: 0.4 }, teamSize: 4, levelCap: 36,
    basePayout: 100, dropTable: [{ itemId: 'hyperpotion', chance: 0.8 }],
    signatureTactic: 'terrain-speed',
  },
  fusedEncounters: {
    morning: [
      { species: 'Yungoos', minLevel: 32, maxLevel: 35, weight: 5 },
      { species: 'Blitzle', minLevel: 32, maxLevel: 35, weight: 5 },
      { species: 'Joltik', minLevel: 32, maxLevel: 34, weight: 4 },
    ],
    day: [
      { species: 'Charjabug', minLevel: 33, maxLevel: 36, weight: 4 },
      { species: 'Klink', minLevel: 33, maxLevel: 36, weight: 4 },
      { species: 'Lillipup', minLevel: 32, maxLevel: 35, weight: 4 },
    ],
    night: [
      { species: 'Joltik', minLevel: 33, maxLevel: 36, weight: 5 },
      { species: 'Fomantis', minLevel: 32, maxLevel: 35, weight: 4 },
    ],
  },
  pureEncountersA: {
    morning: [{ species: 'Yungoos', minLevel: 32, maxLevel: 35, weight: 6 }, { species: 'Pikipek', minLevel: 32, maxLevel: 35, weight: 4 }],
    day: [{ species: 'Charjabug', minLevel: 33, maxLevel: 36, weight: 5 }, { species: 'Crabrawler', minLevel: 33, maxLevel: 36, weight: 3 }],
    night: [{ species: 'Fomantis', minLevel: 32, maxLevel: 35, weight: 6 }, { species: 'Salandit', minLevel: 33, maxLevel: 36, weight: 4 }],
  },
  pureEncountersB: {
    morning: [{ species: 'Blitzle', minLevel: 32, maxLevel: 35, weight: 6 }, { species: 'Lillipup', minLevel: 32, maxLevel: 35, weight: 4 }],
    day: [{ species: 'Klink', minLevel: 33, maxLevel: 36, weight: 5 }, { species: 'Trubbish', minLevel: 33, maxLevel: 36, weight: 3 }],
    night: [{ species: 'Joltik', minLevel: 32, maxLevel: 35, weight: 6 }, { species: 'Minccino', minLevel: 33, maxLevel: 36, weight: 4 }],
  },
};

// ── Rift 5: Bloomgrave — unova-urban (5) ⇄ kalos-gardens (6), lv 39–43
const BLOOMGRAVE: RiftDef = {
  id: 'bloomgrave', name: 'Bloomgrave',
  biomeA: 'unova-urban', biomeB: 'kalos-gardens',
  levelBand: { min: 39, max: 43 },
  warden: {
    id: 'sylas', name: 'Sylas', baseTier: 'hard',
    personality: { aggression: 0.4, caution: 0.85 }, teamSize: 4, levelCap: 43,
    basePayout: 120, dropTable: [{ itemId: 'hyperpotion', chance: 1 }],
    signatureTactic: 'trick-room',
  },
  fusedEncounters: {
    morning: [
      { species: 'Solosis', minLevel: 39, maxLevel: 42, weight: 5 },
      { species: 'Spritzee', minLevel: 39, maxLevel: 42, weight: 5 },
      { species: 'Espurr', minLevel: 39, maxLevel: 41, weight: 4 },
    ],
    day: [
      { species: 'Elgyem', minLevel: 40, maxLevel: 43, weight: 4 },
      { species: 'Skiddo', minLevel: 40, maxLevel: 43, weight: 4 },
      { species: 'Minccino', minLevel: 39, maxLevel: 42, weight: 4 },
    ],
    night: [
      { species: 'Gothita', minLevel: 40, maxLevel: 43, weight: 5 },
      { species: 'Espurr', minLevel: 39, maxLevel: 42, weight: 4 },
    ],
  },
  pureEncountersA: {
    morning: [{ species: 'Solosis', minLevel: 39, maxLevel: 42, weight: 6 }, { species: 'Trubbish', minLevel: 39, maxLevel: 42, weight: 4 }],
    day: [{ species: 'Elgyem', minLevel: 40, maxLevel: 43, weight: 5 }, { species: 'Minccino', minLevel: 39, maxLevel: 42, weight: 3 }],
    night: [{ species: 'Gothita', minLevel: 39, maxLevel: 42, weight: 6 }, { species: 'Solosis', minLevel: 40, maxLevel: 43, weight: 4 }],
  },
  pureEncountersB: {
    morning: [{ species: 'Spritzee', minLevel: 39, maxLevel: 42, weight: 6 }, { species: 'Fletchling', minLevel: 39, maxLevel: 42, weight: 4 }],
    day: [{ species: 'Skiddo', minLevel: 40, maxLevel: 43, weight: 5 }, { species: 'Bunnelby', minLevel: 39, maxLevel: 42, weight: 3 }],
    night: [{ species: 'Espurr', minLevel: 39, maxLevel: 42, weight: 6 }, { species: 'Furfrou', minLevel: 40, maxLevel: 43, weight: 4 }],
  },
};

// ── Rift 6: Frostbloom — kalos-gardens (6) ⇄ sinnoh-tundra (4), lv 46–50
const FROSTBLOOM: RiftDef = {
  id: 'frostbloom', name: 'Frostbloom',
  biomeA: 'kalos-gardens', biomeB: 'sinnoh-tundra',
  levelBand: { min: 46, max: 50 },
  warden: {
    id: 'glacia', name: 'Glacia', baseTier: 'hard',
    personality: { aggression: 0.5, caution: 0.7 }, teamSize: 4, levelCap: 50,
    basePayout: 130, dropTable: [{ itemId: 'hyperpotion', chance: 1 }],
    signatureTactic: 'snow-veil',
  },
  fusedEncounters: {
    morning: [
      { species: 'Bergmite', minLevel: 46, maxLevel: 49, weight: 5 },
      { species: 'Snover', minLevel: 46, maxLevel: 49, weight: 5 },
      { species: 'Spritzee', minLevel: 46, maxLevel: 48, weight: 3 },
    ],
    day: [
      { species: 'Amaura', minLevel: 47, maxLevel: 50, weight: 4 },
      { species: 'Snorunt', minLevel: 47, maxLevel: 50, weight: 4 },
      { species: 'Sneasel', minLevel: 46, maxLevel: 49, weight: 3 },
    ],
    night: [
      { species: 'Snover', minLevel: 47, maxLevel: 50, weight: 5 },
      { species: 'Sneasel', minLevel: 46, maxLevel: 49, weight: 4 },
    ],
  },
  pureEncountersA: {
    morning: [{ species: 'Bergmite', minLevel: 46, maxLevel: 49, weight: 6 }, { species: 'Spritzee', minLevel: 46, maxLevel: 48, weight: 4 }],
    day: [{ species: 'Amaura', minLevel: 47, maxLevel: 50, weight: 5 }, { species: 'Skiddo', minLevel: 46, maxLevel: 49, weight: 3 }],
    night: [{ species: 'Espurr', minLevel: 46, maxLevel: 49, weight: 6 }, { species: 'Furfrou', minLevel: 47, maxLevel: 50, weight: 4 }],
  },
  pureEncountersB: {
    morning: [{ species: 'Snover', minLevel: 46, maxLevel: 49, weight: 6 }, { species: 'Snorunt', minLevel: 46, maxLevel: 49, weight: 4 }],
    day: [{ species: 'Sneasel', minLevel: 47, maxLevel: 50, weight: 5 }, { species: 'Glaceon', minLevel: 48, maxLevel: 50, weight: 2 }],
    night: [{ species: 'Snover', minLevel: 46, maxLevel: 49, weight: 6 }, { species: 'Froslass', minLevel: 48, maxLevel: 50, weight: 3 }],
  },
};

// ── Rift 7: The Maw — sinnoh-tundra (4) ⇄ paldea-wilds (9), lv 53–57
const THE_MAW: RiftDef = {
  id: 'the-maw', name: 'The Maw',
  biomeA: 'sinnoh-tundra', biomeB: 'paldea-wilds',
  levelBand: { min: 53, max: 57 },
  warden: {
    id: 'vriska', name: 'Vriska', baseTier: 'hard',
    personality: { aggression: 0.8, caution: 0.5 }, teamSize: 4, levelCap: 57,
    basePayout: 150, dropTable: [{ itemId: 'hyperpotion', chance: 1 }],
    signatureTactic: 'dragon-chaos',
  },
  fusedEncounters: {
    morning: [
      { species: 'Gible', minLevel: 53, maxLevel: 56, weight: 5 },
      { species: 'Frigibax', minLevel: 53, maxLevel: 56, weight: 5 },
      { species: 'Snover', minLevel: 53, maxLevel: 55, weight: 3 },
    ],
    day: [
      { species: 'Gabite', minLevel: 54, maxLevel: 57, weight: 4 },
      { species: 'Cyclizar', minLevel: 54, maxLevel: 57, weight: 4 },
      { species: 'Sneasel', minLevel: 53, maxLevel: 56, weight: 3 },
    ],
    night: [
      { species: 'Frigibax', minLevel: 54, maxLevel: 57, weight: 5 },
      { species: 'Maschiff', minLevel: 53, maxLevel: 56, weight: 4 },
    ],
  },
  pureEncountersA: {
    morning: [{ species: 'Gible', minLevel: 53, maxLevel: 56, weight: 6 }, { species: 'Snover', minLevel: 53, maxLevel: 55, weight: 4 }],
    day: [{ species: 'Gabite', minLevel: 54, maxLevel: 57, weight: 5 }, { species: 'Hippopotas', minLevel: 53, maxLevel: 56, weight: 3 }],
    night: [{ species: 'Sneasel', minLevel: 53, maxLevel: 56, weight: 6 }, { species: 'Froslass', minLevel: 55, maxLevel: 57, weight: 3 }],
  },
  pureEncountersB: {
    morning: [{ species: 'Frigibax', minLevel: 53, maxLevel: 56, weight: 6 }, { species: 'Cetoddle', minLevel: 53, maxLevel: 56, weight: 4 }],
    day: [{ species: 'Cyclizar', minLevel: 54, maxLevel: 57, weight: 5 }, { species: 'Tatsugiri', minLevel: 54, maxLevel: 57, weight: 3 }],
    night: [{ species: 'Maschiff', minLevel: 53, maxLevel: 56, weight: 6 }, { species: 'Frigibax', minLevel: 55, maxLevel: 57, weight: 4 }],
  },
};

export const RIFTS: RiftDef[] = [
  THORNMARSH, DROWNING_COAST, EMBERREEF, NEON_WILDS, BLOOMGRAVE, FROSTBLOOM, THE_MAW,
];

export const ALL_RIFTS = RIFTS;
export function getRift(id: string): RiftDef | undefined {
  return RIFTS.find((r) => r.id === id);
}
