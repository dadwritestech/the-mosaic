# Map Pipeline (Essentials Import) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Pokémon Essentials (RPG Maker XP) maps into a `MapV2` format the game loads, render them at full fidelity (plain tiles + autotiles), and support warping between exterior and interior maps.

**Architecture:** A small dependency-free Ruby-Marshal reader parses `.rxdata`; an RMXP layer turns raw Marshal into typed `RPG::Map`/`RPG::Tileset` structures; a converter produces `MapV2` (3 tile-ID layers + derived passability, warps, triggers, encounters); an offline CLI writes `MapV2` JSON + copies tileset/autotile PNGs into `web/public`; the Canvas2D renderer draws the 3 layers including autotiles; the server loads `MapV2` and handles warps. The 190-test `src/` engine is never touched.

**Tech Stack:** TypeScript (NodeNext), Vitest, tsx, Canvas2D. No new runtime dependencies.

---

## File Structure

**New (library — under `web/` so Vitest's `web/**/*.test.ts` picks up tests):**
- `web/overworld/maps/marshal.ts` — Ruby Marshal 4.8 reader. `readMarshal(buf: Uint8Array): MarshalValue`.
- `web/overworld/maps/marshal.test.ts`
- `web/overworld/maps/rmxp.ts` — RMXP decode: `decodeTable`, `toRpgMap`, `toRpgTilesets`, RMXP types.
- `web/overworld/maps/rmxp.test.ts`
- `web/overworld/maps/mapv2.ts` — the `MapV2` interface (shared by converter, server, renderer).
- `web/overworld/maps/autotile.ts` — `AUTOTILE_TABLE` + `autotileQuads(subId)`.
- `web/overworld/maps/autotile.test.ts`
- `web/overworld/maps/convert.ts` — `convertMap(map, tileset, opts): MapV2` (passability, warps, triggers, encounters).
- `web/overworld/maps/convert.test.ts`
- `web/overworld/maps/loader.ts` — server-side `loadMapV2(id): MapV2` (reads `web/public/maps/<id>.json`).
- `tools/essentials-import/run.ts` — offline CLI: unzip/read install → convert → write JSON + copy PNGs.
- `web/public/maps/<id>.json`, `web/public/2d/tilesets/*.png` — converter outputs (the PNGs gitignored alongside other big assets).

**Modified:**
- `web/overworld/overworld2d.ts` — render `MapV2` (3 layers + autotiles + priority pass).
- `server/session.ts` — load `MapV2`, generalize `exitTo` into warp handling, encounters from `MapV2.encounters`.
- `web/overworld/maps/slice.ts` — add a `toMapV2()` adapter for the 3 existing hand-authored maps so the renderer has one input type during migration.
- `.gitignore` — add `web/public/2d/tilesets/` and the extracted Essentials working dir.

**Vendored fixtures (committed, tiny):**
- `web/overworld/maps/__fixtures__/sample-map.rxdata` — one small real Essentials map for integration-level converter tests.

---

## Task 1: Ruby Marshal reader — primitives

**Files:**
- Create: `web/overworld/maps/marshal.ts`
- Test: `web/overworld/maps/marshal.test.ts`

Marshal 4.8 streams begin with bytes `0x04 0x08`, then one tagged value. Type tags we support: `0`=nil, `T`=true, `F`=false, `i`=Fixnum, `:`=Symbol(def), `;`=Symbol(ref), `"`=String, `I`=ivar-wrapped, `[`=Array, `{`=Hash, `o`=Object, `u`=user-defined, `@`=object-ref. This task does the primitives; objects/arrays come in Task 2.

- [ ] **Step 1: Write the failing test**

```ts
// web/overworld/maps/marshal.test.ts
import { describe, it, expect } from 'vitest';
import { readMarshal } from './marshal';

const wrap = (...bytes: number[]) => new Uint8Array([0x04, 0x08, ...bytes]);

describe('marshal primitives', () => {
  it('reads nil/true/false', () => {
    expect(readMarshal(wrap(0x30))).toBe(null);          // '0'
    expect(readMarshal(wrap(0x54))).toBe(true);          // 'T'
    expect(readMarshal(wrap(0x46))).toBe(false);         // 'F'
  });
  it('reads fixnums (compact encoding)', () => {
    expect(readMarshal(wrap(0x69, 0x00))).toBe(0);       // i, 0
    expect(readMarshal(wrap(0x69, 0x06))).toBe(1);       // i, n+5 for 1..122 => 6
    expect(readMarshal(wrap(0x69, 0x7f))).toBe(122);     // 0x7f = 127 => 122
    expect(readMarshal(wrap(0x69, 0xfa))).toBe(-1);      // n-5 for -1 => 0xfa
    expect(readMarshal(wrap(0x69, 0x01, 0xff))).toBe(255);   // 1 trailing byte
    expect(readMarshal(wrap(0x69, 0x02, 0x00, 0x01))).toBe(256); // 2 trailing bytes
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run web/overworld/maps/marshal.test.ts`
Expected: FAIL — `readMarshal` is not defined.

- [ ] **Step 3: Write minimal implementation**

```ts
// web/overworld/maps/marshal.ts
export type MarshalValue =
  | null | boolean | number | string
  | { __symbol: string }
  | MarshalValue[]
  | { __class: string; ivars: Record<string, MarshalValue> }
  | { __userClass: string; data: Uint8Array }
  | Record<string, MarshalValue>;

export function readMarshal(buf: Uint8Array): MarshalValue {
  const r = new Reader(buf);
  if (r.u8() !== 0x04 || r.u8() !== 0x08) throw new Error('not Marshal 4.8');
  return r.value();
}

class Reader {
  pos = 0;
  symbols: string[] = [];
  constructor(public b: Uint8Array) {}
  u8(): number { return this.b[this.pos++]; }

  long(): number {
    const c = (this.u8() << 24) >> 24; // signed first byte
    if (c === 0) return 0;
    if (c > 0) { // c bytes follow, little-endian
      if (c > 4) return c - 5;
      let n = 0;
      for (let i = 0; i < c; i++) n |= this.u8() << (8 * i);
      return n;
    }
    // negative count
    if (c < -4) return c + 5;
    let n = -1;
    for (let i = 0; i < -c; i++) { n &= ~(0xff << (8 * i)); n |= this.u8() << (8 * i); }
    return n;
  }

  value(): MarshalValue {
    const t = this.u8();
    switch (t) {
      case 0x30: return null;        // '0'
      case 0x54: return true;        // 'T'
      case 0x46: return false;       // 'F'
      case 0x69: return this.long(); // 'i'
      default: throw new Error('unhandled marshal tag 0x' + t.toString(16) + ' @' + (this.pos - 1));
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run web/overworld/maps/marshal.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/overworld/maps/marshal.ts web/overworld/maps/marshal.test.ts
git commit -m "feat(maps): marshal reader — nil/bool/fixnum primitives"
```

---

## Task 2: Marshal reader — symbols, strings, arrays, hashes, objects, userdef

**Files:**
- Modify: `web/overworld/maps/marshal.ts`
- Modify: `web/overworld/maps/marshal.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// append to web/overworld/maps/marshal.test.ts
describe('marshal composites', () => {
  it('reads symbol + symlink', () => {
    // [:ab, :ab] -> array len 2, def-symbol 'ab', symlink 0
    const v = readMarshal(new Uint8Array([0x04,0x08, 0x5b,0x07, 0x3a,0x07,0x61,0x62, 0x3b,0x00]));
    expect(v).toEqual([{ __symbol: 'ab' }, { __symbol: 'ab' }]);
  });
  it('reads ascii string (ivar-wrapped)', () => {
    // I"hi\x06:\x06ET  (string "hi", 1 ivar :E=true)
    const v = readMarshal(new Uint8Array([0x04,0x08, 0x49,0x22,0x07,0x68,0x69, 0x06,0x3a,0x06,0x45,0x54]));
    expect(v).toBe('hi');
  });
  it('reads hash {i6=>i7}', () => {
    const v = readMarshal(new Uint8Array([0x04,0x08, 0x7b,0x06, 0x69,0x06, 0x69,0x07]));
    expect(v).toEqual({ '1': 2 });
  });
  it('reads object o:Foo with @x=1', () => {
    // o:\x08Foo\x06:\x07@x i\x06
    const v = readMarshal(new Uint8Array([0x04,0x08, 0x6f,0x3a,0x08,0x46,0x6f,0x6f, 0x06, 0x3a,0x07,0x40,0x78, 0x69,0x06]));
    expect(v).toEqual({ __class: 'Foo', ivars: { '@x': 1 } });
  });
  it('reads userdef u:Table<bytes>', () => {
    // u:\nTable\x07\x01\x02  (class Table, 2 bytes 0x01 0x02)
    const v = readMarshal(new Uint8Array([0x04,0x08, 0x75,0x3a,0x0a,0x54,0x61,0x62,0x6c,0x65, 0x07,0x01,0x02])) as any;
    expect(v.__userClass).toBe('Table');
    expect([...v.data]).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run web/overworld/maps/marshal.test.ts`
Expected: FAIL — `unhandled marshal tag` for `0x5b` (`[`), etc.

- [ ] **Step 3: Write the implementation**

Replace the `value()` switch and add helpers:

```ts
  bytes(n: number): Uint8Array { const s = this.b.subarray(this.pos, this.pos + n); this.pos += n; return s; }
  rawString(): string { const n = this.long(); return new TextDecoder('latin1').decode(this.bytes(n)); }

  symbol(): { __symbol: string } { const s = this.rawString(); this.symbols.push(s); return { __symbol: s }; }
  symlink(): { __symbol: string } { return { __symbol: this.symbols[this.long()] }; }

  value(): MarshalValue {
    const t = this.u8();
    switch (t) {
      case 0x30: return null;
      case 0x54: return true;
      case 0x46: return false;
      case 0x69: return this.long();
      case 0x3a: return this.symbol();                 // ':'
      case 0x3b: return this.symlink();                // ';'
      case 0x22: return this.rawString();              // '"'  (bare string)
      case 0x49: { const s = this.value(); this.skipIvars(); return s; } // 'I' ivar-wrapped
      case 0x5b: { const n = this.long(); const a: MarshalValue[] = []; for (let i=0;i<n;i++) a.push(this.value()); return a; } // '['
      case 0x7b: { const n = this.long(); const h: Record<string, MarshalValue> = {}; for (let i=0;i<n;i++){ const k = this.value(); const val = this.value(); h[this.keyStr(k)] = val; } return h; } // '{'
      case 0x6f: return this.object();                 // 'o'
      case 0x75: return this.userdef();                // 'u'
      default: throw new Error('unhandled marshal tag 0x' + t.toString(16) + ' @' + (this.pos - 1));
    }
  }

  skipIvars(): void { const n = this.long(); for (let i=0;i<n;i++){ this.value(); this.value(); } }
  keyStr(k: MarshalValue): string {
    if (typeof k === 'number') return String(k);
    if (k && typeof k === 'object' && '__symbol' in k) return (k as any).__symbol;
    return String(k);
  }
  object(): MarshalValue {
    const cls = this.symOrLink();
    const n = this.long();
    const ivars: Record<string, MarshalValue> = {};
    for (let i=0;i<n;i++){ const key = this.symOrLink(); ivars[key] = this.value(); }
    return { __class: cls, ivars };
  }
  userdef(): MarshalValue {
    const cls = this.symOrLink();
    const len = this.long();
    return { __userClass: cls, data: this.bytes(len) };
  }
  symOrLink(): string {
    const t = this.u8();
    if (t === 0x3a) return this.symbol().__symbol;
    if (t === 0x3b) return this.symbols[this.long()];
    throw new Error('expected symbol, got 0x' + t.toString(16));
  }
```

> Note: `'I'` (ivar-wrapped) is used to attach encoding (`:E`) to strings; we read the inner value then discard its ivars. Object references (`'@'`, tag `0x40`) are rare in RMXP map dumps; if `unhandled marshal tag 0x40` ever throws on a real map, add an object cache and an `@`-handler in a follow-up — the spike (Task 8) will surface it on real data.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run web/overworld/maps/marshal.test.ts`
Expected: PASS (all primitive + composite tests).

- [ ] **Step 5: Commit**

```bash
git add web/overworld/maps/marshal.ts web/overworld/maps/marshal.test.ts
git commit -m "feat(maps): marshal reader — symbols, strings, arrays, hashes, objects, userdef"
```

---

## Task 3: RMXP decode — Table blob + typed map/tileset

**Files:**
- Create: `web/overworld/maps/rmxp.ts`
- Test: `web/overworld/maps/rmxp.test.ts`

RMXP `Table` user-data blob = five int32 little-endian `[dim, xsize, ysize, zsize, total]` then `total` int16 little-endian cells. `RPG::Map.@data` is a 3D Table (`x=width, y=height, z=3`), indexed `data[z*xsize*ysize + y*xsize + x]`.

- [ ] **Step 1: Write the failing test**

```ts
// web/overworld/maps/rmxp.test.ts
import { describe, it, expect } from 'vitest';
import { decodeTable, toRpgMap } from './rmxp';

function tableBlob(xs: number, ys: number, zs: number, cells: number[]): Uint8Array {
  const head = new Int32Array([3, xs, ys, zs, cells.length]);
  const body = new Int16Array(cells);
  const out = new Uint8Array(head.byteLength + body.byteLength);
  out.set(new Uint8Array(head.buffer), 0);
  out.set(new Uint8Array(body.buffer), head.byteLength);
  return out;
}

describe('decodeTable', () => {
  it('parses dims + cells and indexes (x,y,z)', () => {
    // 2x2x2, cells laid out z-major then y then x
    const t = decodeTable({ __userClass: 'Table', data: tableBlob(2, 2, 2, [10,11,12,13, 20,21,22,23]) } as any);
    expect([t.xsize, t.ysize, t.zsize]).toEqual([2, 2, 2]);
    expect(t.at(0, 0, 0)).toBe(10);
    expect(t.at(1, 0, 0)).toBe(11);
    expect(t.at(0, 1, 0)).toBe(12);
    expect(t.at(1, 1, 1)).toBe(23);
  });
});

describe('toRpgMap', () => {
  it('extracts width/height/tileset_id/data/events from an RPG::Map object', () => {
    const obj = { __class: 'RPG::Map', ivars: {
      '@width': 2, '@height': 1, '@tileset_id': 7,
      '@data': { __userClass: 'Table', data: tableBlob(2, 1, 3, [384,385, 0,0, 0,0]) },
      '@events': {},
    }};
    const m = toRpgMap(obj as any);
    expect(m.width).toBe(2);
    expect(m.tilesetId).toBe(7);
    expect(m.data.at(0, 0, 0)).toBe(384);
    expect(m.data.at(1, 0, 0)).toBe(385);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run web/overworld/maps/rmxp.test.ts`
Expected: FAIL — `decodeTable` not defined.

- [ ] **Step 3: Write the implementation**

```ts
// web/overworld/maps/rmxp.ts
import type { MarshalValue } from './marshal';

export interface RmxpTable {
  xsize: number; ysize: number; zsize: number;
  cells: Int16Array;
  at(x: number, y: number, z: number): number;
}

export function decodeTable(v: MarshalValue): RmxpTable {
  if (!v || typeof v !== 'object' || !('__userClass' in v) || (v as any).__userClass !== 'Table') {
    throw new Error('not a Table');
  }
  const data = (v as any).data as Uint8Array;
  const head = new Int32Array(data.buffer, data.byteOffset, 5);
  const [, xsize, ysize, zsize] = head;
  const cells = new Int16Array(data.buffer, data.byteOffset + 20, xsize * ysize * zsize);
  return {
    xsize, ysize, zsize, cells,
    at: (x, y, z) => cells[z * xsize * ysize + y * xsize + x],
  };
}

export interface RpgEvent { x: number; y: number; name: string; pages: MarshalValue[]; }
export interface RpgMap {
  width: number; height: number; tilesetId: number;
  data: RmxpTable; events: RpgEvent[];
}

const iv = (o: MarshalValue, k: string): MarshalValue => (o as any).ivars?.[k];

export function toRpgMap(obj: MarshalValue): RpgMap {
  const width = iv(obj, '@width') as number;
  const height = iv(obj, '@height') as number;
  const tilesetId = iv(obj, '@tileset_id') as number;
  const data = decodeTable(iv(obj, '@data'));
  const rawEvents = (iv(obj, '@events') ?? {}) as Record<string, MarshalValue>;
  const events: RpgEvent[] = Object.values(rawEvents).map((e) => ({
    x: iv(e, '@x') as number, y: iv(e, '@y') as number,
    name: (iv(e, '@name') as string) ?? '',
    pages: (iv(e, '@pages') as MarshalValue[]) ?? [],
  }));
  return { width, height, tilesetId, data, events };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run web/overworld/maps/rmxp.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/overworld/maps/rmxp.ts web/overworld/maps/rmxp.test.ts
git commit -m "feat(maps): RMXP Table decode + typed RPG::Map extraction"
```

---

## Task 4: RMXP tilesets — passages, priorities, terrain tags

**Files:**
- Modify: `web/overworld/maps/rmxp.ts`
- Modify: `web/overworld/maps/rmxp.test.ts`

`Tilesets.rxdata` marshals to an array indexed by tileset id (index 0 is nil). Each `RPG::Tileset` has `@tileset_name` (string), `@autotile_names` (array of 7 strings), `@passages`/`@priorities`/`@terrain_tags` (1-D `Table`s indexed by tile id). A tile is **blocked** if `passages[id] & 0x0f` has any of the four directional bits set in a way that blocks all directions — Essentials' rule: impassable if `(passages[id] & 0x0f) === 0x0f` OR the tile is otherwise marked; for our purposes treat `passable = (passages[id] & 0x0f) !== 0x0f`.

- [ ] **Step 1: Write the failing test**

```ts
// append to web/overworld/maps/rmxp.test.ts
import { toTilesets } from './rmxp';
function table1d(cells: number[]): any {
  const head = new Int32Array([1, cells.length, 1, 1, cells.length]);
  const body = new Int16Array(cells);
  const out = new Uint8Array(head.byteLength + body.byteLength);
  out.set(new Uint8Array(head.buffer), 0); out.set(new Uint8Array(body.buffer), head.byteLength);
  return { __userClass: 'Table', data: out };
}
describe('toTilesets', () => {
  it('reads name, autotiles, passages, terrain tags by id', () => {
    const ts = { __class: 'RPG::Tileset', ivars: {
      '@tileset_name': 'Outside', '@autotile_names': ['Grass','','','','','',''],
      '@passages': table1d([0x0f, 0x00, 0x00]),     // id0 blocked, id1/2 passable
      '@priorities': table1d([0, 0, 1]),
      '@terrain_tags': table1d([0, 2, 0]),          // id1 terrain tag 2
    }};
    const out = toTilesets([null, ts] as any);
    expect(out[1].tilesetName).toBe('Outside');
    expect(out[1].autotileNames[0]).toBe('Grass');
    expect(out[1].passable(0)).toBe(false);
    expect(out[1].passable(1)).toBe(true);
    expect(out[1].priority(2)).toBe(1);
    expect(out[1].terrainTag(1)).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run web/overworld/maps/rmxp.test.ts`
Expected: FAIL — `toTilesets` not defined.

- [ ] **Step 3: Write the implementation**

```ts
// append to web/overworld/maps/rmxp.ts
export interface RpgTileset {
  tilesetName: string;
  autotileNames: string[];
  passable(id: number): boolean;
  priority(id: number): number;
  terrainTag(id: number): number;
}

function flat(t: RmxpTable): Int16Array { return t.cells; }

export function toTilesets(arr: MarshalValue[]): (RpgTileset | null)[] {
  return arr.map((ts) => {
    if (!ts) return null;
    const pass = flat(decodeTable(iv(ts, '@passages')));
    const prio = flat(decodeTable(iv(ts, '@priorities')));
    const terr = flat(decodeTable(iv(ts, '@terrain_tags')));
    return {
      tilesetName: iv(ts, '@tileset_name') as string,
      autotileNames: (iv(ts, '@autotile_names') as string[]) ?? [],
      passable: (id) => ((pass[id] ?? 0) & 0x0f) !== 0x0f,
      priority: (id) => prio[id] ?? 0,
      terrainTag: (id) => terr[id] ?? 0,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run web/overworld/maps/rmxp.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/overworld/maps/rmxp.ts web/overworld/maps/rmxp.test.ts
git commit -m "feat(maps): RMXP tileset decode — passages, priorities, terrain tags"
```

---

## Task 5: MapV2 format + converter (passability, encounters, warps, triggers)

**Files:**
- Create: `web/overworld/maps/mapv2.ts`
- Create: `web/overworld/maps/convert.ts`
- Test: `web/overworld/maps/convert.test.ts`

Tile-id rule: `0` empty; `48..383` autotile (`slot = id // 48 - 1`, `sub = id % 48`); `384+` plain (`index = id - 384`). A cell's effective tile is the **topmost non-zero** of its 3 z-layers; passability/priority/terrain use that tile id. Encounters: a cell is grass if its terrain tag equals the configured `grassTerrainTag` (Essentials default for tall grass is `1`; the converter takes it as an option, default 1). Warps/triggers are derived from events in Task 6; this task emits empty `warps`/`triggers` and is extended there.

- [ ] **Step 1: Write the failing test**

```ts
// web/overworld/maps/convert.test.ts
import { describe, it, expect } from 'vitest';
import { convertMap } from './convert';
import type { RpgMap, RpgTileset } from './rmxp';

function fakeMap(): RpgMap {
  // 2x1, 3 layers. cell(0,0): layer0=384(plain), layer1=0, layer2=0 -> top=384
  //                 cell(1,0): layer0=48(autotile slot0), others 0 -> top=48
  const cells = new Int16Array([384, 48,  0, 0,  0, 0]); // z0:[384,48] z1:[0,0] z2:[0,0]
  return {
    width: 2, height: 1, tilesetId: 1, events: [],
    data: { xsize: 2, ysize: 1, zsize: 3, cells, at: (x,y,z)=>cells[z*2*1 + y*2 + x] },
  };
}
const fakeTileset = (): RpgTileset => ({
  tilesetName: 'Outside', autotileNames: ['Grass','','','','','',''],
  passable: (id) => id !== 384,     // 384 is a wall, 48 (grass) passable
  priority: () => 0,
  terrainTag: (id) => (id === 48 ? 1 : 0),  // grass autotile has terrain tag 1
});

describe('convertMap', () => {
  it('builds layers, passability and encounters from top tile', () => {
    const m = convertMap(fakeMap(), fakeTileset(), { id: 'test', spawn: { x: 0, y: 0 } });
    expect(m.width).toBe(2);
    expect(m.tileset).toBe('Outside');
    expect(m.autotiles[0]).toBe('Grass');
    expect(m.layers[0][0]).toEqual([384, 48]);   // layer0 row0
    expect(m.passages[0]).toEqual([false, true]); // 384 blocked, 48 passable
    expect(m.encounters[0]).toEqual([false, true]); // only grass cell
    expect(m.warps).toEqual([]);
    expect(m.triggers).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run web/overworld/maps/convert.test.ts`
Expected: FAIL — `convertMap` not defined.

- [ ] **Step 3: Write the implementation**

```ts
// web/overworld/maps/mapv2.ts
export interface Warp { x: number; y: number; toMap: string; toX: number; toY: number; }
export interface Trigger { x: number; y: number; kind: 'gym'|'shop'|'center'|'npc'|'sign'; ref?: string; }
export interface MapV2 {
  id: string; width: number; height: number;
  tileset: string; autotiles: string[];
  layers: number[][][];     // [3][height][width] tile IDs
  passages: boolean[][];    // [height][width]
  priorities: number[][];   // [height][width]
  warps: Warp[];
  triggers: Trigger[];
  encounters: boolean[][];  // [height][width]
  spawn: { x: number; y: number };
}
```

```ts
// web/overworld/maps/convert.ts
import type { RpgMap, RpgTileset } from './rmxp';
import type { MapV2 } from './mapv2';

export interface ConvertOpts { id: string; spawn: { x: number; y: number }; grassTerrainTag?: number; }

export function convertMap(map: RpgMap, ts: RpgTileset, opts: ConvertOpts): MapV2 {
  const { width: w, height: h } = map;
  const grassTag = opts.grassTerrainTag ?? 1;
  const layers: number[][][] = [0,1,2].map((z) =>
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run web/overworld/maps/convert.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/overworld/maps/mapv2.ts web/overworld/maps/convert.ts web/overworld/maps/convert.test.ts
git commit -m "feat(maps): MapV2 format + converter (layers, passability, encounters)"
```

---

## Task 6: Event → warps + triggers (semantics bridge)

**Files:**
- Modify: `web/overworld/maps/convert.ts`
- Modify: `web/overworld/maps/convert.test.ts`

RMXP event command codes used by Essentials: a **TransferPlayer** command (code `201`) carries `[mapId, x, y, dir, fade]` in its parameters — this is a warp. We map the RMXP numeric `mapId` to our location id via an `opts.mapIdToLocation` lookup. Other interactable events become `npc` triggers; events whose name contains `Mart`/`PokeCenter`/`Gym` (case-insensitive) become `shop`/`center`/`gym` triggers (the converter's mapping is intentionally coarse; SP-4 refines).

- [ ] **Step 1: Write the failing test**

```ts
// append to web/overworld/maps/convert.test.ts
function eventWithTransfer(x:number,y:number,toMapId:number,tx:number,ty:number) {
  // page.@list = [ RPG::EventCommand(code:201, parameters:[0,toMapId,tx,ty,0,0]) ]
  const cmd = { __class:'RPG::EventCommand', ivars: { '@code':201, '@parameters':[0,toMapId,tx,ty,0,0] } };
  const page = { __class:'RPG::Event::Page', ivars: { '@list':[cmd] } };
  return { x, y, name:'door', pages:[page] };
}
function eventNpc(x:number,y:number,name:string) {
  const page = { __class:'RPG::Event::Page', ivars: { '@list':[] } };
  return { x, y, name, pages:[page] };
}

describe('convertMap events', () => {
  it('turns TransferPlayer events into warps via mapId->location', () => {
    const m = convertMap({ ...fakeMap(), events: [eventWithTransfer(1,0, 17, 5, 6)] }, fakeTileset(),
      { id:'test', spawn:{x:0,y:0}, mapIdToLocation: { 17: 'cerulean-deep-mart' } });
    expect(m.warps).toEqual([{ x:1, y:0, toMap:'cerulean-deep-mart', toX:5, toY:6 }]);
  });
  it('classifies named events into triggers', () => {
    const m = convertMap({ ...fakeMap(), events: [eventNpc(0,0,'Poke Mart Clerk'), eventNpc(1,0,'Old Man')] },
      fakeTileset(), { id:'test', spawn:{x:0,y:0} });
    expect(m.triggers).toEqual([
      { x:0, y:0, kind:'shop' },
      { x:1, y:0, kind:'npc', ref:'Old Man' },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run web/overworld/maps/convert.test.ts`
Expected: FAIL — warps/triggers still empty; new `mapIdToLocation` option unused.

- [ ] **Step 3: Write the implementation**

Extend `ConvertOpts` and replace the `warps: []`/`triggers: []` lines:

```ts
// in ConvertOpts add:
  mapIdToLocation?: Record<number, string>;

// add helpers + replace warps/triggers construction in convertMap:
const iv = (o: any, k: string) => o?.ivars?.[k];
function firstList(ev: any): any[] {
  const page = (ev.pages ?? [])[0];
  return (iv(page, '@list') as any[]) ?? [];
}
function transferOf(ev: any): { toMapId: number; x: number; y: number } | null {
  for (const cmd of firstList(ev)) {
    if (iv(cmd, '@code') === 201) {
      const p = iv(cmd, '@parameters') as number[];
      return { toMapId: p[1], x: p[2], y: p[3] };
    }
  }
  return null;
}
function triggerKind(name: string): { kind: MapV2['triggers'][number]['kind']; ref?: string } {
  const n = name.toLowerCase();
  if (n.includes('mart')) return { kind: 'shop' };
  if (n.includes('center') || n.includes('pokecenter') || n.includes('nurse')) return { kind: 'center' };
  if (n.includes('gym') || n.includes('leader')) return { kind: 'gym' };
  if (n.includes('sign')) return { kind: 'sign' };
  return { kind: 'npc', ref: name };
}

const warps: MapV2['warps'] = [];
const triggers: MapV2['triggers'] = [];
for (const ev of map.events) {
  const t = transferOf(ev);
  if (t) {
    const toMap = opts.mapIdToLocation?.[t.toMapId];
    if (toMap) warps.push({ x: ev.x, y: ev.y, toMap, toX: t.x, toY: t.y });
    continue;
  }
  if (ev.name) { const { kind, ref } = triggerKind(ev.name); triggers.push({ x: ev.x, y: ev.y, kind, ...(ref ? { ref } : {}) }); }
}
```

Then return `warps, triggers` instead of the empty arrays.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run web/overworld/maps/convert.test.ts`
Expected: PASS (all convert tests).

- [ ] **Step 5: Commit**

```bash
git add web/overworld/maps/convert.ts web/overworld/maps/convert.test.ts
git commit -m "feat(maps): events -> warps + classified triggers"
```

---

## Task 7: Autotile quadrant table

**Files:**
- Create: `web/overworld/maps/autotile.ts`
- Test: `web/overworld/maps/autotile.test.ts`

An RMXP autotile graphic is 96×128 px = a grid of 16×16 quarter-tiles (6 columns × 8 rows). A 32×32 cell is assembled from 4 quarter-tiles (TL, TR, BL, BR). The 48 connectivity sub-patterns (`id % 48`) each select 4 quarter-tile indices (0..47, row-major in the 6×8 grid). This table is the canonical RMXP autotile layout.

- [ ] **Step 1: Write the failing test**

```ts
// web/overworld/maps/autotile.test.ts
import { describe, it, expect } from 'vitest';
import { AUTOTILE_TABLE, autotileQuads } from './autotile';

describe('autotile table', () => {
  it('has 48 entries, each 4 quarter-indices in range 0..47', () => {
    expect(AUTOTILE_TABLE).toHaveLength(48);
    for (const quad of AUTOTILE_TABLE) {
      expect(quad).toHaveLength(4);
      for (const q of quad) { expect(q).toBeGreaterThanOrEqual(0); expect(q).toBeLessThanOrEqual(47); }
    }
  });
  it('sub-pattern 0 is the fully-surrounded centre tile (quads 26,27,32,33)', () => {
    expect(autotileQuads(0)).toEqual([26, 27, 32, 33]);
  });
  it('maps a 16x16 quarter index to source px (col,row in 6-wide grid)', () => {
    // helper exported for the renderer
    const { quarterSrc } = require('./autotile');
    expect(quarterSrc(0)).toEqual({ sx: 0, sy: 0 });
    expect(quarterSrc(7)).toEqual({ sx: 16, sy: 16 }); // index7 -> col1,row1
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run web/overworld/maps/autotile.test.ts`
Expected: FAIL — `autotile` module not defined.

- [ ] **Step 3: Write the implementation**

```ts
// web/overworld/maps/autotile.ts
// Canonical RMXP autotile sub-pattern table.
// Each of the 48 patterns -> [TL, TR, BL, BR] quarter-tile indices into a
// 6-column grid of 16x16 quarters (index = row*6 + col).
export const AUTOTILE_TABLE: ReadonlyArray<readonly [number, number, number, number]> = [
  [26,27,32,33],[ 4,27,32,33],[26, 5,32,33],[ 4, 5,32,33],
  [26,27,32,11],[ 4,27,32,11],[26, 5,32,11],[ 4, 5,32,11],
  [26,27,10,33],[ 4,27,10,33],[26, 5,10,33],[ 4, 5,10,33],
  [26,27,10,11],[ 4,27,10,11],[26, 5,10,11],[ 4, 5,10,11],
  [24,25,30,31],[24, 5,30,31],[24,25,30,11],[24, 5,30,11],
  [14,15,20,21],[14,15,20,11],[14,15,10,21],[14,15,10,11],
  [28,29,34,35],[28,29,10,35],[ 4,29,34,35],[ 4,29,10,35],
  [38,39,44,45],[ 4,39,44,45],[38, 5,44,45],[ 4, 5,44,45],
  [24,29,30,35],[14,15,44,45],[12,13,18,19],[12,13,18,11],
  [16,17,22,23],[16,17,10,23],[28,33,34,39],[ 4,17,10,23],
  [12,17,18,23],[12,13,42,43],[36,37,42,43],[36,17,42,23],
  [12,17,42,23],[36,37,18,19],[16,21,22,27],[40,41,46,47],
];

export function autotileQuads(sub: number): readonly [number, number, number, number] {
  return AUTOTILE_TABLE[sub] ?? AUTOTILE_TABLE[0];
}

// quarter index -> source pixel in the 6-col × 8-row grid of 16px quarters
export function quarterSrc(q: number): { sx: number; sy: number } {
  return { sx: (q % 6) * 16, sy: Math.floor(q / 6) * 16 };
}
```

> The table above is the standard RMXP layout (same one used by RPG Maker XP and ports such as `rpgmaker-autotiles`). Its correctness is pinned structurally by the unit test and verified pixel-accurately on screen in Task 9 (the spike) against the Essentials editor; if a grass map shows wrong edges, the per-row values are corrected there.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run web/overworld/maps/autotile.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/overworld/maps/autotile.ts web/overworld/maps/autotile.test.ts
git commit -m "feat(maps): RMXP autotile quadrant table + source mapping"
```

---

## Task 8: Offline converter CLI + extract Essentials data

**Files:**
- Create: `tools/essentials-import/run.ts`
- Modify: `.gitignore`
- Create: `web/overworld/maps/__fixtures__/sample-map.rxdata` (committed test fixture)

The CLI reads an already-extracted Essentials install dir, parses `Tilesets.rxdata` + each requested `Map###.rxdata`, runs `convertMap`, writes `web/public/maps/<id>.json`, and copies the tileset + autotile PNGs the map needs into `web/public/2d/tilesets/`.

- [ ] **Step 1: Extract the Essentials install + a fixture**

```bash
# one-time: unzip the install into a gitignored working dir
mkdir -p .essentials
cd "$(git rev-parse --show-toplevel)"
unzip -o "Pokemon Essentials v21.1 2023-07-30.zip" -d .essentials >/dev/null
# copy one small map as a committed test fixture
mkdir -p web/overworld/maps/__fixtures__
cp ".essentials/Pokemon Essentials v21.1 2023-07-30/Data/Map003.rxdata" web/overworld/maps/__fixtures__/sample-map.rxdata
```

Add to `.gitignore`:
```
.essentials/
web/public/2d/tilesets/
```

- [ ] **Step 2: Write the failing fixture test**

```ts
// web/overworld/maps/rmxp.fixture.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { readMarshal } from './marshal';
import { toRpgMap } from './rmxp';

describe('real Essentials map fixture', () => {
  it('parses sample-map.rxdata to a sane RPG::Map', () => {
    const buf = readFileSync(new URL('./__fixtures__/sample-map.rxdata', import.meta.url));
    const m = toRpgMap(readMarshal(new Uint8Array(buf)));
    expect(m.width).toBeGreaterThan(0);
    expect(m.height).toBeGreaterThan(0);
    expect(m.data.zsize).toBe(3);
    expect(m.tilesetId).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run it — surfaces any unhandled Marshal tag on real data**

Run: `npx vitest run web/overworld/maps/rmxp.fixture.test.ts`
Expected: PASS. If it throws `unhandled marshal tag 0x40` (object ref) or similar, add the missing handler to `marshal.ts` (object/symbol cache + `@`/`;` link), re-run until green. This is the planned de-risk point for the Marshal reader.

- [ ] **Step 4: Write the CLI**

```ts
// tools/essentials-import/run.ts
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { readMarshal } from '../../web/overworld/maps/marshal';
import { toRpgMap, toTilesets } from '../../web/overworld/maps/rmxp';
import { convertMap, type ConvertOpts } from '../../web/overworld/maps/convert';

// manifest: which Essentials map number -> our location, with spawn + mapId links
interface Entry extends Omit<ConvertOpts, 'id'> { mapNo: number; }
const INSTALL = process.argv[2] ?? '.essentials/Pokemon Essentials v21.1 2023-07-30';
const OUT_MAPS = 'web/public/maps';
const OUT_TILES = 'web/public/2d/tilesets';
const GFX_TILES = join(INSTALL, 'Graphics/Tilesets');
const GFX_AUTO = join(INSTALL, 'Graphics/Autotiles');

function load(p: string) { return readMarshal(new Uint8Array(readFileSync(p))); }

export function run(manifest: Record<string, Entry>): void {
  mkdirSync(OUT_MAPS, { recursive: true });
  mkdirSync(OUT_TILES, { recursive: true });
  const tilesets = toTilesets(load(join(INSTALL, 'Data/Tilesets.rxdata')) as any[]);
  for (const [id, e] of Object.entries(manifest)) {
    const no = String(e.mapNo).padStart(3, '0');
    const map = toRpgMap(load(join(INSTALL, `Data/Map${no}.rxdata`)));
    const ts = tilesets[map.tilesetId];
    if (!ts) throw new Error(`no tileset ${map.tilesetId} for ${id}`);
    const v2 = convertMap(map, ts, { id, spawn: e.spawn, grassTerrainTag: e.grassTerrainTag, mapIdToLocation: e.mapIdToLocation });
    writeFileSync(join(OUT_MAPS, `${id}.json`), JSON.stringify(v2));
    try { copyFileSync(join(GFX_TILES, `${ts.tilesetName}.png`), join(OUT_TILES, `${ts.tilesetName}.png`)); } catch {}
    for (const a of ts.autotileNames) { if (a) try { copyFileSync(join(GFX_AUTO, `${a}.png`), join(OUT_TILES, `${a}.png`)); } catch {} }
    console.log(`wrote ${id}.json (${v2.width}x${v2.height}, ${v2.warps.length} warps)`);
  }
}

// example invocation (the real Arc-1 manifest is filled in Task 11)
if (process.argv[1]?.endsWith('run.ts')) {
  run({ 'sample': { mapNo: 3, spawn: { x: 5, y: 5 } } });
}
```

- [ ] **Step 5: Smoke-run the CLI**

Run: `npx tsx tools/essentials-import/run.ts`
Expected: prints `wrote sample.json (...)`; `web/public/maps/sample.json` exists and copies a tileset PNG. Commit.

```bash
git add tools/essentials-import/run.ts .gitignore web/overworld/maps/__fixtures__/sample-map.rxdata web/overworld/maps/rmxp.fixture.test.ts
git commit -m "feat(maps): offline Essentials converter CLI + real-map fixture test"
```

---

## Task 9: Renderer — draw MapV2 (plain tiles + autotiles) [SPIKE: verify on screen]

**Files:**
- Modify: `web/overworld/overworld2d.ts`
- Modify: `web/overworld/maps/slice.ts` (add `toMapV2` adapter for the 3 existing maps)
- Modify: `server/session.ts` (send `MapV2` for the `sample` map behind a temporary route, just to view it)

This is the look-critical task. Render the converted `sample` map on screen and compare to the Essentials editor. Plain tile `id>=384` → `((id-384)%8, (id-384)//8)` in the tileset PNG (32px). Autotile `48<=id<384` → `slot=id//48-1`, `sub=id%48`; assemble 4 quarters via `autotileQuads(sub)`/`quarterSrc`.

- [ ] **Step 1: Add the render helpers (no test — visual component)**

In `overworld2d.ts`, load `this.tilesetImg` from `/2d/tilesets/<map.tileset>.png` and `this.autotileImgs[name]` per `map.autotiles`. Add:

```ts
private drawTileId(ctx: CanvasRenderingContext2D, id: number, dx: number, dy: number): void {
  if (id <= 0) return;
  const C = 48, SRC = 32, Q = SRC / 2, DQ = C / 2;
  if (id >= 384) {
    const t = id - 384, sx = (t % 8) * SRC, sy = Math.floor(t / 8) * SRC;
    ctx.drawImage(this.tilesetImg, sx, sy, SRC, SRC, dx, dy, C, C);
    return;
  }
  const slot = Math.floor(id / 48) - 1, sub = id % 48;
  const img = this.autotileImgs[this.curMap.autotiles[slot]];
  if (!img || !img.complete) return;
  const quads = autotileQuads(sub);
  const dq = [[0,0],[DQ,0],[0,DQ],[DQ,DQ]];
  for (let i = 0; i < 4; i++) {
    const { sx, sy } = quarterSrc(quads[i]);
    ctx.drawImage(img, sx, sy, Q, Q, dx + dq[i][0], dy + dq[i][1], DQ, DQ);
  }
}
```

Render order per visible cell: layers 0→2 with `drawTileId`; defer cells whose `priorities[y][x] > 0` to a post-player pass so the player walks behind tree tops.

- [ ] **Step 2: Wire `sample` map end-to-end for viewing**

Add a temporary server branch so `locationId==='sample'` loads `web/public/maps/sample.json` via `loadMapV2` (Task 10 provides it; for the spike, inline a `JSON.parse(readFileSync(...))`). Point the dev start at `sample`.

- [ ] **Step 3: Verify on screen**

Run: `npm run dev`, open `http://localhost:5173`, navigate the `sample` map.
Expected: the map matches the Essentials editor — grass/path/water autotile edges join correctly, walls block movement, tree tops draw over the player. If autotile edges are wrong, correct the per-row values in `AUTOTILE_TABLE` (Task 7) and re-verify. **Do not proceed until it looks correct.**

- [ ] **Step 4: Commit**

```bash
git add web/overworld/overworld2d.ts web/overworld/maps/slice.ts server/session.ts
git commit -m "feat(maps): full-fidelity MapV2 renderer (plain tiles + autotiles) — verified on screen"
```

---

## Task 10: Server loads MapV2 + generalized warps

**Files:**
- Create: `web/overworld/maps/loader.ts`
- Modify: `server/session.ts`

Replace `SLICE_MAPS[id]` lookup with `loadMapV2(id)` (falling back to the `slice.ts` `toMapV2` adapter for the 3 hand-authored maps), and generalize `move()`'s `exitTo` into warp handling driven by `MapV2.warps`; grass encounters key off `MapV2.encounters[y][x]`; triggers off `MapV2.triggers`.

- [ ] **Step 1: Write the failing test**

```ts
// web/overworld/maps/loader.test.ts
import { describe, it, expect } from 'vitest';
import { warpAt, encounterAt } from './loader';
import type { MapV2 } from './mapv2';

const m: MapV2 = {
  id:'t', width:2, height:1, tileset:'Outside', autotiles:[],
  layers:[[[0,0]],[[0,0]],[[0,0]]], passages:[[true,true]], priorities:[[0,0]],
  warps:[{ x:1,y:0,toMap:'inside',toX:3,toY:4 }], triggers:[], encounters:[[false,true]],
  spawn:{x:0,y:0},
};
describe('loader helpers', () => {
  it('finds a warp at a cell', () => {
    expect(warpAt(m,1,0)).toEqual({ x:1,y:0,toMap:'inside',toX:3,toY:4 });
    expect(warpAt(m,0,0)).toBeNull();
  });
  it('reports encounter cells', () => {
    expect(encounterAt(m,1,0)).toBe(true);
    expect(encounterAt(m,0,0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run web/overworld/maps/loader.test.ts`
Expected: FAIL — `loader` not defined.

- [ ] **Step 3: Write the loader + wire the server**

```ts
// web/overworld/maps/loader.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MapV2, Warp } from './mapv2';

const cache = new Map<string, MapV2>();
export function loadMapV2(id: string): MapV2 {
  if (!cache.has(id)) {
    const raw = readFileSync(join(process.cwd(), 'web/public/maps', `${id}.json`), 'utf8');
    cache.set(id, JSON.parse(raw) as MapV2);
  }
  return cache.get(id)!;
}
export function warpAt(m: MapV2, x: number, y: number): Warp | null {
  return m.warps.find((w) => w.x === x && w.y === y) ?? null;
}
export function encounterAt(m: MapV2, x: number, y: number): boolean {
  return !!m.encounters[y]?.[x];
}
export function walkableAt(m: MapV2, x: number, y: number): boolean {
  return y >= 0 && y < m.height && x >= 0 && x < m.width && !!m.passages[y]?.[x];
}
```

In `server/session.ts` `move()`: after computing `nx,ny`, use `walkableAt(m,nx,ny)`; on the new cell check `warpAt` → set `locationId=warp.toMap; px=warp.toX; py=warp.toY`; check `encounterAt` → roll encounter; check `m.triggers` at the cell for `gym`/`shop`/`center`. Keep the existing `slice.ts` maps working through `toMapV2`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run web/overworld/maps/loader.test.ts && npx vitest run`
Expected: loader tests PASS; full suite (190 + new) still green.

- [ ] **Step 5: Commit**

```bash
git add web/overworld/maps/loader.ts web/overworld/maps/loader.test.ts server/session.ts
git commit -m "feat(maps): server loads MapV2 + generalized warps/encounters/triggers"
```

---

## Task 11: Arc-1 manifest + first imported map walkable

**Files:**
- Modify: `tools/essentials-import/run.ts` (real manifest)
- Create: `web/public/maps/*.json` (generated)

Choose Essentials maps that fit Arc-1 locations and wire one fully (`cerulean-deep` — a coastal town) including its interiors, proving the warp loop town↔building.

- [ ] **Step 1: Pick maps + write the manifest**

Inspect `.essentials/.../Data/MapInfos.rxdata` names (via a tiny script using `readMarshal`) and choose a beach/coast town map for `cerulean-deep`, plus its mart/center interiors. Fill the manifest in `run.ts` with `mapNo`, `spawn`, and `mapIdToLocation` linking the town's door events to the interior location ids.

- [ ] **Step 2: Run the converter**

Run: `npx tsx tools/essentials-import/run.ts ".essentials/Pokemon Essentials v21.1 2023-07-30"`
Expected: writes `cerulean-deep.json` + interior jsons + copies their tileset/autotile PNGs.

- [ ] **Step 3: Verify the warp loop on screen**

Temporarily set the player's start to `cerulean-deep`, `npm run dev`, walk in: enter the mart door (warp to interior), walk onto the exit mat (warp back), step in grass (encounter fires), bump a wall (blocked).
Expected: all four behave correctly.

- [ ] **Step 4: Commit**

```bash
git add tools/essentials-import/run.ts web/public/maps/*.json
git commit -m "feat(maps): Arc-1 manifest — cerulean-deep imported, warp loop verified"
```

---

## Self-Review

**Spec coverage:**
- Converter (offline tool) → Tasks 1–8, 11. ✓
- Map format v2 → Task 5 (`mapv2.ts`). ✓
- Full-fidelity renderer incl. autotiles → Tasks 7, 9. ✓
- Warps + interiors → Tasks 6, 10, 11. ✓
- Semantics bridge (terrain-tag encounters + event triggers) → Tasks 5, 6. ✓
- Spike-first de-risk → Task 8 (Marshal on real data) + Task 9 (autotiles on screen). ✓
- Testing (converter unit tests; renderer visual; 190 engine tests intact) → throughout; Task 10 re-runs full suite. ✓
- Out-of-scope SP-2/3/4 → not present. ✓

**Type consistency:** `MapV2`, `Warp`, `Trigger` (Task 5/`mapv2.ts`) reused unchanged in Tasks 6/9/10. `RpgMap`/`RpgTileset`/`RmxpTable`/`decodeTable`/`toRpgMap`/`toTilesets` (Tasks 3–4) consumed in Tasks 5/8. `convertMap`/`ConvertOpts` (Task 5) extended in Task 6, called in Task 8. `autotileQuads`/`quarterSrc`/`AUTOTILE_TABLE` (Task 7) used in Task 9. `loadMapV2`/`warpAt`/`encounterAt`/`walkableAt` (Task 10) used in Task 10's server wiring. Consistent.

**Placeholder scan:** every code step has complete code or complete tests; the two algorithmic risks (Marshal completeness, autotile table accuracy) each have an explicit on-real-data verification step (8.3, 9.3) rather than a hand-wave. No TBD/"handle edge cases".

**Known soft spot (acknowledged, not a placeholder):** the `AUTOTILE_TABLE` values and the exact `passable` bit rule are validated on real Essentials data in Tasks 8–9; if a real map disagrees, those two spots are corrected there. This is the intended purpose of the spike-first order.
