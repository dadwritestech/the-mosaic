import { describe, it, expect } from 'vitest';
import { generateRiftMap } from './generate';
import { DEFAULT_KNOBS } from './types';
import { ALL_RIFTS } from '../../../src/content/rifts';
import type { MapV2 } from '../maps/mapv2';

function reachable(m: MapV2, tx: number, ty: number): boolean {
  const seen = new Set<number>();
  const stack = [[m.spawn.x, m.spawn.y]];
  const k = (x: number, y: number) => y * m.width + x;
  while (stack.length) {
    const [x, y] = stack.pop()!;
    if (x < 0 || y < 0 || x >= m.width || y >= m.height) continue;
    if (!m.passages[y][x]) continue;
    if (seen.has(k(x, y))) continue;
    seen.add(k(x, y));
    if (x === tx && y === ty) return true;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return false;
}

describe('all rifts generate winnable maps', () => {
  for (const rift of ALL_RIFTS) {
    it(`${rift.id}: seam map is walkable spawn->exit with warden + encounters`, () => {
      const m = generateRiftMap(rift, rift.id.length * 13 + 1, DEFAULT_KNOBS);
      const exit = m.warps.find((w) => w.y === 0)!;
      expect(reachable(m, exit.x, exit.y)).toBe(true);
      const warden = m.triggers.find((t) => t.kind === 'warden')!;
      expect(reachable(m, warden.x, warden.y)).toBe(true);
      expect(warden.ref).toBe(rift.warden.id);
      let grass = 0;
      for (const row of m.encounters) for (const c of row) if (c) grass++;
      expect(grass).toBeGreaterThan(0);
    });

    it(`${rift.id}: both sealed variants are walkable spawn->exit`, () => {
      for (const biome of [rift.biomeA, rift.biomeB]) {
        const m = generateRiftMap(rift, 3, { ...DEFAULT_KNOBS, forcedBiome: biome });
        const exit = m.warps.find((w) => w.y === 0)!;
        expect(reachable(m, exit.x, exit.y)).toBe(true);
      }
    });
  }
});
