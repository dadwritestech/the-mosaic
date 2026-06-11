import { makeRng } from '../../../src/ai/rng';
import type { GenKnobs } from './types';

/**
 * Boundary x-column per row. A cell (x,y) is on side A when x < seam[y], else side B.
 * Vertical: wanders around the centre. Diagonal: drifts left-margin -> right-margin top to bottom.
 */
export function computeSeam(seed: number, knobs: GenKnobs): number[] {
  const { width, height, orientation, jaggedness } = knobs;
  const rng = makeRng((seed ^ 0x5ea3) >>> 0);
  const margin = Math.max(3, Math.floor(width * 0.2));
  const amp = 1 + Math.round(jaggedness * 3); // max jagged step per row
  const driftPerRow = orientation === 'diagonal'
    ? (width - 2 * margin) / Math.max(1, height - 1)
    : 0;
  const seam: number[] = [];
  for (let y = 0; y < height; y++) {
    const base = orientation === 'diagonal' ? margin + driftPerRow * y : width / 2;
    const step = Math.round((rng() * 2 - 1) * amp);
    const col = Math.max(margin, Math.min(width - margin, Math.round(base) + step));
    seam.push(col);
  }
  return seam;
}

export function sideAt(seam: number[], x: number, y: number): 'A' | 'B' {
  return x < seam[y] ? 'A' : 'B';
}
