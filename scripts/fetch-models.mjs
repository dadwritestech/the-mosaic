// Download all Pokémon GLB models locally so the game has no runtime dependency
// on an external host. Source: Pokemon-3D-api/assets (Draco/WebP GLBs, by dex num).
// Usage: node scripts/fetch-models.mjs   (skips files already present; re-run to resume)
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const BASE = 'https://raw.githubusercontent.com/Pokemon-3D-api/assets/main/models/opt/regular';
const OUT = 'web/public/models3d/regular';
const MAX = Number(process.argv[2] ?? 1025);
const CONCURRENCY = 12;

await mkdir(OUT, { recursive: true });

const queue = [];
for (let i = 1; i <= MAX; i++) queue.push(i);

let done = 0, ok = 0, miss = 0, skip = 0;

async function worker() {
  while (queue.length) {
    const n = queue.shift();
    const dest = `${OUT}/${n}.glb`;
    if (existsSync(dest)) { skip++; done++; continue; }
    try {
      const r = await fetch(`${BASE}/${n}.glb`);
      if (r.ok) { await writeFile(dest, Buffer.from(await r.arrayBuffer())); ok++; }
      else miss++;
    } catch { miss++; }
    done++;
    if (done % 50 === 0) console.log(`${done}/${MAX}  downloaded=${ok} skipped=${skip} missing=${miss}`);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`DONE  downloaded=${ok} skipped=${skip} missing=${miss}  (total present ~${ok + skip})`);
