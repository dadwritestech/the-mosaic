# Convergence SP4a — Seam Map Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A headless, deterministic procedural generator that turns a `RiftDef` (+ seed + knobs) into a walkable `MapV2` with a visible biome fault-line (seam), warps, a Warden trigger, encounter grass, and biome features.

**Architecture:** A small pure pipeline under `web/overworld/mapgen/`: `computeSeam` lays a jagged boundary column-per-row → `carvePath` carves a guaranteed-walkable corridor (entry→exit) plus a Warden spur → `generateRiftMap` fills each side with its biome palette (harvested real tile IDs), scatters blocking features and encounter grass off the path, and emits the SP1 `MapV2` format unchanged. Reuses `makeRng` (seeded mulberry32) so a fixed `(seed, knobs)` reproduces an identical map.

**Tech Stack:** TypeScript, Vitest (`npx vitest run`), the existing `MapV2` type + renderer (SP1), `RiftDef`/`Biome` (SP1 data), `makeRng` from `src/ai/rng.ts`.

---

## Background the engineer needs

- **`MapV2` shape** (`web/overworld/maps/mapv2.ts`), emitted verbatim by the renderer/server:
  ```ts
  export interface Warp { x: number; y: number; toMap: string; toX: number; toY: number; }
  export interface Trigger { x: number; y: number; kind: 'gym' | 'shop' | 'center' | 'npc' | 'sign'; ref?: string; }
  export interface MapV2 {
    id: string; width: number; height: number;
    tileset: string; autotiles: string[];
    layers: number[][][];    // [3][height][width] raw RMXP tile IDs (0 = empty)
    passages: boolean[][];   // [height][width] true = walkable
    priorities: number[][];  // [height][width] draw-over-player flag
    warps: Warp[]; triggers: Trigger[];
    encounters: boolean[][]; // [height][width] true = tall-grass cell
    spawn: { x: number; y: number };
  }
  ```
  This task **extends `Trigger.kind`** with `'warden'` (Task 1).

- **Tile IDs are raw RMXP IDs.** `0` = empty. IDs `< 384` are autotiles; IDs `>= 384` are regular tileset tiles. The generator only ever writes regular tile IDs (`>= 384`) and `0`, so no autotile sub-pattern math is needed here. The renderer recomputes autotile rendering itself. The `tileset` is `'Outside'` and the `autotiles` array carries the standard Outside slot names (copied for renderer parity).

- **Harvested known-good tile IDs** (frequency-ranked from `web/public/maps/{cerulean-deep,aethels-rest}.json`): grass ground `385` and variant `401`; light ground `386`; sand-ish ground `546`; pavement/gravel ground `800`; red/gravel ground `808`; path tiles `801` and `808`; tree feature tiles `1681`/`1682`/`1960`; rock/obstacle feature `1664`; flower accent `262`. These are *candidates* — final visual tuning happens in SP4c via the SP4b editor; the generator just needs plausible distinct IDs per biome side.

- **Seeded RNG** (`src/ai/rng.ts`) — reuse, do **not** reimplement:
  ```ts
  export function makeRng(seed: number): () => number // mulberry32, yields [0,1)
  ```

- **Run tests** from repo root: `npx vitest run web/overworld/mapgen/<file>.test.ts`. Vitest already includes `web/**/*.test.ts`. `tsc` only type-checks `src/`, so these web-side files are validated by vitest, not `tsc` — that matches the existing setup; do not edit `tsconfig.json`.

- **Branch:** do this work on a dedicated branch (current repo branch is `master`; main branch is `main`). Do not commit straight to `main`.

---

## File structure

- Create `web/overworld/mapgen/types.ts` — `GenKnobs` interface + `DEFAULT_KNOBS`.
- Create `web/overworld/mapgen/biome-palettes.ts` — `BiomePalette` + `BIOME_PALETTES: Record<Biome, BiomePalette>`.
- Create `web/overworld/mapgen/seam.ts` — `computeSeam`, `sideAt`.
- Create `web/overworld/mapgen/path.ts` — `carvePath`, `PathResult`.
- Create `web/overworld/mapgen/generate.ts` — `generateRiftMap` orchestrator.
- Modify `web/overworld/maps/mapv2.ts` — add `'warden'` to `Trigger.kind`.
- Tests: one `*.test.ts` beside each created file.

