// Full 8-badge region for The Mosaic.
// Reuses the 4a vertical-slice (Aethel's Rest, Whispering Path, Verdant Hollow, Bramble, Aethel Mart)
// and extends it with 7 more gyms, connecting routes, trainers, shops, and NPCs.

import type { Location, TrainerDef, GymDef, EncounterTable, NpcDef } from '../types';
import type { ShopDef } from '../../game/shop';
import {
  LOCATIONS as SLICE_LOCATIONS,
  TRAINERS as SLICE_TRAINERS,
  GYMS as SLICE_GYMS,
  SHOPS as SLICE_SHOPS,
  BRAMBLE,
  VERDANT_GYM,
  AETHEL_MART,
  ROUTE_YOUNGSTER,
} from '../slice/data';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Re-export slice locations, fixing encounters to use Gen-9-standard species. */
function sliceLocations(): Location[] {
  return SLICE_LOCATIONS.map((loc) => {
    if (loc.id === 'whispering-path') {
      // Replace Past-era species with Gen-9-standard equivalents.
      return {
        ...loc,
        encounters: {
          morning: [
            { species: 'Sentret', minLevel: 2, maxLevel: 4, weight: 6 },
            { species: 'Hoothoot', minLevel: 2, maxLevel: 4, weight: 4 },
          ],
          day: [
            { species: 'Hoothoot', minLevel: 3, maxLevel: 5, weight: 5 },
            { species: 'Spinarak', minLevel: 2, maxLevel: 4, weight: 5 },
          ],
          night: [
            { species: 'Sentret', minLevel: 3, maxLevel: 5, weight: 5 },
            { species: 'Shuppet', minLevel: 3, maxLevel: 5, weight: 5 },
          ],
        },
      };
    }
    if (loc.id === 'verdant-hollow') {
      // Add connection to the next route (slice only had whispering-path).
      return { ...loc, connections: ['whispering-path', 'verdant-tangle'] };
    }
    return loc;
  });
}

// ─── Gyms 2–8 ───────────────────────────────────────────────────────────────

const MARIS: TrainerDef = {
  id: 'maris', name: 'Maris', gymType: 'Water', baseTier: 'easy',
  personality: { aggression: 0.4, caution: 0.7 }, teamSize: 3, levelCap: 18,
  basePayout: 40, dropTable: [{ itemId: 'superpotion', chance: 1 }],
};

const IGNIS: TrainerDef = {
  id: 'ignis', name: 'Ignis', gymType: 'Fire', baseTier: 'normal',
  personality: { aggression: 0.8, caution: 0.2 }, teamSize: 3, levelCap: 24,
  basePayout: 60, dropTable: [{ itemId: 'hyperpotion', chance: 0.8 }],
};

const ZAP: TrainerDef = {
  id: 'zap', name: 'Zap', gymType: 'Electric', baseTier: 'normal',
  personality: { aggression: 0.7, caution: 0.3 }, teamSize: 3, levelCap: 30,
  basePayout: 80, dropTable: [{ itemId: 'hyperpotion', chance: 0.8 }],
};

const SYLAS: TrainerDef = {
  id: 'sylas', name: 'Sylas', gymType: 'Psychic', baseTier: 'hard',
  personality: { aggression: 0.3, caution: 0.9 }, teamSize: 4, levelCap: 36,
  basePayout: 120, dropTable: [{ itemId: 'maxpotion', chance: 0.6 }],
};

const GLACIA: TrainerDef = {
  id: 'glacia', name: 'Glacia', gymType: 'Ice', baseTier: 'hard',
  personality: { aggression: 0.5, caution: 0.6 }, teamSize: 4, levelCap: 42,
  basePayout: 160, dropTable: [{ itemId: 'maxpotion', chance: 0.6 }],
};

const VRISKA: TrainerDef = {
  id: 'vriska', name: 'Vriska', gymType: 'Dragon', baseTier: 'hard',
  personality: { aggression: 0.9, caution: 0.1 }, teamSize: 4, levelCap: 48,
  basePayout: 200, dropTable: [{ itemId: 'maxrevive', chance: 0.5 }],
};

