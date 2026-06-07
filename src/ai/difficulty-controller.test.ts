import { describe, it, expect } from 'vitest';
import { computeSettings } from './difficulty-controller';

describe('difficulty controller', () => {
  it('Easy is noisy, Hard is crisp', () => {
    const easy = computeSettings({ baseTier: 'easy', advancedToggle: false, autoScale: 0, reputationRamp: 0 });
    const hard = computeSettings({ baseTier: 'hard', advancedToggle: false, autoScale: 0, reputationRamp: 0 });
    expect(easy.randomness).toBeGreaterThan(hard.randomness);
    expect(hard.lookaheadDepth).toBe(1);
    expect(easy.lookaheadDepth).toBe(0);
  });

  it('advanced toggle sharpens play (less randomness, enables lookahead)', () => {
    const base = computeSettings({ baseTier: 'normal', advancedToggle: false, autoScale: 0, reputationRamp: 0 });
    const adv = computeSettings({ baseTier: 'normal', advancedToggle: true, autoScale: 0, reputationRamp: 0 });
    expect(adv.randomness).toBeLessThan(base.randomness);
    expect(adv.lookaheadDepth).toBe(1);
  });

  it('auto-scale tightens the AI when the player is crushing it', () => {
    const calm = computeSettings({ baseTier: 'normal', advancedToggle: false, autoScale: 0, reputationRamp: 0 });
    const pressured = computeSettings({ baseTier: 'normal', advancedToggle: false, autoScale: 1, reputationRamp: 0 });
    expect(pressured.randomness).toBeLessThan(calm.randomness);
  });

  it('IMMERSION GUARDRAIL: prediction stays ~0 until reputation is earned', () => {
    const unknown = computeSettings({ baseTier: 'hard', advancedToggle: true, autoScale: 0, reputationRamp: 0 });
    const renowned = computeSettings({ baseTier: 'hard', advancedToggle: true, autoScale: 0, reputationRamp: 1 });
    expect(unknown.predictionWeight).toBe(0);
    expect(renowned.predictionWeight).toBeGreaterThan(0.5);
    expect(unknown.counterDraftStrength).toBe(0);
  });
});
