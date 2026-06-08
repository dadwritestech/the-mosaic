export type Side = 'p1' | 'p2';
export type BallType = 'poke' | 'great' | 'ultra' | 'master';

export interface PokemonSet {
  name: string; species: string; ability: string; item: string;
  moves: string[]; nature: string;
  evs: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  ivs: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  level: number; gender?: string;
}
export type TeamSpec = PokemonSet[];

export interface MonCondition { hpPercent: number; status: string; }
export interface MonReadout { species: string; hpPercent: number; status: string; fainted: boolean; }
export interface BattleOpts { formatid?: string; seed?: number[]; isWild?: boolean; initialConditions?: { p1?: MonCondition[]; p2?: MonCondition[] }; }

export type Action =
  | { kind: 'move'; index: number }
  | { kind: 'switch'; index: number }
  | { kind: 'catch'; ball: BallType };

export interface MoveChoice { index: number; id: string; name: string; pp: number; maxpp: number; disabled: boolean; }
export interface SwitchChoice { index: number; species: string; hpPercent: number; fainted: boolean; }

export interface ActiveMon {
  species: string; hpPercent: number; status: string;
  boosts?: Record<string, number>; // stat -> stage (e.g. { atk: 2, spe: -1 })
  volatiles?: string[];            // e.g. ['confusion']
}
export interface BattleState {
  isWild: boolean;
  turn: number;
  active: Record<Side, ActiveMon | null>;
  winner: Side | null | undefined; // undefined = ongoing
  weather?: string;                // '' = clear
  terrain?: string;                // '' = none
}

export type BattleEvent =
  | { type: 'move'; side: Side; move: string }
  | { type: 'damage'; side: Side; hpPercent: number; cause?: string; source?: string }
  | { type: 'heal'; side: Side; hpPercent: number }
  | { type: 'status'; side: Side; status: string; cause?: string; source?: string }
  | { type: 'cure'; side: Side; status: string }
  | { type: 'boost'; side: Side; stat: string; amount: number; cause?: string; source?: string } // signed
  | { type: 'weather'; weather: string }                         // '' = cleared
  | { type: 'field'; effect: string; start: boolean }            // terrain/hazards
  | { type: 'volatile'; side: Side; effect: string; start: boolean }
  | { type: 'item'; side: Side; item: string; ended: boolean }
  | { type: 'ability'; side: Side; ability: string }
  | { type: 'cant'; side: Side; reason: string }              // couldn't move (par/slp/frz/flinch)
  | { type: 'immune'; side: Side }                             // no effect (e.g. Normal vs Ghost)
  | { type: 'miss'; side: Side }
  | { type: 'effectiveness'; side: Side; kind: 'super' | 'resist' }
  | { type: 'crit'; side: Side }
  | { type: 'fail'; side: Side }
  | { type: 'faint'; side: Side }
  | { type: 'switch'; side: Side; species: string; hpPercent: number }
  | { type: 'turn'; turn: number }
  | { type: 'win'; side: Side };

export interface TurnResult { events: BattleEvent[]; state: BattleState; }
export interface CatchResult { caught: boolean; shakes: number; }