const NOCTIS: TrainerDef = {
  id: 'noctis', name: 'Noctis', gymType: 'Dark', baseTier: 'hard',
  personality: { aggression: 1.0, caution: 0.0 }, teamSize: 4, levelCap: 52,
  basePayout: 250, dropTable: [{ itemId: 'maxrevive', chance: 0.5 }],
};

const CERULEAN_GYM: GymDef = { id: 'cerulean-gym', trainer: MARIS, badgeId: 'mosaic-tide', type: 'Water' };
const EMBER_GYM: GymDef = { id: 'ember-gym', trainer: IGNIS, badgeId: 'mosaic-flame', type: 'Fire' };
const VOLTSPIRE_GYM: GymDef = { id: 'voltspire-gym', trainer: ZAP, badgeId: 'mosaic-volt', type: 'Electric' };
const MINDWEAVE_GYM: GymDef = { id: 'mindweave-gym', trainer: SYLAS, badgeId: 'mosaic-mind', type: 'Psychic' };
const FROSTFELL_GYM: GymDef = { id: 'frostfell-gym', trainer: GLACIA, badgeId: 'mosaic-frost', type: 'Ice' };
const DRAKEMAW_GYM: GymDef = { id: 'drakemaw-gym', trainer: VRISKA, badgeId: 'mosaic-draconic', type: 'Dragon' };
const SHADOWMERE_GYM: GymDef = { id: 'shadowmere-gym', trainer: NOCTIS, badgeId: 'mosaic-shadow', type: 'Dark' };

// ─── Route trainers ─────────────────────────────────────────────────────────

const ROUTE_TRAINERS: TrainerDef[] = [
  // Route: Verdant Tangle (between Verdant Hollow & Cerulean Deep)
  { id: 'lure-nia', name: 'Lure Nia', baseTier: 'easy', personality: { aggression: 0.5, caution: 0.5 }, teamSize: 1, levelCap: 14, basePayout: 15 },
  { id: 'hiker-garrick', name: 'Hiker Garrick', baseTier: 'easy', personality: { aggression: 0.6, caution: 0.3 }, teamSize: 2, levelCap: 15, basePayout: 20 },
  // Route: Tidal Drift (between Cerulean Deep & Ember Peak)
  { id: 'fisher-kai', name: 'Fisher Kai', baseTier: 'easy', personality: { aggression: 0.4, caution: 0.6 }, teamSize: 1, levelCap: 20, basePayout: 25 },
  { id: 'swimmer-elara', name: 'Swimmer Elara', baseTier: 'normal', personality: { aggression: 0.5, caution: 0.5 }, teamSize: 2, levelCap: 21, basePayout: 30 },
  // Route: Scorched Ascent (between Ember Peak & Voltspire)
  { id: 'bugcatcher-ren', name: 'Bug Catcher Ren', baseTier: 'normal', personality: { aggression: 0.3, caution: 0.7 }, teamSize: 2, levelCap: 26, basePayout: 35 },
  { id: 'ace-trainer-dex', name: 'Ace Trainer Dex', baseTier: 'normal', personality: { aggression: 0.7, caution: 0.3 }, teamSize: 3, levelCap: 27, basePayout: 40 },
  // Route: Circuit Way (between Voltspire & Mindweave)
  { id: 'engineer-mira', name: 'Engineer Mira', baseTier: 'normal', personality: { aggression: 0.6, caution: 0.4 }, teamSize: 2, levelCap: 32, basePayout: 50 },
  { id: 'scientist-orion', name: 'Scientist Orion', baseTier: 'normal', personality: { aggression: 0.4, caution: 0.6 }, teamSize: 3, levelCap: 33, basePayout: 55 },
  // Route: Thought Garden (between Mindweave & Frostfell)
  { id: 'psychup-lena', name: 'Psych Up Lena', baseTier: 'hard', personality: { aggression: 0.5, caution: 0.5 }, teamSize: 3, levelCap: 38, basePayout: 70 },
  { id: 'expert-micah', name: 'Expert Micah', baseTier: 'hard', personality: { aggression: 0.7, caution: 0.3 }, teamSize: 3, levelCap: 39, basePayout: 80 },
  // Route: Glacier Pass (between Frostfell & Drakemaw)
  { id: 'skier-juno', name: 'Skier Juno', baseTier: 'hard', personality: { aggression: 0.6, caution: 0.4 }, teamSize: 3, levelCap: 44, basePayout: 90 },
  { id: 'rival-ashen', name: 'Rival Ashen', baseTier: 'hard', personality: { aggression: 0.8, caution: 0.2 }, teamSize: 4, levelCap: 45, basePayout: 100 },
  // Route: Draconian Trail (between Drakemaw & Shadowmere)
  { id: 'dragonmaster-vei', name: 'Dragon Master Vei', baseTier: 'hard', personality: { aggression: 0.9, caution: 0.1 }, teamSize: 4, levelCap: 50, basePayout: 130 },
  { id: 'legend-trainer-sol', name: 'Legend Trainer Sol', baseTier: 'hard', personality: { aggression: 0.85, caution: 0.15 }, teamSize: 4, levelCap: 51, basePayout: 150 },
];