Each file has one responsibility; `generate.ts` is the only one that imports all the others.

---

### Task 1: Extend `Trigger.kind` with `'warden'` + define generator knobs

**Files:**
- Modify: `web/overworld/maps/mapv2.ts:2`
- Create: `web/overworld/mapgen/types.ts`
- Test: `web/overworld/mapgen/types.test.ts`

- [ ] **Step 1: Add `'warden'` to the Trigger kind union**

In `web/overworld/maps/mapv2.ts`, change the `Trigger` interface line:
```ts
export interface Trigger { x: number; y: number; kind: 'gym' | 'shop' | 'center' | 'npc' | 'sign' | 'warden'; ref?: string; }
```

- [ ] **Step 2: Write the failing test for knob defaults**

Create `web/overworld/mapgen/types.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_KNOBS } from './types';

describe('GenKnobs defaults', () => {
  it('has sane dimensions and 0..1 density knobs', () => {
    expect(DEFAULT_KNOBS.width).toBeGreaterThanOrEqual(28);
    expect(DEFAULT_KNOBS.height).toBeGreaterThanOrEqual(24);
    expect(DEFAULT_KNOBS.featureDensity).toBeGreaterThan(0);
    expect(DEFAULT_KNOBS.featureDensity).toBeLessThan(1);
    expect(DEFAULT_KNOBS.grassDensity).toBeGreaterThan(0);
    expect(['vertical', 'diagonal']).toContain(DEFAULT_KNOBS.orientation);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run web/overworld/mapgen/types.test.ts`
Expected: FAIL — cannot resolve `./types`.

- [ ] **Step 4: Create the knobs module**

Create `web/overworld/mapgen/types.ts`:
```ts
import type { Biome } from '../../../src/content/types';

export interface GenKnobs {
  width: number;          // map width in tiles (28–40)
  height: number;         // map height in tiles (24–36)
  orientation: 'vertical' | 'diagonal'; // seam runs top-to-bottom, or corner-to-corner
  jaggedness: number;     // 0..1 — how far the seam wanders row to row
  featureDensity: number; // 0..1 — chance a non-path ground cell gets a blocking feature
  grassDensity: number;   // 0..1 — chance a clear ground cell is an encounter-grass cell
  forcedBiome?: Biome;    // when set, BOTH sides use this biome (the sealed single-biome variant)
  entryTo?: string;       // entry warp target map id (wired in SP4c; '' for now)
  exitTo?: string;        // exit warp target map id (wired in SP4c; '' for now)
}

export const DEFAULT_KNOBS: GenKnobs = {
  width: 32,
  height: 28,
  orientation: 'vertical',
  jaggedness: 0.5,
  featureDensity: 0.12,
  grassDensity: 0.25,
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run web/overworld/mapgen/types.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/overworld/maps/mapv2.ts web/overworld/mapgen/types.ts web/overworld/mapgen/types.test.ts
git commit -m "feat(mapgen): add warden trigger kind + GenKnobs defaults

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Biome palette table (harvested tile IDs)

**Files:**
- Create: `web/overworld/mapgen/biome-palettes.ts`
- Test: `web/overworld/mapgen/biome-palettes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/overworld/mapgen/biome-palettes.test.ts`:
```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run web/overworld/mapgen/biome-palettes.test.ts`
Expected: FAIL — cannot resolve `./biome-palettes`.

- [ ] **Step 3: Create the palette table**

Create `web/overworld/mapgen/biome-palettes.ts`:
```ts
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
```

Note: `kanto-plains` and `kalos-gardens` share ground `385`, and `johto-forests`/`galar`/`paldea` share `401` — that is safe because no rift pairs those biomes against each other (the second test enforces every rift's two sides differ).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run web/overworld/mapgen/biome-palettes.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/overworld/mapgen/biome-palettes.ts web/overworld/mapgen/biome-palettes.test.ts
git commit -m "feat(mapgen): biome palette table from harvested Outside tile IDs

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Seam fault-line

**Files:**
- Create: `web/overworld/mapgen/seam.ts`
- Test: `web/overworld/mapgen/seam.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/overworld/mapgen/seam.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeSeam, sideAt } from './seam';
import { DEFAULT_KNOBS } from './types';

