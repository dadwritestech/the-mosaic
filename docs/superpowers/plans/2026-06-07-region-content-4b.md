# Region Content 4b Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete 8-badge region — authoritative PokéAPI data tables, the full map (8 gyms, routes, towns, encounters, trainers, shops, NPCs), and a region-integrity test suite that mechanically validates the bulk content.

**Architecture:** A committed Node script generates factual data tables from PokéAPI (Claude). `pi` authors the creative region content against the locked 4a schema + worldbuilding bible. A Claude-authored integrity suite is the executable contract the content must satisfy.

**Tech Stack:** Node (fetch), TypeScript, the 4a `src/content/*` schema + registry, Vitest, PokéAPI.

---

## Verified PokéAPI facts (probed 2026-06-07)

- `https://pokeapi.co/api/v2/pokemon-species/{num}` → `capture_rate` (0-255),
  `growth_rate.name`, `gender_rate`.
- `https://pokeapi.co/api/v2/pokemon/{num}` → `base_experience`, `stats[]` with
  `{ stat.name, effort }`. Stat names: `hp,attack,defense,special-attack,special-defense,speed`.
- 1025 base species. Growth names → our `GrowthGroup`: `slow→slow`, `medium→mediumfast`,
  `fast→fast`, `medium-slow→mediumslow`, `slow-then-very-fast→erratic`,
  `fast-then-very-slow→fluctuating`.

## Ownership

- **Claude:** Tasks 1-3, 5 (data script, key-normalization, integrity suite, wiring).
- **`pi`:** Task 4 (region content authoring, against the integrity suite as contract).

---

### Task 1: Shared key normalization

So generated table keys match Showdown species ids (`'Mr. Mime'`/`'mr-mime'` → `mrmime`).

**Files:** Create `src/data/normalize.ts`; Modify `src/data/catch-rates.ts`,
`src/game/exp-yield.ts`, `src/game/growth-rates.ts`; Test `src/data/normalize.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { toKey } from './normalize';

describe('toKey', () => {
  it('strips punctuation/spaces and lowercases', () => {
    expect(toKey('Pikachu')).toBe('pikachu');
    expect(toKey('Mr. Mime')).toBe('mrmime');
    expect(toKey('Farfetch’d')).toBe('farfetchd');
    expect(toKey('Nidoran-F')).toBe('nidoranf');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/data/normalize.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `normalize.ts` and use it in the lookups**

`src/data/normalize.ts`:
```ts
export function toKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}
```
In `src/data/catch-rates.ts`, change `baseCatchRate` to normalize:
```ts
import { toKey } from './normalize';
export function baseCatchRate(speciesId: string): number {
  return CATCH_RATES[toKey(speciesId)] ?? 45;
}
```
In `src/game/exp-yield.ts`:
```ts
import { toKey } from '../data/normalize';
export function baseExpYield(species: string): number {
  return EXP_YIELD[toKey(species)] ?? 100;
}
```
In `src/game/growth-rates.ts`:
```ts
import { toKey } from '../data/normalize';
export function growthRateOf(species: string): GrowthGroup {
  return GROUPS[toKey(species)] ?? 'mediumfast';
}
```
(Existing seeded keys like `pikachu`/`caterpie` are already normalized, so all current
tests keep passing.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/data/normalize.test.ts && npm test`
Expected: normalize tests pass; all 151 prior tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/data/normalize.ts src/data/normalize.test.ts src/data/catch-rates.ts src/game/exp-yield.ts src/game/growth-rates.ts
git commit -m "feat(data): shared toKey normalization for species table lookups"
```

---

### Task 2: PokéAPI data-generation script + full tables (Claude runs)

**Files:** Create `scripts/gen-data.mjs`; it (re)writes `src/data/catch-rates.ts`,
`src/game/exp-yield.ts`, `src/game/growth-rates.ts`, `src/data/ev-yield.ts`.
Test: `src/data/data-anchors.test.ts`

- [ ] **Step 1: Write the anchors test (known truths)**

```ts
import { describe, it, expect } from 'vitest';
import { baseCatchRate } from './catch-rates';
import { baseExpYield } from '../game/exp-yield';
import { growthRateOf } from '../game/growth-rates';
import { evYield } from './ev-yield';

