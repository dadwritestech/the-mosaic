export type Biome = 'kanto-plains' | 'johto-forests' | 'hoenn-beaches' | 'sinnoh-tundra'
  | 'unova-urban' | 'kalos-gardens' | 'alola-islands' | 'galar-countryside' | 'paldea-wilds';
export type TimeBucket = 'morning' | 'day' | 'night';

export interface EncounterEntry { species: string; minLevel: number; maxLevel: number; weight: number; }
export type EncounterTable = Partial<Record<TimeBucket, EncounterEntry[]>>;

export interface NpcDef { id: string; name: string; lines: string[]; reputationGated?: string; }

export interface TrainerDef {
  id: string; name: string;
  gymType?: string;
  baseTier: 'easy' | 'normal' | 'hard';
  personality: { aggression: number; caution: number };
  teamSize: number; levelCap: number;
  basePayout: number;
  dropTable?: { itemId: string; chance: number }[];
}

export interface GymDef { id: string; trainer: TrainerDef; badgeId: string; type: string; }

export interface Location {
  id: string; name: string; kind: 'town' | 'route'; biome: Biome;
  connections: string[];
  isPokemonCenter: boolean;
  npcs: NpcDef[];
  encounters?: EncounterTable;
  shopId?: string;
  gymId?: string;
}

/** A rift Warden — a boss trainer with a signature convergence tactic. */
export interface WardenDef extends TrainerDef {
  /** Tag the team-builder / AI reads to shape this Warden's strategy. */
  signatureTactic: string;
}

/** A convergence rift: a seam where two worlds bleed together. Replaces GymDef. */
export interface RiftDef {
  id: string;
  name: string;
  biomeA: Biome;            // sealing may collapse the seam to this region...
  biomeB: Biome;            // ...or this one, depending on the team's gen lean
  levelBand: { min: number; max: number };
  warden: WardenDef;
  /** Seam mix — used while unsealed, and at raised level/rarity while attuned. */
  fusedEncounters: EncounterTable;
  /** Pure-region table if the seal collapses to biomeA. */
  pureEncountersA: EncounterTable;
  /** Pure-region table if the seal collapses to biomeB. */
  pureEncountersB: EncounterTable;
}