// ─── Encounter tables ───────────────────────────────────────────────────────

const ENC_VERDANT_TANGLE: EncounterTable = {
  morning: [
    { species: 'Treecko', minLevel: 10, maxLevel: 14, weight: 5 },
    { species: 'Lotad', minLevel: 10, maxLevel: 13, weight: 4 },
    { species: 'Shroomish', minLevel: 11, maxLevel: 14, weight: 3 },
  ],
  day: [
    { species: 'Treecko', minLevel: 11, maxLevel: 15, weight: 4 },
    { species: 'Hoppip', minLevel: 10, maxLevel: 14, weight: 4 },
    { species: 'Seedot', minLevel: 10, maxLevel: 13, weight: 4 },
  ],
  night: [
    { species: 'Shroomish', minLevel: 12, maxLevel: 15, weight: 5 },
    { species: 'Hoothoot', minLevel: 11, maxLevel: 14, weight: 5 },
  ],
};

const ENC_TIDAL_DRIFT: EncounterTable = {
  morning: [
    { species: 'Mudkip', minLevel: 15, maxLevel: 19, weight: 5 },
    { species: 'Barboach', minLevel: 14, maxLevel: 18, weight: 4 },
    { species: 'Luvdisc', minLevel: 14, maxLevel: 17, weight: 3 },
  ],
  day: [
    { species: 'Mudkip', minLevel: 16, maxLevel: 20, weight: 4 },
    { species: 'Corphish', minLevel: 15, maxLevel: 19, weight: 4 },
    { species: 'Magikarp', minLevel: 14, maxLevel: 18, weight: 4 },
  ],
  night: [
    { species: 'Barboach', minLevel: 16, maxLevel: 20, weight: 5 },
    { species: 'Surskit', minLevel: 15, maxLevel: 19, weight: 5 },
  ],
};

const ENC_SCORCHED_ASCENT: EncounterTable = {
  morning: [
    { species: 'Torchic', minLevel: 20, maxLevel: 24, weight: 5 },
    { species: 'Slugma', minLevel: 19, maxLevel: 23, weight: 4 },
    { species: 'Numel', minLevel: 19, maxLevel: 22, weight: 3 },
  ],
  day: [
    { species: 'Torchic', minLevel: 21, maxLevel: 25, weight: 4 },
    { species: 'Houndour', minLevel: 20, maxLevel: 24, weight: 4 },
    { species: 'Gulpin', minLevel: 20, maxLevel: 23, weight: 4 },
  ],
  night: [
    { species: 'Slugma', minLevel: 21, maxLevel: 25, weight: 5 },
    { species: 'Sableye', minLevel: 20, maxLevel: 24, weight: 5 },
  ],
};

