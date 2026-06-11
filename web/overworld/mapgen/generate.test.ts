import { describe, it, expect } from 'vitest';
import { generateRiftMap } from './generate';
import { DEFAULT_KNOBS } from './types';
import { getRift } from '../../../src/content/rifts';
import { BIOME_PALETTES } from './biome-palettes';
import type { MapV2 } from '../maps/mapv2';

const rift = getRift('thornmarsh')!;

/** Flood-fill over passages; returns true if (tx,ty) is reachable from spawn. */
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

describe('generateRiftMap', () => {
  it('emits a well-formed MapV2 of the requested size', () => {
    const m = generateRiftMap(rift, 1, DEFAULT_KNOBS);
    expect(m.width).toBe(DEFAULT_KNOBS.width);
    expect(m.height).toBe(DEFAULT_KNOBS.height);
    expect(m.layers.length).toBe(3);
    expect(m.layers[0].length).toBe(m.height);
    expect(m.layers[0][0].length).toBe(m.width);
    expect(m.tileset).toBe('Outside');
  });

  it('exit is reachable from spawn over passages', () => {
    const m = generateRiftMap(rift, 1, DEFAULT_KNOBS);
    const exit = m.warps.find((w) => w.y === 0)!;
    expect(reachable(m, exit.x, exit.y)).toBe(true);
  });

  it('places two warps, a warden trigger, and a walkable spawn', () => {
    const m = generateRiftMap(rift, 1, DEFAULT_KNOBS);
    expect(m.warps.length).toBe(2);
    const warden = m.triggers.find((t) => t.kind === 'warden')!;
    expect(warden.ref).toBe(rift.warden.id);
    expect(m.passages[m.spawn.y][m.spawn.x]).toBe(true);
    expect(m.passages[warden.y][warden.x]).toBe(true);
    for (const w of m.warps) expect(m.passages[w.y][w.x]).toBe(true);
  });

  it('has a non-empty encounter grid', () => {
    const m = generateRiftMap(rift, 1, DEFAULT_KNOBS);
    let count = 0;
    for (const row of m.encounters) for (const c of row) if (c) count++;
    expect(count).toBeGreaterThan(0);
  });

  it('a seam map uses both biome ground tiles', () => {
    const m = generateRiftMap(rift, 1, DEFAULT_KNOBS);
    const grounds = new Set<number>();
    for (const row of m.layers[0]) for (const v of row) grounds.add(v);
    expect(grounds.has(BIOME_PALETTES[rift.biomeA].groundTile)).toBe(true);
    expect(grounds.has(BIOME_PALETTES[rift.biomeB].groundTile)).toBe(true);
  });

  it('forcedBiome collapses both sides to one ground tile (sealed variant)', () => {
    const m = generateRiftMap(rift, 1, { ...DEFAULT_KNOBS, forcedBiome: rift.biomeA });
    const grounds = new Set<number>();
    for (const row of m.layers[0]) for (const v of row) grounds.add(v);
    expect(grounds.has(BIOME_PALETTES[rift.biomeB].groundTile)).toBe(false);
  });

  it('is deterministic for a fixed (seed, knobs)', () => {
    const a = generateRiftMap(rift, 77, DEFAULT_KNOBS);
    const b = generateRiftMap(rift, 77, DEFAULT_KNOBS);
    expect(a).toEqual(b);
  });
});
