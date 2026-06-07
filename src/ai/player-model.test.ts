import { describe, it, expect } from 'vitest';
import { createPlayerModel, updateTendency, isActionable, TENDENCY_NAMES } from './player-model';

describe('player model primitives', () => {
  it('creates a neutral model with all tendencies at value 0.5, confidence 0', () => {
    const m = createPlayerModel();
    for (const name of TENDENCY_NAMES) {
      expect(m.tendencies[name].value).toBeCloseTo(0.5);
      expect(m.tendencies[name].confidence).toBe(0);
    }
    expect(m.battlesObserved).toBe(0);
  });

  it('one update moves value only slightly (gradual) and confidence stays low', () => {
    const t = updateTendency({ value: 0.5, confidence: 0 }, 1.0, 0.15);
    expect(t.value).toBeCloseTo(0.575, 3); // 0.5 + 0.15*(1-0.5)
    expect(t.confidence).toBeLessThan(0.5);
  });

  it('repeated updates converge value toward the observed and raise confidence past threshold', () => {
    let t = { value: 0.5, confidence: 0 };
    for (let i = 0; i < 10; i++) t = updateTendency(t, 1.0, 0.15);
    expect(t.value).toBeGreaterThan(0.8);
    expect(t.confidence).toBeGreaterThan(0.5);
  });

  it('isActionable requires BOTH confidence>=threshold AND reputationRamp>0', () => {
    const high = { value: 0.9, confidence: 0.8 };
    expect(isActionable(high, 1.0)).toBe(true);
    expect(isActionable(high, 0)).toBe(false);          // no reputation yet
    expect(isActionable({ value: 0.9, confidence: 0.2 }, 1.0)).toBe(false); // not confident
  });
});
