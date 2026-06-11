import { describe, it, expect } from 'vitest';
import { BIOME_PALETTES } from './biome-palettes';
import { ALL_RIFTS } from '../../../src/content/rifts';
import type { Biome } from '../../../src/content/types';

const BIOMES: Biome[] = [
  'kanto-plains', 'johto-forests', 'hoenn-beaches', 'sinnoh-tundra',
  'unova-urban', 'kalos-gardens', 'alola-islands', 'galar-countryside', 'paldea-wilds',
];

describe('BIOME_PALETTES', () => {
  it('defines a palette for every biome with regular tile IDs (>=384)', () => {
    for (const b of BIOMES) {
      const p = BIOME_PALETTES[b];
      expect(p).toBeTruthy();
      expect(p.groundTile).toBeGreaterThanOrEqual(384);
      expect(p.pathTile).toBeGreaterThanOrEqual(384);
      expect(p.featureTiles.length).toBeGreaterThan(0);
      expect(p.featureTiles.every((t) => t >= 384)).toBe(true);
    }
  });

  it('every rift pair has two distinct ground tiles so the seam reads', () => {
    for (const r of ALL_RIFTS) {
      expect(BIOME_PALETTES[r.biomeA].groundTile).not.toBe(BIOME_PALETTES[r.biomeB].groundTile);
    }
  });

  it('path tile differs from ground tile within each palette', () => {
    for (const b of BIOMES) {
      expect(BIOME_PALETTES[b].pathTile).not.toBe(BIOME_PALETTES[b].groundTile);
    }
  });
});
