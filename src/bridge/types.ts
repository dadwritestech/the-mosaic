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

export interface BattleOpts { formatid?: string; seed?: number[]; isWild?: boolean; }

export type Action =
  | { kind: 'move'; index: number }
  | { kind: 'switch'; index: number }
  | { kind: 'catch'; ball: BallType };

export interface MoveChoice { index: number; id: string; name: string; pp: number; maxpp: number; disabled: boolean; }
export interface SwitchChoice { index: number; species: string; hpPercent: number; fainted: boolean; }

export interface ActiveMon { species: string; hpPercent: number; status: string; }
export interface BattleState {
  isWild: boolean;
  turn: number;
  active: Record<Side, ActiveMon | null>;
  winner: Side | null | undefined; // undefined = ongoing
}

export type BattleEvent =
  | { type: 'move'; side: Side; move: string }
  | { type: 'damage'; side: Side; hpPercent: number }
  | { type: 'status'; side: Side; status: string }
  | { type: 'faint'; side: Side }
  | { type: 'switch'; side: Side; species: string; hpPercent: number }
  | { type: 'turn'; turn: number }
  | { type: 'win'; side: Side };

export interface TurnResult { events: BattleEvent[]; state: BattleState; }
export interface CatchResult { caught: boolean; shakes: number; }
