import { describe, it, expect } from 'vitest';
import { carvePath } from './path';
import { computeSeam, sideAt } from './seam';
import { DEFAULT_KNOBS } from './types';

const key = (x: number, y: number, w: number) => y * w + x;

describe('carvePath', () => {
  it('places entry on the bottom edge and exit on the top edge', () => {
    const k = { ...DEFAULT_KNOBS };
    const p = carvePath(42, k);
    expect(p.entry.y).toBe(k.height - 1);
    expect(p.exit.y).toBe(0);
    expect(p.cells.has(key(p.entry.x, p.entry.y, k.width))).toBe(true);
    expect(p.cells.has(key(p.exit.x, p.exit.y, k.width))).toBe(true);
  });

  it('forms a vertically continuous corridor (one path cell per row)', () => {
    const k = { ...DEFAULT_KNOBS };
    const p = carvePath(42, k);
    for (let y = 0; y < k.height; y++) {
      let count = 0;
      for (let x = 0; x < k.width; x++) if (p.cells.has(key(x, y, k.width))) count++;
      expect(count).toBeGreaterThan(0);
    }
  });

  it('crosses the seam at least once', () => {
    const k = { ...DEFAULT_KNOBS };
    const seam = computeSeam(42, k);
    const p = carvePath(42, k);
    const sides = new Set<string>();
    for (let y = 0; y < k.height; y++) {
      for (let x = 0; x < k.width; x++) {
        if (p.cells.has(key(x, y, k.width))) sides.add(sideAt(seam, x, y));
      }
    }
    expect(sides.size).toBe(2); // path visits both A and B
  });

  it('puts the Warden on a path cell', () => {
    const k = { ...DEFAULT_KNOBS };
    const p = carvePath(42, k);
    expect(p.cells.has(key(p.warden.x, p.warden.y, k.width))).toBe(true);
  });

  it('is deterministic for a fixed seed', () => {
    const a = carvePath(42, { ...DEFAULT_KNOBS });
    const b = carvePath(42, { ...DEFAULT_KNOBS });
    expect([...a.cells].sort()).toEqual([...b.cells].sort());
    expect(a.warden).toEqual(b.warden);
  });
});
