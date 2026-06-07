export const TENDENCY_NAMES = [
  'aggression', 'switchiness', 'typeReliance', 'statusUsage',
  'sacrificeWillingness', 'leadPattern', 'rosterStability',
] as const;
export type TendencyName = typeof TENDENCY_NAMES[number];

export interface Tendency { value: number; confidence: number; }

export interface CharacterMemory {
  encounters: number;
  lastOutcome: 'win' | 'loss' | null; // from the player's perspective
  lastTeam: string[];
}

export interface PlayerModel {
  tendencies: Record<TendencyName, Tendency>;
  battlesObserved: number;
  reputation: { level: string; score: number; notableTraits: string[] };
  characters: Record<string, CharacterMemory>;
  /** internal cross-battle state */
  _leadCounts: Record<string, number>;
  _lastTeam: string[] | null;
}

export function createPlayerModel(): PlayerModel {
  const tendencies = {} as Record<TendencyName, Tendency>;
  for (const name of TENDENCY_NAMES) tendencies[name] = { value: 0.5, confidence: 0 };
  return {
    tendencies,
    battlesObserved: 0,
    reputation: { level: 'Unknown', score: 0, notableTraits: [] },
    characters: {},
    _leadCounts: {},
    _lastTeam: null,
  };
}

/** Gradual update: value eases toward `observed`; confidence saturates toward 1. */
export function updateTendency(t: Tendency, observed: number, learnRate: number): Tendency {
  const value = t.value + learnRate * (observed - t.value);
  const confidence = Math.min(1, t.confidence + (1 - t.confidence) * 0.12);
  return { value, confidence };
}

/** The brain/composer may ACT on a tendency only when confident AND reputation permits. */
export function isActionable(t: Tendency, reputationRamp: number, threshold = 0.5): boolean {
  return t.confidence >= threshold && reputationRamp > 0;
}
