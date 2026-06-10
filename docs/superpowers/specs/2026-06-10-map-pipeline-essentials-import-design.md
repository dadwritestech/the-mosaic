# Map Pipeline — Essentials Import → Full-Fidelity Render → Warps/Interiors

**Status:** Design approved 2026-06-10. Ready for implementation plan.

**Sub-project:** SP-1 of the "realize the Mosaic region" effort. This is the foundation; SP-2 (dialogue + event/flag system), SP-3 (overworld trainers), and SP-4 (Arc 1 content authoring) all depend on it and are out of scope here.

---

## Goal

Convert hand-crafted Pokémon Essentials (RPG Maker XP) maps into a format our game loads, render them faithfully — including autotiles — and support warping between exterior and interior maps so towns become enterable. This makes producing all 15 Mosaic locations cheap; the immediate consumer is **Arc 1** (Aethel's Rest → Whispering Path → Verdant Hollow → Verdant Tangle → Cerulean Deep → Tidal Drift → Ember Peak).

We harvest Essentials map **geometry and tilesets**, not its demo region's identity. A converted map is assigned to one of our locations and repopulated with our gym/NPC/encounter data (the latter wiring is SP-2/SP-4).

## Context — what exists today

- Maps today: `web/overworld/maps/slice.ts` exports `SLICE_MAPS[locationId]` of type `TileMap = { tiles: Tile[][]; spawn: {x,y} }`, where `Tile` is a small semantic union (`'field' | 'grass' | 'wall' | 'path' | 'shop' | 'center' | 'gym' | 'exit' | 'npc' | ...`). Only 3 locations have maps: `aethels-rest`, `whispering-path`, `verdant-hollow`.
- Server: `server/session.ts` `map()` returns `SLICE_MAPS[this.locationId]`; `view()` sends `tiles` + player position; `move()` handles `exitTo` (location transition), `tileAt`/`metaAt`/`isWalkable`, and tile triggers (`center` heals, `shop` → `openShop()`, `grass` → encounter roll).
- Renderer: `web/overworld/overworld2d.ts` (Canvas2D) draws a single ground layer + an object layer from `web/public/2d/Outside.png` (the Essentials outdoor tileset, 32px source tiles) using a `tile → [row,col]` lookup, `CELL=48`. Already does smooth walk, camera easing, day/night tint, grass flecks.
- The engine in `src/` (battles, encounters, leveling) is untouched by this sub-project.

## The Essentials source (verified)

Install: `Pokemon Essentials v21.1 2023-07-30.zip` at the project root (7,678 entries). Relevant data:
- `Data/Map001.rxdata` … `Map069.rxdata` — 69 maps, **Ruby Marshal v4.8** (magic bytes `04 08`). Confirmed to contain `RPG::Map`, `Table`, `RPG::Event` class markers.
- `Data/MapInfos.rxdata` — map id → name / tree order.
- `Data/Tilesets.rxdata` — tileset definitions: tileset graphic name, autotile graphic names, **`@passages`** (per-tile-ID walkability bitflags), `@priorities`, `@terrain_tags`.
- `Graphics/Tilesets/*.png` — 23 tileset images; `Graphics/Autotiles/*.png` — autotile source images.

### RMXP map structure (what the converter reads)
- `RPG::Map`: `@width`, `@height`, `@data` (a `Table` = flat array of `width × height × 3` little-endian 16-bit **tile IDs**, three z-layers), `@events` (hash of `RPG::Event`).
- Tile ID encoding: `0` = empty; `48..383` = **autotiles** (8 autotile slots × 48 sub-patterns; `id // 48` selects the slot, `id % 48` selects the connectivity sub-pattern); `384+` = **regular tileset tiles**, where `tileIndex = id - 384`, `col = tileIndex % 8`, `row = tileIndex // 8` into the tileset PNG (8 tiles per row).
- `RPG::Event`: `@x`, `@y`, `@pages[]`; each page has `@graphic` (NPC sprite), `@list` (command list — dialogue, transfer-player/warp, etc.). Warps and NPC interactions live here.
- Walkability: from `Tilesets.rxdata @passages[tileId]` (bit 0x0f = directional block; a tile is blocked if the passage byte has the impassable bit). Top layer priority also matters for over/under-player draw.

## Architecture — five components

### 1. Converter (offline tool) — `tools/essentials-import/`
A Node/tsx script, **not** in the game's runtime path. Inputs: the Essentials install path + a manifest of which maps to import. Outputs: one map JSON per location into `web/public/maps/<location>.json`, and the needed tileset/autotile PNGs copied into `web/public/2d/tilesets/`.

Steps:
1. Pure-JS Ruby-Marshal parse (library: `@hyrious/marshal` or equivalent — vendored/added as a dev dependency; the spike validates the choice).
2. Read `Tilesets.rxdata` once → tileset table (graphic name, autotile names, passages, priorities, terrain_tags) keyed by tileset id.
3. For each requested `Map###.rxdata`: extract `@width/@height/@data/@events` and its `tileset_id`.
4. Emit Map format v2 (below): the 3 tile-ID layers verbatim, a derived `passages` boolean grid, `warps` and `triggers` extracted from events, and `encounters` cells derived from terrain tags.

The converter is deterministic and unit-tested against a known map.

### 2. Map format v2 — `web/overworld/maps/types.ts`
```
interface MapV2 {
  id: string;                 // our location id, e.g. 'cerulean-deep'
  width: number; height: number;
  tileset: string;            // tileset png basename, e.g. 'Outside'
  autotiles: string[];        // up to 7 autotile png basenames (slot order)
  layers: number[][][];       // [3][height][width] raw RMXP tile IDs
  passages: boolean[][];      // [height][width] true = walkable
  priorities: number[][];     // [height][width] draw-over-player flag (from top non-zero tile)
  warps: { x: number; y: number; toMap: string; toX: number; toY: number }[];
  triggers: { x: number; y: number; kind: 'gym'|'shop'|'center'|'npc'|'sign'; ref?: string }[];
  encounters: boolean[][];    // [height][width] true = tall-grass cell (encounter roll)
  spawn: { x: number; y: number };
}
```
Old `TileMap` stays for the 3 existing maps during migration; a thin adapter lets the renderer accept either until all maps are v2 (the 3 originals get reconverted or hand-ported last).

### 3. Full-fidelity renderer — `web/overworld/overworld2d.ts` upgrade
- Load the map's tileset PNG + autotile PNGs (cache by name).
- Draw layers 0→2 bottom-to-top per visible cell:
  - **Plain tile** (`id >= 384`): blit `(col,row)` from the tileset PNG.
  - **Autotile** (`48 <= id < 384`): implement the RMXP autotile algorithm. Each autotile PNG is a 96×128 sheet of corner quadrants; the `id % 48` sub-pattern maps to a fixed table of four 16×16 corner source rects assembled into the 32×32 cell. Ship the standard 48-entry lookup table (well-documented; included verbatim in the plan).
- Respect `priorities` for tiles that draw over the player (e.g., tree tops, building fronts) by deferring them to the post-player pass.
- The player, camera, day/night, and existing polish stay. `CELL` stays 48 (source 32 → 48 scale, `imageRendering:pixelated`).

This component is **look-critical**: verified on screen against how the map appears in the Essentials/RMXP editor, not accepted blind.

### 4. Warps + interiors — `server/session.ts`
- Generalize the current `exitTo` handling: when the player steps on a tile that matches a `warps[]` entry, set `locationId = toMap`, `px/py = toX/toY`, return the new view. Interiors are just maps with their own id (`cerulean-deep-mart`, `cerulean-deep-center`, `verdant-hollow-gym`, house interiors).
- `visitedLocations` already tracks entry; warps feed it.
- Town exterior building doors are `warp` triggers; interior exit mats warp back. No special-casing of building types in the renderer.

### 5. Semantics bridge (in the converter)
- **Encounters:** tiles whose tileset `terrain_tag` marks tall grass → `encounters[y][x] = true`. The server's existing `grass` encounter roll keys off this instead of the `'grass'` tile literal.
- **Triggers:** Essentials warp/transfer events on a Mart/Center/Gym door → `triggers` with `kind` + a `ref` (e.g., shop id, gym id). The converter uses a small mapping table (event name/graphic → kind); ambiguous events are emitted as `npc` and resolved during SP-4 authoring.
- This keeps the existing battle/shop/heal code working by feeding it the same signals through a different derivation.

## Data flow
```
Essentials install  ──(offline converter)──▶  web/public/maps/<loc>.json
                                              web/public/2d/tilesets/*.png
                                                      │ (runtime)
                                      server/session.ts loads <loc>.json for current location
                                                      │ sends MapV2 in view
                                      overworld2d.ts renders 3 layers + autotiles + player
                                                      │ player steps
                                      warp tile → server swaps map; grass cell → encounter roll
```

## Build order (de-risk first)
1. **Spike:** parse one `Map###.rxdata` and render it on screen (Marshal + plain tiles + autotiles + tileset PNG) — proves the two unknowns end-to-end before building the pipeline. Throwaway-quality allowed.
2. Converter proper (Marshal → MapV2, with unit tests).
3. Renderer upgrade to MapV2 (replacing the spike's throwaway code) + priority/over-player pass.
4. Warps + interiors in the server.
5. Semantics bridge (terrain-tag encounters + event triggers).
6. Arc-1 manifest: choose Essentials maps for the 4 unbuilt Arc-1 locations + their interiors, run the converter, walk them end-to-end.

## Risks
- **Autotile rendering** — the one genuinely fiddly piece. Mitigation: the spike implements it first; the 48-entry sub-pattern table is standard and included in the plan verbatim.
- **Ruby Marshal parsing** — mitigated by an existing JS library + the spike. If no library handles RMXP's `Table`/`RPG::*` user classes cleanly, the converter adds a thin custom reader for those specific types (the structures are simple and documented).
- **Event → trigger mapping is fuzzy** — accepted: ambiguous events fall back to `npc` and are finalized in SP-4. The converter never needs to be perfect, only close.

## Testing
- Converter: unit tests — a fixture `Map.rxdata` → asserted width/height, a known tile ID at a known cell, a known warp, a known grass cell.
- Renderer: visual verification on screen, compared against the map's appearance in the RMXP editor; checked for correct walkability (can't walk through walls) and correct over-player draw (walk behind tree tops).
- Regression: the existing 3 maps and the 190 `src/` engine tests must still pass; `src/` is not touched.

## Explicitly out of scope (later sub-projects)
- SP-2: richer dialogue, signs, flags/triggers beyond warps, rival scripting.
- SP-3: overworld line-of-sight trainers.
- SP-4: authoring the actual Arc-1 content (NPC text, rival team, gym teams, encounter tuning) on top of the imported maps.
- The full region bible (gyms 4–8, Elite Four) — locked as design but not realized until after Arc 1.

## Build vs delegate
Per the standing workflow, the local agent (pi) handles bulk/boilerplate (the converter scaffolding, MapV2 types, Marshal field plumbing) against exact specs; the look-critical autotile renderer is verified on screen by Claude, not accepted blind.