describe('computeSeam', () => {
  it('returns one boundary column per row, inside the margins', () => {
    const k = { ...DEFAULT_KNOBS, width: 32, height: 28 };
    const seam = computeSeam(123, k);
    expect(seam.length).toBe(28);
    const margin = Math.max(3, Math.floor(32 * 0.2)); // 6
    for (const c of seam) {
      expect(c).toBeGreaterThanOrEqual(margin);
      expect(c).toBeLessThanOrEqual(32 - margin);
    }
  });

  it('keeps both sides non-empty in every row', () => {
    const k = { ...DEFAULT_KNOBS, width: 32, height: 28 };
    const seam = computeSeam(7, k);
    for (let y = 0; y < k.height; y++) {
      expect(sideAt(seam, 0, y)).toBe('A');
      expect(sideAt(seam, k.width - 1, y)).toBe('B');
    }
  });

  it('is deterministic for a fixed seed', () => {
    const k = { ...DEFAULT_KNOBS };
    expect(computeSeam(999, k)).toEqual(computeSeam(999, k));
  });

  it('diagonal orientation drifts the seam across the map', () => {
    const k = { ...DEFAULT_KNOBS, orientation: 'diagonal' as const, jaggedness: 0 };
    const seam = computeSeam(5, k);
    expect(seam[seam.length - 1]).toBeGreaterThan(seam[0]); // trends rightward
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run web/overworld/mapgen/seam.test.ts`
Expected: FAIL — cannot resolve `./seam`.

- [ ] **Step 3: Implement the seam**

Create `web/overworld/mapgen/seam.ts`:
```ts
import { makeRng } from '../../../src/ai/rng';
import type { GenKnobs } from './types';

/**
 * Boundary x-column per row. A cell (x,y) is on side A when x < seam[y], else side B.
 * Vertical: wanders around the centre. Diagonal: drifts left-margin -> right-margin top to bottom.
 */
export function computeSeam(seed: number, knobs: GenKnobs): number[] {
  const { width, height, orientation, jaggedness } = knobs;
  const rng = makeRng((seed ^ 0x5ea3) >>> 0);
  const margin = Math.max(3, Math.floor(width * 0.2));
  const amp = 1 + Math.round(jaggedness * 3); // max jagged step per row
  const driftPerRow = orientation === 'diagonal'
    ? (width - 2 * margin) / Math.max(1, height - 1)
    : 0;
  const seam: number[] = [];
  for (let y = 0; y < height; y++) {
    const base = orientation === 'diagonal' ? margin + driftPerRow * y : width / 2;
    const step = Math.round((rng() * 2 - 1) * amp);
    const col = Math.max(margin, Math.min(width - margin, Math.round(base) + step));
    seam.push(col);
  }
  return seam;
}

export function sideAt(seam: number[], x: number, y: number): 'A' | 'B' {
  return x < seam[y] ? 'A' : 'B';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run web/overworld/mapgen/seam.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add web/overworld/mapgen/seam.ts web/overworld/mapgen/seam.test.ts
git commit -m "feat(mapgen): jagged biome seam (vertical/diagonal)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Walkable path + Warden spur

**Files:**
- Create: `web/overworld/mapgen/path.ts`
- Test: `web/overworld/mapgen/path.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/overworld/mapgen/path.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { carvePath } from './path';
import { computeSeam, sideAt } from './seam';
import { DEFAULT_KNOBS } from './types';

const key = (x: number, y: number, w: number) => y * w + x;

describe('carvePath', () => {
  it('places entry on the bottom edge and exit on the top edge', () => {
    const k = { ...DEFAULT_KNOBS };
    const p = carvePath(42, k);
    expect(p.entry.y).toBe(k.height - 1);
    expect(p.exit.y).toBe(0);
    expect(p.cells.has(key(p.entry.x, p.entry.y, k.width))).toBe(true);
    expect(p.cells.has(key(p.exit.x, p.exit.y, k.width))).toBe(true);
  });

  it('forms a vertically continuous corridor (one path cell per row)', () => {
    const k = { ...DEFAULT_KNOBS };
    const p = carvePath(42, k);
    for (let y = 0; y < k.height; y++) {
      let count = 0;
      for (let x = 0; x < k.width; x++) if (p.cells.has(key(x, y, k.width))) count++;
      expect(count).toBeGreaterThan(0);
    }
  });

  it('crosses the seam at least once', () => {
    const k = { ...DEFAULT_KNOBS };
    const seam = computeSeam(42, k);
    const p = carvePath(42, k);
    const sides = new Set<string>();
    for (let y = 0; y < k.height; y++) {
      for (let x = 0; x < k.width; x++) {
        if (p.cells.has(key(x, y, k.width))) sides.add(sideAt(seam, x, y));
      }
    }
    expect(sides.size).toBe(2); // path visits both A and B
  });

  it('puts the Warden on a path cell', () => {
    const k = { ...DEFAULT_KNOBS };
    const p = carvePath(42, k);
    expect(p.cells.has(key(p.warden.x, p.warden.y, k.width))).toBe(true);
  });

  it('is deterministic for a fixed seed', () => {
    const a = carvePath(42, { ...DEFAULT_KNOBS });
    const b = carvePath(42, { ...DEFAULT_KNOBS });
    expect([...a.cells].sort()).toEqual([...b.cells].sort());
    expect(a.warden).toEqual(b.warden);
  });
});
```

Note: the "crosses the seam" test relies on the corridor wandering horizontally enough to reach both sides for seed 42; the implementation's random ±1 walk plus the seam centred near `width/2` makes this reliable. If a future seed fails this invariant it indicates the corridor is too straight — widen the walk, do not weaken the test.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run web/overworld/mapgen/path.test.ts`
Expected: FAIL — cannot resolve `./path`.

- [ ] **Step 3: Implement path carving**

Create `web/overworld/mapgen/path.ts`:
```ts
import { makeRng } from '../../../src/ai/rng';
import type { GenKnobs } from './types';

export interface PathResult {
  cells: Set<number>;                 // key = y * width + x
  entry: { x: number; y: number };    // bottom edge (also spawn)
  exit: { x: number; y: number };     // top edge
  warden: { x: number; y: number };   // on the spur
}

const key = (x: number, y: number, w: number) => y * w + x;

/**
 * Carve a guaranteed-walkable corridor from the bottom edge (entry) to the top edge (exit),
 * wandering ±1 column per row so it crosses the centred seam, then a horizontal spur to the Warden.
 */
export function carvePath(seed: number, knobs: GenKnobs): PathResult {
  const { width, height } = knobs;
  const rng = makeRng((seed ^ 0x9a71) >>> 0);
  const cells = new Set<number>();
  const pathX: number[] = new Array(height);

  let x = Math.floor(width / 2);
  const entry = { x, y: height - 1 };
  for (let y = height - 1; y >= 0; y--) {
    pathX[y] = x;
    cells.add(key(x, y, width));
    if (x + 1 < width) cells.add(key(x + 1, y, width)); // widen by 1 so diagonals stay connected
    if (y > 0) {
      const step = Math.floor(rng() * 3) - 1; // -1, 0, +1
      x = Math.max(1, Math.min(width - 2, x + step));
    }
  }
  const exit = { x: pathX[0], y: 0 };

  // Warden spur: from the corridor at mid-height, run horizontally a few tiles to a clearing.
  const spurY = Math.floor(height / 2);
  const spurX = pathX[spurY];
  const wardenX = spurX < width / 2 ? Math.min(width - 2, spurX + 4) : Math.max(1, spurX - 4);
  const lo = Math.min(spurX, wardenX);
  const hi = Math.max(spurX, wardenX);
  for (let xx = lo; xx <= hi; xx++) cells.add(key(xx, spurY, width));

  return { cells, entry, exit, warden: { x: wardenX, y: spurY } };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run web/overworld/mapgen/path.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add web/overworld/mapgen/path.ts web/overworld/mapgen/path.test.ts
git commit -m "feat(mapgen): walkable entry->exit corridor + warden spur

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: `generateRiftMap` orchestrator → `MapV2`

**Files:**
- Create: `web/overworld/mapgen/generate.ts`
- Test: `web/overworld/mapgen/generate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/overworld/mapgen/generate.test.ts`:
```ts
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
    // only biomeA's ground (+ its path tile) appear; biomeB ground must be absent
    expect(grounds.has(BIOME_PALETTES[rift.biomeB].groundTile)).toBe(false);
  });

  it('is deterministic for a fixed (seed, knobs)', () => {
    const a = generateRiftMap(rift, 77, DEFAULT_KNOBS);
    const b = generateRiftMap(rift, 77, DEFAULT_KNOBS);
    expect(a).toEqual(b);
  });
});
```

Note on the `forcedBiome` test: it asserts biomeB's ground is **absent**. This holds only if biomeA and biomeB don't coincidentally share a ground ID — for `thornmarsh` they are `385` (kanto) vs `401` (johto), distinct, so the test is valid.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run web/overworld/mapgen/generate.test.ts`
Expected: FAIL — cannot resolve `./generate`.

- [ ] **Step 3: Implement the orchestrator**

Create `web/overworld/mapgen/generate.ts`:
```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run web/overworld/mapgen/generate.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add web/overworld/mapgen/generate.ts web/overworld/mapgen/generate.test.ts
git commit -m "feat(mapgen): generateRiftMap orchestrator -> MapV2

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: All-rifts invariant sweep

**Files:**
- Test: `web/overworld/mapgen/all-rifts.test.ts`

This guards that the generator produces a valid, winnable map for **every** one of the 7 rifts (and their sealed variants), not just `thornmarsh`.

- [ ] **Step 1: Write the test**

Create `web/overworld/mapgen/all-rifts.test.ts`:
```ts
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
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run web/overworld/mapgen/all-rifts.test.ts`
Expected: PASS (14 tests — 2 per rift × 7 rifts).

- [ ] **Step 3: Run the whole mapgen suite + the full suite**

Run: `npx vitest run web/overworld/mapgen`
Expected: PASS (all mapgen tests green).

Run: `npx vitest run`
Expected: PASS — the full suite stays green (SP4a is additive; no existing file changed except the `Trigger.kind` union, which only widens a type).

- [ ] **Step 4: Commit**

```bash
git add web/overworld/mapgen/all-rifts.test.ts
git commit -m "test(mapgen): all 7 rifts + sealed variants generate winnable maps

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-review notes (already applied)

- **Spec coverage:** dimensions/seam/path/zones(grass)/warps+warden/fill/encounters/emit `MapV2` → Tasks 3–5; biome palette table → Task 2; determinism → tested in Tasks 3,4,5; state variants (sealed single-biome) → `forcedBiome` knob, Task 5 + Task 6. **Deferred to later SP4 pieces (out of scope here, matching the spec):** water/feature *zones* beyond scattered features, the touch-up editor (SP4b), region wiring/warp targets (SP4c — `entryTo`/`exitTo` are stubs now).
- **Type consistency:** `GenKnobs`, `BiomePalette`, `PathResult`, `computeSeam`/`sideAt`/`carvePath`/`generateRiftMap` signatures are identical everywhere they appear. `Trigger.kind` gains `'warden'` in Task 1 before Task 5 uses it.
- **No placeholders:** every code step is complete and runnable.