describe('data anchors (sourced from PokeAPI)', () => {
  it('matches known catch rates', () => {
    expect(baseCatchRate('Pikachu')).toBe(190);
    expect(baseCatchRate('Caterpie')).toBe(255);
    expect(baseCatchRate('Dratini')).toBe(45);
  });
  it('matches known base exp', () => {
    expect(baseExpYield('Magikarp')).toBe(40);
    expect(baseExpYield('Pikachu')).toBe(112);
  });
  it('matches known growth groups', () => {
    expect(growthRateOf('Charizard')).toBe('mediumslow');
    expect(growthRateOf('Pikachu')).toBe('mediumfast');
  });
  it('matches known EV yields', () => {
    expect(evYield('Pikachu')).toEqual({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 2 });
    expect(evYield('Gyarados').atk).toBe(2);
  });
  it('covers the full dex (>1000 species)', () => {
    expect(Object.keys((require('./catch-rates').CATCH_RATES)).length).toBeGreaterThan(1000);
  });
});
```

- [ ] **Step 2: Write `scripts/gen-data.mjs`**

```js
// One-time generator: fetches the National Dex from PokeAPI and writes our data tables.
import { writeFileSync } from 'node:fs';

const MAX = 1025;
const GROWTH = { 'slow': 'slow', 'medium': 'mediumfast', 'fast': 'fast',
  'medium-slow': 'mediumslow', 'slow-then-very-fast': 'erratic', 'fast-then-very-slow': 'fluctuating' };
const STAT = { 'hp': 'hp', 'attack': 'atk', 'defense': 'def', 'special-attack': 'spa', 'special-defense': 'spd', 'speed': 'spe' };
const toKey = (n) => n.toLowerCase().replace(/[^a-z0-9]/g, '');

async function getJson(url) { const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }

async function fetchOne(num) {
  const [sp, pk] = await Promise.all([
    getJson(`https://pokeapi.co/api/v2/pokemon-species/${num}`),
    getJson(`https://pokeapi.co/api/v2/pokemon/${num}`),
  ]);
  const key = toKey(sp.name);
  const ev = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  for (const s of pk.stats) ev[STAT[s.stat.name]] = s.effort;
  return { key, catch: sp.capture_rate, exp: pk.base_experience ?? 100, growth: GROWTH[sp.growth_rate.name] ?? 'mediumfast', ev };
}

async function pool(nums, size, fn) {
  const out = []; let i = 0;
  async function worker() { while (i < nums.length) { const n = nums[i++]; try { out.push(await fn(n)); } catch (e) { console.error('skip', n, e.message); } } }
  await Promise.all(Array.from({ length: size }, worker));
  return out;
}

const rows = (await pool([...Array(MAX)].map((_, i) => i + 1), 12, fetchOne)).sort((a, b) => a.key.localeCompare(b.key));

const obj = (pairs) => '{\n' + pairs.map(([k, v]) => `  ${k}: ${v},`).join('\n') + '\n}';

writeFileSync('src/data/catch-rates.ts',
`// GENERATED by scripts/gen-data.mjs from PokeAPI. Do not edit by hand.
import { toKey } from './normalize';
export const CATCH_RATES: Record<string, number> = ${obj(rows.map(r => [r.key, r.catch]))};
export function baseCatchRate(speciesId: string): number { return CATCH_RATES[toKey(speciesId)] ?? 45; }
`);

writeFileSync('src/game/exp-yield.ts',
`// GENERATED by scripts/gen-data.mjs from PokeAPI. Do not edit by hand.
import { toKey } from '../data/normalize';
export const EXP_YIELD: Record<string, number> = ${obj(rows.map(r => [r.key, r.exp]))};
export function baseExpYield(species: string): number { return EXP_YIELD[toKey(species)] ?? 100; }
`);

