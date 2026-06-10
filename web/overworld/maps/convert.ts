import type { RpgMap, RpgTileset } from './rmxp';
import type { MapV2 } from './mapv2';

export interface ConvertOpts {
  id: string;
  spawn: { x: number; y: number };
  grassTerrainTag?: number;
}

export function convertMap(map: RpgMap, ts: RpgTileset, opts: ConvertOpts): MapV2 {
  const { width: w, height: h } = map;
  const grassTag = opts.grassTerrainTag ?? 1;
  const layers: number[][][] = [0, 1, 2].map((z) =>
    Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => map.data.at(x, y, z))));
  const top = (x: number, y: number) => layers[2][y][x] || layers[1][y][x] || layers[0][y][x];
  const passages = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => ts.passable(top(x, y))));
  const priorities = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => ts.priority(top(x, y))));
  const encounters = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => ts.terrainTag(top(x, y)) === grassTag));
  return {
    id: opts.id, width: w, height: h,
    tileset: ts.tilesetName, autotiles: ts.autotileNames,
    layers, passages, priorities, encounters,
    warps: [], triggers: [],
    spawn: opts.spawn,
  };
}
