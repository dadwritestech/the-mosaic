import { makeRng } from '../../../src/ai/rng';
import type { GenKnobs } from './types';

export interface PathResult {
  cells: Set<number>;                 // key = y * width + x
  entry: { x: number; y: number };    // bottom edge (also spawn)
  exit: { x: number; y: number };     // top edge
  warden: { x: number; y: number };   // on the spur
}

const key = (x: number, y: number, w: number) => y * w + x;

/**
 * Carve a guaranteed-walkable corridor from the bottom edge (entry) to the top edge (exit),
 * wandering ±1 column per row so it crosses the centred seam, then a horizontal spur to the Warden.
 */
export function carvePath(seed: number, knobs: GenKnobs): PathResult {
  const { width, height } = knobs;
  const rng = makeRng((seed ^ 0x9a71) >>> 0);
  const cells = new Set<number>();
  const pathX: number[] = new Array(height);

  let x = Math.floor(width / 2);
  const entry = { x, y: height - 1 };
  for (let y = height - 1; y >= 0; y--) {
    pathX[y] = x;
    cells.add(key(x, y, width));
    if (x + 1 < width) cells.add(key(x + 1, y, width)); // widen by 1 so diagonals stay connected
    if (y > 0) {
      const step = Math.floor(rng() * 3) - 1; // -1, 0, +1
      x = Math.max(1, Math.min(width - 2, x + step));
    }
  }
  const exit = { x: pathX[0], y: 0 };

  // Warden spur: from the corridor at mid-height, run horizontally a few tiles to a clearing.
  const spurY = Math.floor(height / 2);
  const spurX = pathX[spurY];
  const wardenX = spurX < width / 2 ? Math.min(width - 2, spurX + 4) : Math.max(1, spurX - 4);
  const lo = Math.min(spurX, wardenX);
  const hi = Math.max(spurX, wardenX);
  for (let xx = lo; xx <= hi; xx++) cells.add(key(xx, spurY, width));

  return { cells, entry, exit, warden: { x: wardenX, y: spurY } };
}
