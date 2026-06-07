import type { PokemonSet } from '../bridge/types';

export interface ActiveView {
  set: PokemonSet;
  hpPercent: number;          // 0..100
  status: string;             // '', 'brn', 'par', 'slp', 'psn', 'tox', 'frz'
  boosts?: Partial<Record<'atk' | 'def' | 'spa' | 'spd' | 'spe', number>>;
}

export interface MoveOption { index: number; id: string; name: string; }
export interface SwitchOption { index: number; }

export interface BattleView {
  self: ActiveView;           // the AI's active mon
  selfBench: ActiveView[];    // the AI's non-active, non-fainted mons (in switch order)
  opponent: ActiveView;       // the player's active mon (omniscient PvE)
  moves: MoveOption[];        // legal moves this turn (from the Bridge)
  switchIndices?: number[];   // legal switch slot indices (1-based), optional
}

export interface Knobs {
  randomness: number;         // 0..1, P(pick a random legal action instead of best)
  lookaheadDepth: 0 | 1;      // 1 = subtract self-risk from opponent's best retaliation
  switchSmarts: number;       // 0..1, willingness/quality of switching
}

export interface Personality {
  aggression: number;         // 0..1, weights raw damage / KO
  caution: number;            // 0..1, weights self-preservation / switching
}

export interface BrainContext {
  gen: number;                // generation for @smogon/calc (e.g. 9)
  knobs: Knobs;
  personality: Personality;
  rng: () => number;          // injected for deterministic randomness
}
