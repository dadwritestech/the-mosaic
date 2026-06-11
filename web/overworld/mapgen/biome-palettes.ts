import type { Biome } from '../../../src/content/types';

/** A biome's tile vocabulary. All IDs are raw RMXP regular tile IDs (>=384). */
export interface BiomePalette {
  groundTile: number;     // layer-0 base fill
  pathTile: number;       // layer-0 walkable corridor
  featureTiles: number[]; // layer-1 blocking obstacles (trees / rocks)
  accentTiles: number[];  // layer-1 non-blocking decals (flowers); may be empty
}

// Tile IDs harvested from converted Essentials Outside maps (cerulean-deep / aethels-rest).
// plains/forest/beach/gardens/city authentic; volcano(alola)/tundra(sinnoh) approximated.
export const BIOME_PALETTES: Record<Biome, BiomePalette> = {
  'kanto-plains':      { groundTile: 385, pathTile: 801, featureTiles: [1681, 1682], accentTiles: [262] },
  'johto-forests':     { groundTile: 401, pathTile: 801, featureTiles: [1681, 1960], accentTiles: [] },
  'hoenn-beaches':     { groundTile: 546, pathTile: 801, featureTiles: [1664],       accentTiles: [] },
  'sinnoh-tundra':     { groundTile: 386, pathTile: 801, featureTiles: [1664],       accentTiles: [] }, // approx snow
  'unova-urban':       { groundTile: 800, pathTile: 808, featureTiles: [1664],       accentTiles: [] },
  'kalos-gardens':     { groundTile: 385, pathTile: 801, featureTiles: [1681],       accentTiles: [262] },
  'alola-islands':     { groundTile: 808, pathTile: 801, featureTiles: [1664],       accentTiles: [] }, // approx volcano
  'galar-countryside': { groundTile: 401, pathTile: 801, featureTiles: [1681],       accentTiles: [] }, // not used by rifts; type completeness
  'paldea-wilds':      { groundTile: 401, pathTile: 808, featureTiles: [1681],       accentTiles: [] },
};