const ENC_CIRCUIT_WAY: EncounterTable = {
  morning: [
    { species: 'Pikachu', minLevel: 26, maxLevel: 30, weight: 4 },
    { species: 'Mareep', minLevel: 25, maxLevel: 29, weight: 4 },
    { species: 'Plusle', minLevel: 26, maxLevel: 29, weight: 3 },
  ],
  day: [
    { species: 'Pikachu', minLevel: 27, maxLevel: 31, weight: 4 },
    { species: 'Magnemite', minLevel: 26, maxLevel: 30, weight: 4 },
    { species: 'Minun', minLevel: 26, maxLevel: 29, weight: 3 },
  ],
  night: [
    { species: 'Mareep', minLevel: 27, maxLevel: 31, weight: 5 },
    { species: 'Rotom', minLevel: 28, maxLevel: 31, weight: 5 },
  ],
};

const ENC_THOUGHT_GARDEN: EncounterTable = {
  morning: [
    { species: 'Ralts', minLevel: 32, maxLevel: 36, weight: 5 },
    { species: 'Espurr', minLevel: 32, maxLevel: 35, weight: 4 },
    { species: 'Flittle', minLevel: 31, maxLevel: 35, weight: 3 },
  ],
  day: [
    { species: 'Ralts', minLevel: 33, maxLevel: 37, weight: 4 },
    { species: 'Drowzee', minLevel: 32, maxLevel: 36, weight: 4 },
    { species: 'Hatenna', minLevel: 32, maxLevel: 35, weight: 4 },
  ],
  night: [
    { species: 'Espurr', minLevel: 33, maxLevel: 37, weight: 5 },
    { species: 'Duskull', minLevel: 33, maxLevel: 36, weight: 5 },
  ],
};

const ENC_GLACIER_PASS: EncounterTable = {
  morning: [
    { species: 'Swinub', minLevel: 38, maxLevel: 42, weight: 5 },
    { species: 'Snorunt', minLevel: 38, maxLevel: 41, weight: 4 },
    { species: 'Cubchoo', minLevel: 37, maxLevel: 41, weight: 3 },
  ],
  day: [
    { species: 'Swinub', minLevel: 39, maxLevel: 43, weight: 4 },
    { species: 'Glaceon', minLevel: 38, maxLevel: 42, weight: 3 },
    { species: 'Delibird', minLevel: 38, maxLevel: 41, weight: 4 },
  ],
  night: [
    { species: 'Snorunt', minLevel: 39, maxLevel: 43, weight: 5 },
    { species: 'Snover', minLevel: 38, maxLevel: 42, weight: 5 },
  ],
};

const ENC_DRACONIAN_TRAIL: EncounterTable = {
  morning: [
    { species: 'Gible', minLevel: 44, maxLevel: 48, weight: 5 },
    { species: 'Axew', minLevel: 44, maxLevel: 47, weight: 4 },
    { species: 'Noibat', minLevel: 43, maxLevel: 47, weight: 3 },
  ],
  day: [
    { species: 'Gible', minLevel: 45, maxLevel: 49, weight: 4 },
    { species: 'Duraludon', minLevel: 44, maxLevel: 48, weight: 3 },
    { species: 'Dratini', minLevel: 44, maxLevel: 47, weight: 4 },
  ],
  night: [
    { species: 'Axew', minLevel: 45, maxLevel: 49, weight: 5 },
    { species: 'Noctowl', minLevel: 44, maxLevel: 48, weight: 5 },
  ],
};

// ─── NPCs ───────────────────────────────────────────────────────────────────

const NPC_CERULEAN: NpcDef[] = [
  { id: 'maris-fan', name: 'Surfer Kid', lines: ['Maris rides the waves like nobody else. Even in battle!'] },
  { id: 'old-fisher', name: 'Old Fisher', lines: ['The tides here remember every trainer who passed through...'] },
];

const NPC_EMBER: NpcDef[] = [
  { id: 'ember-vendor', name: 'Festival Vendor', lines: ['Ignis puts on a show every evening. The flames tell stories!'] },
  { id: 'ash-watcher', name: 'Ash Watcher', lines: ['This peak has been burning since the last convergence cycle.'] },
];

