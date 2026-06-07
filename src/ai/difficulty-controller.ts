import type { Knobs } from './types';

export type BaseTier = 'easy' | 'normal' | 'hard';

export interface DifficultyInputs {
  baseTier: BaseTier;
  advancedToggle: boolean;
  autoScale: number;       // -1..+1 smoothed: + = player dominating, - = player struggling
  reputationRamp: number;  // 0..1 how much the world has "learned" the player
}

export interface DifficultySettings extends Knobs {
  predictionWeight: number;     // how much the brain acts on the player model (gated)
  counterDraftStrength: number; // how hard the composer tailors a team vs the player
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

const TIER_BASE: Record<BaseTier, Knobs> = {
  easy:   { randomness: 0.80, lookaheadDepth: 0, switchSmarts: 0.10 },
  normal: { randomness: 0.30, lookaheadDepth: 0, switchSmarts: 0.60 },
  hard:   { randomness: 0.05, lookaheadDepth: 1, switchSmarts: 1.00 },
};

export function computeSettings(inp: DifficultyInputs): DifficultySettings {
  const base = TIER_BASE[inp.baseTier];

  let randomness = base.randomness;
  if (inp.advancedToggle) randomness -= 0.20;          // sharper floor for skilled players
  randomness -= inp.autoScale * 0.15;                  // crank up when player is winning hard
  randomness = clamp01(randomness);

  const lookaheadDepth: 0 | 1 = (base.lookaheadDepth === 1 || inp.advancedToggle) ? 1 : 0;

  let switchSmarts = base.switchSmarts;
  if (inp.advancedToggle) switchSmarts += 0.20;
  switchSmarts += Math.max(0, inp.autoScale) * 0.10;
  switchSmarts = clamp01(switchSmarts);

  // Prediction + counter-draft are GATED by reputation: ~0 until earned.
  const tierPredCap = inp.baseTier === 'easy' ? 0.3 : 1;
  const predictionWeight = clamp01(inp.reputationRamp * tierPredCap);
  const counterDraftStrength = clamp01(inp.reputationRamp * (inp.advancedToggle ? 1 : 0.8));

  return { randomness, lookaheadDepth, switchSmarts, predictionWeight, counterDraftStrength };
}
