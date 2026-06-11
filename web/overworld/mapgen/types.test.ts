import { describe, it, expect } from 'vitest';
import { DEFAULT_KNOBS } from './types';

describe('GenKnobs defaults', () => {
  it('has sane dimensions and 0..1 density knobs', () => {
    expect(DEFAULT_KNOBS.width).toBeGreaterThanOrEqual(28);
    expect(DEFAULT_KNOBS.height).toBeGreaterThanOrEqual(24);
    expect(DEFAULT_KNOBS.featureDensity).toBeGreaterThan(0);
    expect(DEFAULT_KNOBS.featureDensity).toBeLessThan(1);
    expect(DEFAULT_KNOBS.grassDensity).toBeGreaterThan(0);
    expect(['vertical', 'diagonal']).toContain(DEFAULT_KNOBS.orientation);
  });
});