const NPC_VOLTSPIRE: NpcDef[] = [
  { id: 'voltspire-tech', name: 'Grid Technician', lines: ['Zap rewired the whole city. Nothing short-circuits anymore.'] },
  { id: 'spark-urchin', name: 'Spark Urchin', lines: ['I want to be a tech-genius like Zap when I grow up!'] },
];

const NPC_MINDWEAVE: NpcDef[] = [
  { id: 'mindweave-sage', name: 'Garden Sage', lines: ['Sylas can see your next move before you make it. Stay calm...'] },
  { id: 'meditator', name: 'Meditator', lines: ['The flowers here bloom in patterns only the mind can trace.'], reputationGated: 'archivist' },
];

const NPC_FROSTFELL: NpcDef[] = [
  { id: 'frostfell-butler', name: 'House Butler', lines: ['Lady Glacia does not suffer fools. Or warmth.'] },
  { id: 'frost-scout', name: 'Ice Scout', lines: ['The glacier is cracking. Another cycle might be starting...'] },
];

const NPC_DRAKEMAW: NpcDef[] = [
  { id: 'drakemaw-vet', name: 'Scarred Veteran', lines: ['Vriska has seen more battles than any of us. She carries every scar.'] },
  { id: 'dragon-whisperer', name: 'Dragon Whisperer', lines: ['The dragons here remember the old world. They know what comes next.'], reputationGated: 'purist' },
];

const NPC_SHADOWMERE: NpcDef[] = [
  { id: 'shadowmere-sentinel', name: 'Night Sentinel', lines: ['Noctis watches from the darkness. If you see her, it is already too late.'] },
  { id: 'lost-soul', name: 'Lost Soul', lines: ['I walked this path in a previous cycle. Everything was the same... and different.'] },
];

// ─── Shops ──────────────────────────────────────────────────────────────────

const SHOP_CERULEAN: ShopDef = {
  id: 'cerulean-general', name: 'Cerulean General Store',
  stock: [
    { itemId: 'pokeball', badgeGate: 0 },
    { itemId: 'greatball', badgeGate: 1 },
    { itemId: 'potion', badgeGate: 0 },
    { itemId: 'superpotion', badgeGate: 1 },
    { itemId: 'antidote', badgeGate: 0 },
    { itemId: 'paralyzeheal', badgeGate: 0 },
  ],
};

const SHOP_EMBER: ShopDef = {
  id: 'ember-provisions', name: 'Ember Provisions',
  stock: [
    { itemId: 'pokeball', badgeGate: 0 },
    { itemId: 'greatball', badgeGate: 1 },
    { itemId: 'potion', badgeGate: 0 },
    { itemId: 'superpotion', badgeGate: 1 },
    { itemId: 'hyperpotion', badgeGate: 3 },
    { itemId: 'antidote', badgeGate: 0 },
    { itemId: 'fullheal', badgeGate: 2 },
  ],
};

const SHOP_VOLTSPIRE: ShopDef = {
  id: 'voltspire-outpost', name: 'Voltspire Outpost',
  stock: [
    { itemId: 'pokeball', badgeGate: 0 },
    { itemId: 'greatball', badgeGate: 1 },
    { itemId: 'ultraball', badgeGate: 4 },
    { itemId: 'potion', badgeGate: 0 },
    { itemId: 'superpotion', badgeGate: 1 },
    { itemId: 'hyperpotion', badgeGate: 3 },
    { itemId: 'revive', badgeGate: 3 },
    { itemId: 'fullheal', badgeGate: 2 },
  ],
};

const SHOP_MINDWEAVE: ShopDef = {
  id: 'mindweave-boutique', name: 'Mindweave Boutique',
  stock: [
    { itemId: 'greatball', badgeGate: 1 },
    { itemId: 'ultraball', badgeGate: 4 },
    { itemId: 'superpotion', badgeGate: 1 },
    { itemId: 'hyperpotion', badgeGate: 3 },
    { itemId: 'maxpotion', badgeGate: 5 },
    { itemId: 'revive', badgeGate: 3 },
    { itemId: 'fullheal', badgeGate: 2 },
    { itemId: 'ether', badgeGate: 4 },
  ],
};