writeFileSync('src/game/growth-rates.ts',
`// GENERATED by scripts/gen-data.mjs from PokeAPI. Do not edit by hand.
import { toKey } from '../data/normalize';
export type GrowthGroup = 'fast' | 'mediumfast' | 'mediumslow' | 'slow' | 'erratic' | 'fluctuating';
export function expForLevel(level: number, group: GrowthGroup): number {
  const n = level; if (n <= 1) return 0;
  switch (group) {
    case 'fast': return Math.floor((4 * n ** 3) / 5);
    case 'mediumfast': return n ** 3;
    case 'mediumslow': return Math.floor((6 / 5) * n ** 3 - 15 * n ** 2 + 100 * n - 140);
    case 'slow': return Math.floor((5 * n ** 3) / 4);
    case 'erratic':
      if (n < 50) return Math.floor((n ** 3 * (100 - n)) / 50);
      if (n < 68) return Math.floor((n ** 3 * (150 - n)) / 100);
      if (n < 98) return Math.floor((n ** 3 * Math.floor((1911 - 10 * n) / 3)) / 500);
      return Math.floor((n ** 3 * (160 - n)) / 100);
    case 'fluctuating':
      if (n < 15) return Math.floor((n ** 3 * (Math.floor((n + 1) / 3) + 24)) / 50);
      if (n < 36) return Math.floor((n ** 3 * (n + 14)) / 50);
      return Math.floor((n ** 3 * (Math.floor(n / 2) + 32)) / 50);
  }
}
export const GROUPS: Record<string, GrowthGroup> = ${obj(rows.map(r => [r.key, `'${r.growth}'`]))};
export function growthRateOf(species: string): GrowthGroup { return GROUPS[toKey(species)] ?? 'mediumfast'; }
`);

writeFileSync('src/data/ev-yield.ts',
`// GENERATED by scripts/gen-data.mjs from PokeAPI. Do not edit by hand.
import { toKey } from './normalize';
export interface Ev6 { hp: number; atk: number; def: number; spa: number; spd: number; spe: number; }
export const EV_YIELD: Record<string, Ev6> = ${obj(rows.map(r => [r.key, `{ hp: ${r.ev.hp}, atk: ${r.ev.atk}, def: ${r.ev.def}, spa: ${r.ev.spa}, spd: ${r.ev.spd}, spe: ${r.ev.spe} }`]))};
export function evYield(species: string): Ev6 { return EV_YIELD[toKey(species)] ?? { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }; }
`);

console.log('generated', rows.length, 'species');
```

> **Note:** `growth-rates.ts` is regenerated *with* `expForLevel` preserved (the curve
> math 3a relies on). The generator embeds it verbatim so the file stays self-contained.

- [ ] **Step 3: Run the generator**

Run: `node scripts/gen-data.mjs`
Expected: `generated ~1025 species`. (Takes a minute; concurrency 12. If a few species
404, they're skipped and fall back to defaults — fine.)

- [ ] **Step 4: Run the anchors test + full suite**

Run: `npx vitest run src/data/data-anchors.test.ts && npm test && npm run typecheck`
Expected: anchors pass (real values), all prior tests still pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add scripts/gen-data.mjs src/data/catch-rates.ts src/game/exp-yield.ts src/game/growth-rates.ts src/data/ev-yield.ts src/data/data-anchors.test.ts
git commit -m "feat(data): generate full National-Dex tables from PokeAPI"
```

---

### Task 3: Region-integrity test suite (the contract for pi's content)

Write this BEFORE the content — it's the executable spec Task 4 must satisfy.

**Files:** Create `src/content/region-integrity.test.ts`

- [ ] **Step 1: Write the suite**

