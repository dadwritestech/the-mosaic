import type { MapV2, Warp, Trigger } from '../maps/mapv2';
import type { RiftDef } from '../../../src/content/types';
import { makeRng } from '../../../src/ai/rng';
import { BIOME_PALETTES } from './biome-palettes';
import { computeSeam, sideAt } from './seam';
import { carvePath } from './path';
import type { GenKnobs } from './types';

// Standard Outside autotile slot names, copied for renderer parity (the generator
// itself writes only regular tile IDs >= 384, so these are not indexed here).
const OUTSIDE_AUTOTILES = ['Sea', 'Sea without shore', 'Sea deep', 'Sand shore', 'Flowers1', 'Water rock', 'Fountain1'];

/** Turn a rift (+ seed + knobs) into a walkable MapV2 with a biome seam. */
export function generateRiftMap(rift: RiftDef, seed: number, knobs: GenKnobs): MapV2 {
  const { width, height } = knobs;
  const rng = makeRng((seed ^ 0xf111) >>> 0);
  const seam = computeSeam(seed, knobs);
  const path = carvePath(seed, knobs);
  const palA = BIOME_PALETTES[knobs.forcedBiome ?? rift.biomeA];
  const palB = BIOME_PALETTES[knobs.forcedBiome ?? rift.biomeB];
  const isPath = (x: number, y: number) => path.cells.has(y * width + x);

  const layer0: number[][] = [];
  const layer1: number[][] = [];
  const layer2: number[][] = [];
  const passages: boolean[][] = [];
  const priorities: number[][] = [];
  const encounters: boolean[][] = [];

  for (let y = 0; y < height; y++) {
    const r0: number[] = [], r1: number[] = [], r2: number[] = [];
    const rp: boolean[] = [], rpr: number[] = [], re: boolean[] = [];
    for (let x = 0; x < width; x++) {
      const pal = sideAt(seam, x, y) === 'A' ? palA : palB;
      r2.push(0); // top decorative layer unused by the generator

      if (isPath(x, y)) {
        r0.push(pal.pathTile); r1.push(0);
        rp.push(true); rpr.push(0); re.push(false);
        continue;
      }

      r0.push(pal.groundTile);
      if (pal.featureTiles.length && rng() < knobs.featureDensity) {
        // blocking feature (tree / rock) on layer 1
        r1.push(pal.featureTiles[Math.floor(rng() * pal.featureTiles.length)]);
        rp.push(false); rpr.push(1); re.push(false);
      } else if (pal.accentTiles.length && rng() < 0.05) {
        // non-blocking decal (flowers)
        r1.push(pal.accentTiles[Math.floor(rng() * pal.accentTiles.length)]);
        rp.push(true); rpr.push(0); re.push(false);
      } else {
        r1.push(0);
        rp.push(true); rpr.push(0);
        re.push(rng() < knobs.grassDensity); // encounter grass
      }
    }
    layer0.push(r0); layer1.push(r1); layer2.push(r2);
    passages.push(rp); priorities.push(rpr); encounters.push(re);
  }

  const warps: Warp[] = [
    { x: path.entry.x, y: path.entry.y, toMap: knobs.entryTo ?? '', toX: 0, toY: 0 },
    { x: path.exit.x, y: path.exit.y, toMap: knobs.exitTo ?? '', toX: 0, toY: 0 },
  ];
  const triggers: Trigger[] = [
    { x: path.warden.x, y: path.warden.y, kind: 'warden', ref: rift.warden.id },
  ];

  return {
    id: `rift-${rift.id}`,
    width, height,
    tileset: 'Outside',
    autotiles: OUTSIDE_AUTOTILES,
    layers: [layer0, layer1, layer2],
    passages, priorities,
    warps, triggers, encounters,
    spawn: { x: path.entry.x, y: path.entry.y },
  };
}
