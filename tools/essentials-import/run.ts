import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { readMarshal, type MarshalValue } from '../../web/overworld/maps/marshal';
import { toRpgMap, toTilesets } from '../../web/overworld/maps/rmxp';
import { convertMap, type ConvertOpts } from '../../web/overworld/maps/convert';

// One manifest entry: which Essentials map number maps to one of our locations.
export interface Entry extends Omit<ConvertOpts, 'id'> { mapNo: number; }

const INSTALL = process.argv[2] ?? '.essentials';
const OUT_MAPS = 'web/public/maps';
const OUT_TILES = 'web/public/2d/tilesets';
const GFX_TILES = join(INSTALL, 'Graphics/Tilesets');
const GFX_AUTO = join(INSTALL, 'Graphics/Autotiles');

function load(p: string): MarshalValue { return readMarshal(new Uint8Array(readFileSync(p))); }

export function run(manifest: Record<string, Entry>): void {
  mkdirSync(OUT_MAPS, { recursive: true });
  mkdirSync(OUT_TILES, { recursive: true });
  const tilesets = toTilesets(load(join(INSTALL, 'Data/Tilesets.rxdata')) as MarshalValue[]);
  for (const [id, e] of Object.entries(manifest)) {
    const no = String(e.mapNo).padStart(3, '0');
    const map = toRpgMap(load(join(INSTALL, `Data/Map${no}.rxdata`)));
    const ts = tilesets[map.tilesetId];
    if (!ts) throw new Error(`no tileset ${map.tilesetId} for ${id}`);
    const v2 = convertMap(map, ts, {
      id, spawn: e.spawn, grassTerrainTag: e.grassTerrainTag, mapIdToLocation: e.mapIdToLocation,
    });
    writeFileSync(join(OUT_MAPS, `${id}.json`), JSON.stringify(v2));
    try { copyFileSync(join(GFX_TILES, `${ts.tilesetName}.png`), join(OUT_TILES, `${ts.tilesetName}.png`)); } catch { /* missing tileset png */ }
    for (const a of ts.autotileNames) {
      if (a) try { copyFileSync(join(GFX_AUTO, `${a}.png`), join(OUT_TILES, `${a}.png`)); } catch { /* missing autotile png */ }
    }
    console.log(`wrote ${id}.json (${v2.width}x${v2.height}, ${v2.warps.length} warps, tileset ${ts.tilesetName})`);
  }
}

// Direct run converts the Arc-1 manifest.
if (process.argv[1]?.replace(/\\/g, '/').endsWith('tools/essentials-import/run.ts')) {
  // dynamic import keeps the manifest out of the library surface
  import('./arc1-manifest').then(({ ARC1_MANIFEST }) => run(ARC1_MANIFEST));
}