```ts
import { describe, it, expect } from 'vitest';
import * as Sim from 'pokemon-showdown';
import { ALL_LOCATIONS, ALL_GYMS, ALL_TRAINERS, ALL_SHOPS } from './region/index';
import { composeTeam } from '../ai/team-composer';
import { makeRng } from '../ai/rng';
import { ITEMS } from '../game/items/catalog';

const dex = (Sim.Dex as any).forGen(9);
const VALID_TYPES = new Set(['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy']);

describe('region integrity', () => {
  it('the map is fully connected with symmetric links', () => {
    const ids = new Set(ALL_LOCATIONS.map((l) => l.id));
    for (const l of ALL_LOCATIONS) for (const c of l.connections) {
      expect(ids.has(c)).toBe(true);                                   // link resolves
      expect(ALL_LOCATIONS.find((x) => x.id === c)!.connections).toContain(l.id); // symmetric
    }
    // BFS from the start reaches every location
    const start = 'aethels-rest';
    const seen = new Set([start]); const q = [start];
    while (q.length) { const cur = q.shift()!; for (const n of ALL_LOCATIONS.find((l) => l.id === cur)!.connections) if (!seen.has(n)) { seen.add(n); q.push(n); } }
    expect(seen.size).toBe(ALL_LOCATIONS.length);
  });

  it('has exactly 8 gyms, type-locked, with strictly increasing level caps', () => {
    expect(ALL_GYMS.length).toBe(8);
    const badgeIds = new Set<string>();
    let prevCap = 0;
    for (const g of ALL_GYMS) {
      expect(VALID_TYPES.has(g.type)).toBe(true);
      expect(g.trainer.gymType).toBe(g.type);
      expect(badgeIds.has(g.badgeId)).toBe(false); badgeIds.add(g.badgeId);
      expect(g.trainer.levelCap).toBeGreaterThan(prevCap); prevCap = g.trainer.levelCap;
    }
  });

  it('every encounter species exists in the dex and is standard; levels are valid', () => {
    for (const l of ALL_LOCATIONS) for (const tbl of Object.values(l.encounters ?? {})) for (const e of tbl ?? []) {
      const s = dex.species.get(e.species);
      expect(s.exists, `${e.species} in ${l.id}`).toBe(true);
      expect(!!s.isNonstandard).toBe(false);
      expect(e.minLevel).toBeGreaterThanOrEqual(1);
      expect(e.maxLevel).toBeGreaterThanOrEqual(e.minLevel);
    }
  });

  it('every shop item exists in the catalog', () => {
    for (const shop of ALL_SHOPS) for (const entry of shop.stock) expect(ITEMS[entry.itemId], entry.itemId).toBeTruthy();
  });

  it('every gym composes a legal type-locked team', () => {
    for (const g of ALL_GYMS) {
      const team = composeTeam(g.trainer, { gen: 9, counterDraftStrength: 0.3, rng: makeRng(1) });
      expect(team.length).toBe(g.trainer.teamSize);
      for (const set of team) expect(dex.species.get(set.species).types).toContain(g.type);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/content/region-integrity.test.ts`
