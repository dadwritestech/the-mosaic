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
