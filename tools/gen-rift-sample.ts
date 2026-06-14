// Throwaway: emit one generated rift map to web/public/maps so the debug
// loadSample jump can render it. Run: npx tsx tools/gen-rift-sample.ts
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateRiftMap } from '../web/overworld/mapgen/generate';
import { DEFAULT_KNOBS } from '../web/overworld/mapgen/types';
import { getRift } from '../src/content/rifts';

const id = process.argv[2] ?? 'thornmarsh';
const seed = Number(process.argv[3] ?? 1);
const rift = getRift(id);
if (!rift) { console.error(`no rift ${id}`); process.exit(1); }

const map = generateRiftMap(rift, seed, { ...DEFAULT_KNOBS, width: 34, height: 30 });
const out = join(process.cwd(), 'web/public/maps', `${map.id}.json`);
writeFileSync(out, JSON.stringify(map));
const grass = map.encounters.flat().filter(Boolean).length;
console.log(`wrote ${out} (${map.width}x${map.height}, ${grass} grass cells, warden@${map.triggers[0].x},${map.triggers[0].y}, spawn@${map.spawn.x},${map.spawn.y})`);
