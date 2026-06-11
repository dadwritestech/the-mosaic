import { describe, it, expect } from 'vitest';
import { computeSeam, sideAt } from './seam';
import { DEFAULT_KNOBS } from './types';

describe('computeSeam', () => {
  it('returns one boundary column per row, inside the margins', () => {
    const k = { ...DEFAULT_KNOBS, width: 32, height: 28 };
    const seam = computeSeam(123, k);
    expect(seam.length).toBe(28);
    const margin = Math.max(3, Math.floor(32 * 0.2)); // 6
    for (const c of seam) {
      expect(c).toBeGreaterThanOrEqual(margin);
      expect(c).toBeLessThanOrEqual(32 - margin);
    }
  });

  it('keeps both sides non-empty in every row', () => {
    const k = { ...DEFAULT_KNOBS, width: 32, height: 28 };
    const seam = computeSeam(7, k);
    for (let y = 0; y < k.height; y++) {
      expect(sideAt(seam, 0, y)).toBe('A');
      expect(sideAt(seam, k.width - 1, y)).toBe('B');
    }
  });

  it('is deterministic for a fixed seed', () => {
    const k = { ...DEFAULT_KNOBS };
    expect(computeSeam(999, k)).toEqual(computeSeam(999, k));
  });

  it('diagonal orientation drifts the seam across the map', () => {
    const k = { ...DEFAULT_KNOBS, orientation: 'diagonal' as const, jaggedness: 0 };
    const seam = computeSeam(5, k);
    expect(seam[seam.length - 1]).toBeGreaterThan(seam[0]); // trends rightward
  });
});