Expected: FAIL — `./region/index` does not exist yet (that's Task 4).

- [ ] **Step 3: Commit the contract**

```bash
git add src/content/region-integrity.test.ts
git commit -m "test(content): region-integrity suite (contract for full region)"
```

---

### Task 4: Full region content (pi authors against the contract)

**This is an authoring task, not verbatim transcription.** `pi` invents the content
*within* the schema and worldbuilding, and it is correct iff `region-integrity.test.ts`
and the 4a `slice-integration.test.ts` pass.

**Files:** Create `src/content/region/index.ts` (+ supporting `src/content/region/*.ts`)
exporting `ALL_LOCATIONS: Location[]`, `ALL_GYMS: GymDef[]`, `ALL_TRAINERS: TrainerDef[]`,
`ALL_SHOPS: ShopDef[]`. Re-export/extend the 4a slice (Aethel's Rest, Whispering Path,
Verdant Hollow, Bramble, Aethel Mart) rather than duplicating it.

**Required structure (from the worldbuilding bible + 4b spec):**
- 8 gym towns in order with these exact `badgeId`s, types, leaders, biomes, levelCaps,
  tiers (gym #1 already exists from 4a):

  | # | town id | name | type | leader id/name | biome | levelCap | tier |
  |---|---|---|---|---|---|---|---|
  | 1 | verdant-hollow | Verdant Hollow | Grass | bramble/Bramble | johto-forests | 12 | easy |
  | 2 | cerulean-deep | Cerulean Deep | Water | maris/Maris | hoenn-beaches | 18 | easy |
  | 3 | ember-peak | Ember Peak | Fire | ignis/Ignis | alola-islands | 24 | normal |
  | 4 | voltspire | Voltspire | Electric | zap/Zap | unova-urban | 30 | normal |
  | 5 | mindweave | Mindweave | Psychic | sylas/Sylas | kalos-gardens | 36 | hard |
  | 6 | frostfell | Frostfell | Ice | glacia/Glacia | sinnoh-tundra | 42 | hard |
  | 7 | drakemaw | Drakemaw | Dragon | vriska/Vriska | paldea-wilds | 48 | hard |
  | 8 | shadowmere | Shadowmere | Dark | noctis/Noctis | galar-countryside | 52 | hard |

- A **route between each pair of consecutive towns** (≥7 new routes), each with: a
  biome-appropriate `EncounterTable` (morning/day/night, 2-4 species each, real
  Gen-9 species names that exist and are standard — verify against `Dex`), level ranges
  scaling with progression, and 1-4 `TrainerDef`s.
- Each **gym town** has a shop (`ShopDef`) whose stock is gated/scaled by badge count
  using only itemIds from the 3b catalog (e.g. `pokeball`, `greatball`, `ultraball`,
  `potion`, `superpotion`, `hyperpotion`, `revive`, `antidote`, `fullheal`).
- Each gym `trainer.gymType` MUST equal the gym `type`. Sylas: include
  `personality.aggression`/`caution` and a note `advancedToggle` (flavor). Noctis: high
  `personality` aggression. (No new code — knobs are tuned where battles are started, 5.)
- Each town has 1-3 `NpcDef`s with flavor lines (a couple may set `reputationGated`).
- The map must be **fully connected and symmetric** (Aethel's Rest ↔ Whispering Path ↔
  Verdant Hollow ↔ route ↔ Cerulean Deep ↔ … ↔ Shadowmere).

- [ ] **Step 1: Author the content** in `src/content/region/` per the structure above,
  exporting the four `ALL_*` arrays from `src/content/region/index.ts`. Use only species
  that satisfy: `Dex.forGen(9).species.get(name).exists === true` and `!isNonstandard`.

- [ ] **Step 2: Run the contract**

Run: `npx vitest run src/content/region-integrity.test.ts`
Expected: PASS. Fix authored content until every assertion passes (broken links,
bad species names, mistyped gyms, missing shop items, non-increasing caps all surface here).

- [ ] **Step 3: Commit**

```bash
git add src/content/region/
git commit -m "feat(content): full 8-badge region (authored by pi, validated by integrity suite)"
```

---

### Task 5: Wire the registry to the full region + full suite (Claude)

**Files:** Modify `src/content/region.ts`, `src/content/slice/data.ts` (re-export), `README.md`

- [ ] **Step 1: Point the registry at the full region**

Change `src/content/region.ts` to import from `./region/index` instead of `./slice/data`:
```ts
import { ALL_LOCATIONS as LOCATIONS, ALL_TRAINERS as TRAINERS, ALL_GYMS as GYMS, ALL_SHOPS as SHOPS } from './region/index';
```
(Keep the rest of `region.ts` — the `Map`s and getters — unchanged.)

- [ ] **Step 2: Full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: ALL pass — integrity suite, the 4a slice-integration test (now against the
full region), and all prior tests; typecheck clean.

- [ ] **Step 3: Append to `README.md`**

````markdown
## Region Content (sub-project 4b — full 8-badge region)

The complete main path of The Mosaic: 8 type-locked gyms (Verdant Hollow → Shadowmere),
connecting routes with biome encounter tables (the Convergence Tide), trainers, shops,
and NPCs. Factual species data (catch/exp/growth/EV) is generated from PokéAPI by
`scripts/gen-data.mjs`. Region content is validated by `region-integrity.test.ts`.
Elite Four / Champion / story climax are sub-project 4c.
````

- [ ] **Step 4: Commit**

```bash
git add src/content/region.ts src/content/slice/data.ts README.md
git commit -m "feat(content): registry serves the full region; 4b complete"
```

---

## Self-Review notes

- **Spec coverage:** PokéAPI data pipeline + EV-yield (T1-T2); key normalization so
  full-dex keys resolve (T1); integrity suite (T3); full region content (T4); registry
  wiring + suite (T5). Special-gym knobs are flavor in data (T4); applied at battle
  start in 5.
- **Verified-API risks settled:** PokéAPI fields/growth-name mapping confirmed by probe;
  `composeTeam`/`Dex` reused.
- **Factual vs creative split enforced:** data tables are generated (T2), never authored;
  content is authored but gated by the executable integrity contract (T3/T4).
- **Deferred (4c):** Elite Four, Champion, stabilize meter, faction story, Reset/Embrace
  ending, Vriska's room-gauntlet. Rendering: 5.
- **Type consistency:** `ALL_LOCATIONS/ALL_GYMS/ALL_TRAINERS/ALL_SHOPS` exported by
  `region/index.ts`, consumed by `region.ts` + integrity suite; `GrowthGroup`/`Ev6`
  exported from the generated files; `toKey` shared across all four tables.
```
