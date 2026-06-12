import type { Biome } from '../../../src/content/types';

/** A biome's tile vocabulary. All IDs are raw RMXP regular tile IDs (>=384). */
export interface BiomePalette {
  groundTile: number;     // layer-0 base fill
  pathTile: number;       // layer-0 walkable corridor
  featureTiles: number[]; // layer-1 blocking obstacles (trees / rocks)
  accentTiles: number[];  // layer-1 non-blocking decals (flowers); may be empty
}

// Tile IDs eyeball-verified against the Outside.png tile reference sheet (tilesheet.html):
//   385 plain grass · 433 mint grass · 480 sand · 624/632 cave-dirt · 664 snow
//   481 sand trail · 388 grass-edge · 858/907 self-contained bush · 1033 rock mound · 262 flowers (autotile)
// Single-cell self-contained features only (a whole bush/rock per cell) so scatter never shows fragments.
// plains/forest/beach/gardens authentic; volcano(alola)/tundra(sinnoh)/urban(unova) approximated.
export const BIOME_PALETTES: Record<Biome, BiomePalette> = {
  'kanto-plains':      { groundTile: 385, pathTile: 481, featureTiles: [858],       accentTiles: [262] },
  'johto-forests':     { groundTile: 433, pathTile: 481, featureTiles: [858],       accentTiles: [] },
  'hoenn-beaches':     { groundTile: 480, pathTile: 388, featureTiles: [1033],      accentTiles: [] },
  'sinnoh-tundra':     { groundTile: 664, pathTile: 385, featureTiles: [1033],      accentTiles: [] }, // approx snow
  'unova-urban':       { groundTile: 624, pathTile: 385, featureTiles: [1033],      accentTiles: [] }, // approx pavement
  'kalos-gardens':     { groundTile: 385, pathTile: 481, featureTiles: [858],       accentTiles: [262] },
  'alola-islands':     { groundTile: 632, pathTile: 481, featureTiles: [1033],      accentTiles: [] }, // approx volcano
  'galar-countryside': { groundTile: 433, pathTile: 481, featureTiles: [858],       accentTiles: [] }, // not used by rifts; type completeness
  'paldea-wilds':      { groundTile: 433, pathTile: 481, featureTiles: [858],       accentTiles: [] },
};