const SHOP_FROSTFELL: ShopDef = {
  id: 'frostfell-emporium', name: 'Frostfell Emporium',
  stock: [
    { itemId: 'greatball', badgeGate: 1 },
    { itemId: 'ultraball', badgeGate: 4 },
    { itemId: 'hyperpotion', badgeGate: 3 },
    { itemId: 'maxpotion', badgeGate: 5 },
    { itemId: 'revive', badgeGate: 3 },
    { itemId: 'maxrevive', badgeGate: 6 },
    { itemId: 'fullheal', badgeGate: 2 },
    { itemId: 'ether', badgeGate: 4 },
    { itemId: 'maxether', badgeGate: 6 },
  ],
};

const SHOP_DRAKEMAW: ShopDef = {
  id: 'drakemaw-supplies', name: 'Drakemaw Supplies',
  stock: [
    { itemId: 'ultraball', badgeGate: 4 },
    { itemId: 'hyperpotion', badgeGate: 3 },
    { itemId: 'maxpotion', badgeGate: 5 },
    { itemId: 'revive', badgeGate: 3 },
    { itemId: 'maxrevive', badgeGate: 6 },
    { itemId: 'fullheal', badgeGate: 2 },
    { itemId: 'ether', badgeGate: 4 },
    { itemId: 'maxether', badgeGate: 6 },
  ],
};

const SHOP_SHADOWMERE: ShopDef = {
  id: 'shadowmere-trading', name: 'Shadowmere Trading Post',
  stock: [
    { itemId: 'ultraball', badgeGate: 4 },
    { itemId: 'maxpotion', badgeGate: 5 },
    { itemId: 'maxrevive', badgeGate: 6 },
    { itemId: 'fullheal', badgeGate: 2 },
    { itemId: 'maxether', badgeGate: 6 },
    { itemId: 'repel', badgeGate: 3 },
  ],
};

// ─── Locations ──────────────────────────────────────────────────────────────

