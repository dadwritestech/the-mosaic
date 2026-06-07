export interface Stats6 { hp: number; atk: number; def: number; spa: number; spd: number; spe: number; }

export interface OwnedMove { id: string; pp: number; ppUps: number; }

export interface OwnedPokemon {
  uid: string; species: string; nickname?: string;
  level: number; exp: number;
  ivs: Stats6; evs: Stats6; nature: string;
  ability: string; abilitySlot: '0' | '1' | 'H' | 'S';
  gender?: 'M' | 'F' | 'N'; shiny: boolean;
  moves: OwnedMove[];
  heldItem?: string;
  currentHp: number; status: string;
  friendship: number; pokerus: 'none' | 'infected' | 'cured';
  caughtInfo: { ball: string; location: string; metLevel: number; day: number; originalTrainer: string };
}

export interface GameSettings { difficultyMode: 'normal' | 'hard' | 'hardest'; nuzlocke: boolean; }
export interface Box { name: string; slots: (OwnedPokemon | null)[]; }

export interface GameState {
  schemaVersion: number;
  settings: GameSettings;
  party: OwnedPokemon[];
  boxes: Box[];
  bag: Record<string, Record<string, number>>;
  money: number;
  badges: string[];
  pokedex: { seen: Set<number>; caught: Set<number> };
  location: { mapId: string; x: number; y: number; atPokemonCenter: boolean };
  flags: Record<string, unknown>;
  graveyard: OwnedPokemon[];
  time: { day: number; minutes: number };
}