const ALL_LOCATIONS: Location[] = [
  // Slice locations (with fixed encounters)
  ...sliceLocations(),

  // Route: Verdant Tangle — Verdant Hollow → Cerulean Deep
  {
    id: 'verdant-tangle', name: 'Verdant Tangle', kind: 'route', biome: 'johto-forests',
    connections: ['verdant-hollow', 'cerulean-deep'], isPokemonCenter: false, npcs: [],
    encounters: ENC_VERDANT_TANGLE,
  },

  // Gym 2: Cerulean Deep — Water
  {
    id: 'cerulean-deep', name: 'Cerulean Deep', kind: 'town', biome: 'hoenn-beaches',
    connections: ['verdant-tangle', 'tidal-drift'], isPokemonCenter: true,
    gymId: 'cerulean-gym', shopId: 'cerulean-general', npcs: NPC_CERULEAN,
  },

  // Route: Tidal Drift — Cerulean Deep → Ember Peak
  {
    id: 'tidal-drift', name: 'Tidal Drift', kind: 'route', biome: 'hoenn-beaches',
    connections: ['cerulean-deep', 'ember-peak'], isPokemonCenter: false, npcs: [],
    encounters: ENC_TIDAL_DRIFT,
  },

  // Gym 3: Ember Peak — Fire
  {
    id: 'ember-peak', name: 'Ember Peak', kind: 'town', biome: 'alola-islands',
    connections: ['tidal-drift', 'scorched-ascent'], isPokemonCenter: true,
    gymId: 'ember-gym', shopId: 'ember-provisions', npcs: NPC_EMBER,
  },

  // Route: Scorched Ascent — Ember Peak → Voltspire
  {
    id: 'scorched-ascent', name: 'Scorched Ascent', kind: 'route', biome: 'alola-islands',
    connections: ['ember-peak', 'voltspire'], isPokemonCenter: false, npcs: [],
    encounters: ENC_SCORCHED_ASCENT,
  },

  // Gym 4: Voltspire — Electric
  {
    id: 'voltspire', name: 'Voltspire', kind: 'town', biome: 'unova-urban',
    connections: ['scorched-ascent', 'circuit-way'], isPokemonCenter: true,
    gymId: 'voltspire-gym', shopId: 'voltspire-outpost', npcs: NPC_VOLTSPIRE,
  },

  // Route: Circuit Way — Voltspire → Mindweave
  {
    id: 'circuit-way', name: 'Circuit Way', kind: 'route', biome: 'unova-urban',
    connections: ['voltspire', 'mindweave'], isPokemonCenter: false, npcs: [],
    encounters: ENC_CIRCUIT_WAY,
  },

  // Gym 5: Mindweave — Psychic
  {
    id: 'mindweave', name: 'Mindweave', kind: 'town', biome: 'kalos-gardens',
    connections: ['circuit-way', 'thought-garden'], isPokemonCenter: true,
    gymId: 'mindweave-gym', shopId: 'mindweave-boutique', npcs: NPC_MINDWEAVE,
  },

  // Route: Thought Garden — Mindweave → Frostfell
  {
    id: 'thought-garden', name: 'Thought Garden', kind: 'route', biome: 'kalos-gardens',
    connections: ['mindweave', 'frostfell'], isPokemonCenter: false, npcs: [],
    encounters: ENC_THOUGHT_GARDEN,
  },

  // Gym 6: Frostfell — Ice
  {
    id: 'frostfell', name: 'Frostfell', kind: 'town', biome: 'sinnoh-tundra',
    connections: ['thought-garden', 'glacier-pass'], isPokemonCenter: true,
    gymId: 'frostfell-gym', shopId: 'frostfell-emporium', npcs: NPC_FROSTFELL,
  },

  // Route: Glacier Pass — Frostfell → Drakemaw
  {
    id: 'glacier-pass', name: 'Glacier Pass', kind: 'route', biome: 'sinnoh-tundra',
    connections: ['frostfell', 'drakemaw'], isPokemonCenter: false, npcs: [],
    encounters: ENC_GLACIER_PASS,
  },

  // Gym 7: Drakemaw — Dragon
  {
    id: 'drakemaw', name: 'Drakemaw', kind: 'town', biome: 'paldea-wilds',
    connections: ['glacier-pass', 'draconian-trail'], isPokemonCenter: true,
    gymId: 'drakemaw-gym', shopId: 'drakemaw-supplies', npcs: NPC_DRAKEMAW,
  },

  // Route: Draconian Trail — Drakemaw → Shadowmere
  {
    id: 'draconian-trail', name: 'Draconian Trail', kind: 'route', biome: 'paldea-wilds',
    connections: ['drakemaw', 'shadowmere'], isPokemonCenter: false, npcs: [],
    encounters: ENC_DRACONIAN_TRAIL,
  },

  // Gym 8: Shadowmere — Dark
  {
    id: 'shadowmere', name: 'Shadowmere', kind: 'town', biome: 'galar-countryside',
    connections: ['draconian-trail'], isPokemonCenter: true,
    gymId: 'shadowmere-gym', shopId: 'shadowmere-trading', npcs: NPC_SHADOWMERE,
  },
];

// ─── Aggregated exports ─────────────────────────────────────────────────────

export { ALL_LOCATIONS };

export const ALL_GYMS: GymDef[] = [
  VERDANT_GYM,
  CERULEAN_GYM,
  EMBER_GYM,
  VOLTSPIRE_GYM,
  MINDWEAVE_GYM,
  FROSTFELL_GYM,
  DRAKEMAW_GYM,
  SHADOWMERE_GYM,
];

export const ALL_TRAINERS: TrainerDef[] = [
  ...SLICE_TRAINERS,
  MARIS, IGNIS, ZAP, SYLAS, GLACIA, VRISKA, NOCTIS,
  ...ROUTE_TRAINERS,
];

export const ALL_SHOPS: ShopDef[] = [
  AETHEL_MART,
  SHOP_CERULEAN,
  SHOP_EMBER,
  SHOP_VOLTSPIRE,
  SHOP_MINDWEAVE,
  SHOP_FROSTFELL,
  SHOP_DRAKEMAW,
  SHOP_SHADOWMERE,
];
