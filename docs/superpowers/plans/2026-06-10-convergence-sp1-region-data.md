# Convergence SP1 — Region & Content Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the non-breaking data foundation for the Convergence reframe: generation lookups, the `RiftDef`/`WardenDef` types, and the 7-rift registry with encounter tables — all additive, fully tested, leaving the existing game working.

**Architecture:** Pure data + small lookups under `src/`, mirroring the existing bundled-data pattern (`src/game/exp-yield.ts`). Adds `BIOME_GEN` + `speciesGeneration` (used by the seal action in SP2), the rift types, and a `rifts.ts` registry with one fully-worked rift plus six authored from a parameter table. **No existing file's behavior changes** — gyms, beats, the server, and the 211 tests stay untouched. The beats rewrite and `region/index.ts` gym removal are deferred to SP2 (they need the runtime rift-tracking SP2 builds).

**Tech Stack:** TypeScript (NodeNext), Vitest. No new dependencies.

---

## File Structure

**New:**
- `src/game/generations.ts` — `BIOME_GEN: Record<Biome, number>` and `speciesGeneration(num: number): number`. One responsibility: generation lookups.
- `src/game/generations.test.ts`
- `src/content/rifts.ts` — `RIFTS: RiftDef[]`, `ALL_RIFTS`, `getRift(id)`. The 7-rift registry (data only).
- `src/content/rifts.test.ts` — structural validation of the whole registry.

**Modified:**
- `src/content/types.ts` — add `RiftDef` + `WardenDef` interfaces (additive; existing types untouched).

**Untouched (explicitly deferred to SP2/SP3):** `src/content/region/index.ts`, `src/content/story/beats.ts`, `server/session.ts`, all `src/ai/*`, battle/catch/leveling engine.

---

## Task 1: Generation lookups (`BIOME_GEN` + `speciesGeneration`)

**Files:**
- Create: `src/game/generations.ts`
- Test: `src/game/generations.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/game/generations.test.ts
import { describe, it, expect } from 'vitest';
import { BIOME_GEN, speciesGeneration } from './generations';

describe('BIOME_GEN', () => {
  it('maps every biome to its source generation', () => {
    expect(BIOME_GEN['kanto-plains']).toBe(1);
    expect(BIOME_GEN['johto-forests']).toBe(2);
    expect(BIOME_GEN['hoenn-beaches']).toBe(3);
    expect(BIOME_GEN['sinnoh-tundra']).toBe(4);
    expect(BIOME_GEN['unova-urban']).toBe(5);
    expect(BIOME_GEN['kalos-gardens']).toBe(6);
    expect(BIOME_GEN['alola-islands']).toBe(7);
    expect(BIOME_GEN['galar-countryside']).toBe(8);
    expect(BIOME_GEN['paldea-wilds']).toBe(9);
  });
});

describe('speciesGeneration', () => {
  it('maps national-dex number to generation at range boundaries', () => {
    expect(speciesGeneration(1)).toBe(1);     // Bulbasaur
    expect(speciesGeneration(151)).toBe(1);   // Mew
    expect(speciesGeneration(152)).toBe(2);   // Chikorita
    expect(speciesGeneration(251)).toBe(2);
    expect(speciesGeneration(386)).toBe(3);
    expect(speciesGeneration(493)).toBe(4);
    expect(speciesGeneration(649)).toBe(5);
    expect(speciesGeneration(721)).toBe(6);
    expect(speciesGeneration(809)).toBe(7);
    expect(speciesGeneration(905)).toBe(8);
    expect(speciesGeneration(906)).toBe(9);
    expect(speciesGeneration(1025)).toBe(9);
  });
  it('returns 0 for an unknown/out-of-range number', () => {
    expect(speciesGeneration(0)).toBe(0);
    expect(speciesGeneration(99999)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/generations.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/game/generations.ts
import type { Biome } from '../content/types';

export const BIOME_GEN: Record<Biome, number> = {
  'kanto-plains': 1,
  'johto-forests': 2,
  'hoenn-beaches': 3,
  'sinnoh-tundra': 4,
  'unova-urban': 5,
  'kalos-gardens': 6,
  'alola-islands': 7,
  'galar-countryside': 8,
  'paldea-wilds': 9,
};

// Upper national-dex number of each generation, in order.
const GEN_MAX: ReadonlyArray<readonly [number, number]> = [
  [151, 1], [251, 2], [386, 3], [493, 4], [649, 5],
  [721, 6], [809, 7], [905, 8], [1025, 9],
];

/** National-dex number -> generation (1..9), or 0 if out of range. */
export function speciesGeneration(num: number): number {
  if (num < 1) return 0;
  for (const [max, gen] of GEN_MAX) if (num <= max) return gen;
  return 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/generations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/generations.ts src/game/generations.test.ts
git commit -m "feat(convergence): biome->generation map + speciesGeneration lookup"
```

---

## Task 2: `RiftDef` + `WardenDef` types

**Files:**
- Modify: `src/content/types.ts`

- [ ] **Step 1: Add the types (no test — type-only; validated by Task 3/4 compiling)**

Append to `src/content/types.ts`:

```ts
/** A rift Warden — a boss trainer with a signature convergence tactic. */
export interface WardenDef extends TrainerDef {
  /** Tag the team-builder / AI reads to shape this Warden's strategy. */
  signatureTactic: string;
}

/** A convergence rift: a seam where two worlds bleed together. Replaces GymDef. */
export interface RiftDef {
  id: string;
  name: string;
  biomeA: Biome;            // sealing may collapse the seam to this region...
  biomeB: Biome;            // ...or this one, depending on the team's gen lean
  levelBand: { min: number; max: number };
  warden: WardenDef;
  /** Seam mix — used while unsealed, and at raised level/rarity while attuned. */
  fusedEncounters: EncounterTable;
  /** Pure-region table if the seal collapses to biomeA. */
  pureEncountersA: EncounterTable;
  /** Pure-region table if the seal collapses to biomeB. */
  pureEncountersB: EncounterTable;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors (types are additive; `TrainerDef`, `Biome`, `EncounterTable` already exist in this file).

- [ ] **Step 3: Commit**

```bash
git add src/content/types.ts
git commit -m "feat(convergence): RiftDef + WardenDef content types"
```

---

## Task 3: Rift registry scaffold + rift 1 (Thornmarsh) fully authored

**Files:**
- Create: `src/content/rifts.ts`

This task establishes the registry shape and one complete worked rift; Task 4 tests it; Task 5 authors the other six against this exemplar.

- [ ] **Step 1: Write the registry + Thornmarsh**

```ts
// src/content/rifts.ts
import type { RiftDef } from './types';

// ── Rift 1: Thornmarsh — kanto-plains (Gen 1) ⇄ johto-forests (Gen 2), lv 10–14
const THORNMARSH: RiftDef = {
  id: 'thornmarsh',
  name: 'Thornmarsh Rift',
  biomeA: 'kanto-plains',
  biomeB: 'johto-forests',
  levelBand: { min: 10, max: 14 },
  warden: {
    id: 'bramble', name: 'Bramble', baseTier: 'easy',
    personality: { aggression: 0.45, caution: 0.6 },
    teamSize: 3, levelCap: 14, basePayout: 40,
    dropTable: [{ itemId: 'superpotion', chance: 1 }],
    signatureTactic: 'overgrowth-hazards', // grassy terrain + entry hazards, slow attrition
  },
  // Seam mix: Kanto plains + Johto forest species bleeding together.
  fusedEncounters: {
    morning: [
      { species: 'Pidgey', minLevel: 10, maxLevel: 13, weight: 5 },
      { species: 'Hoothoot', minLevel: 10, maxLevel: 13, weight: 5 },
      { species: 'Sentret', minLevel: 11, maxLevel: 14, weight: 4 },
    ],
    day: [
      { species: 'Rattata', minLevel: 10, maxLevel: 13, weight: 5 },
      { species: 'Ledyba', minLevel: 10, maxLevel: 13, weight: 4 },
      { species: 'Caterpie', minLevel: 10, maxLevel: 12, weight: 4 },
    ],
    night: [
      { species: 'Spinarak', minLevel: 11, maxLevel: 14, weight: 5 },
      { species: 'Hoothoot', minLevel: 11, maxLevel: 14, weight: 5 },
      { species: 'Rattata', minLevel: 10, maxLevel: 13, weight: 4 },
    ],
  },
  // Sealed -> Kanto plains (Gen 1) species only.
  pureEncountersA: {
    morning: [
      { species: 'Pidgey', minLevel: 10, maxLevel: 13, weight: 6 },
      { species: 'Rattata', minLevel: 10, maxLevel: 13, weight: 4 },
    ],
    day: [
      { species: 'Pidgey', minLevel: 10, maxLevel: 13, weight: 5 },
      { species: 'Spearow', minLevel: 11, maxLevel: 14, weight: 3 },
      { species: 'Caterpie', minLevel: 10, maxLevel: 12, weight: 2 },
    ],
    night: [
      { species: 'Rattata', minLevel: 10, maxLevel: 13, weight: 6 },
      { species: 'Zubat', minLevel: 11, maxLevel: 14, weight: 4 },
    ],
  },
  // Sealed -> Johto forest (Gen 2) species only.
  pureEncountersB: {
    morning: [
      { species: 'Hoothoot', minLevel: 10, maxLevel: 13, weight: 6 },
      { species: 'Sentret', minLevel: 10, maxLevel: 13, weight: 4 },
    ],
    day: [
      { species: 'Ledyba', minLevel: 10, maxLevel: 13, weight: 5 },
      { species: 'Hoppip', minLevel: 10, maxLevel: 13, weight: 3 },
      { species: 'Sentret', minLevel: 11, maxLevel: 14, weight: 2 },
    ],
    night: [
      { species: 'Spinarak', minLevel: 10, maxLevel: 13, weight: 6 },
      { species: 'Hoothoot', minLevel: 11, maxLevel: 14, weight: 4 },
    ],
  },
};

export const RIFTS: RiftDef[] = [THORNMARSH];

export const ALL_RIFTS = RIFTS;
export function getRift(id: string): RiftDef | undefined {
  return RIFTS.find((r) => r.id === id);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/content/rifts.ts
git commit -m "feat(convergence): rift registry + Thornmarsh (rift 1) authored"
```

---

## Task 4: Structural tests for the rift registry

**Files:**
- Create: `src/content/rifts.test.ts`

These validate every rift in the registry, so they hold as Task 5 adds the rest.

- [ ] **Step 1: Write the test**

```ts
// src/content/rifts.test.ts
import { describe, it, expect } from 'vitest';
import { RIFTS, getRift } from './rifts';
import { BIOME_GEN } from '../game/generations';
import type { EncounterTable } from './types';

const nonEmpty = (t: EncounterTable) =>
  Object.values(t).some((list) => Array.isArray(list) && list.length > 0);

describe('rift registry', () => {
  it('has unique ids and getRift resolves them', () => {
    const ids = RIFTS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of RIFTS) expect(getRift(r.id)).toBe(r);
  });

  it('each rift pairs two different biomes of different generations', () => {
    for (const r of RIFTS) {
      expect(r.biomeA).not.toBe(r.biomeB);
      expect(BIOME_GEN[r.biomeA]).not.toBe(BIOME_GEN[r.biomeB]);
    }
  });

  it('each rift has non-empty fused + both pure encounter tables', () => {
    for (const r of RIFTS) {
      expect(nonEmpty(r.fusedEncounters)).toBe(true);
      expect(nonEmpty(r.pureEncountersA)).toBe(true);
      expect(nonEmpty(r.pureEncountersB)).toBe(true);
    }
  });

  it('each Warden has a signature tactic and a level cap within the band', () => {
    for (const r of RIFTS) {
      expect(r.warden.signatureTactic.length).toBeGreaterThan(0);
      expect(r.warden.levelCap).toBeGreaterThanOrEqual(r.levelBand.max);
    }
  });

  it('level bands increase monotonically across the chain', () => {
    for (let i = 1; i < RIFTS.length; i++) {
      expect(RIFTS[i].levelBand.min).toBeGreaterThan(RIFTS[i - 1].levelBand.min);
    }
  });
});
```

- [ ] **Step 2: Run — passes for the single rift so far**

Run: `npx vitest run src/content/rifts.test.ts`
Expected: PASS (one rift; monotonic check is vacuously true).

- [ ] **Step 3: Commit**

```bash
git add src/content/rifts.test.ts
git commit -m "test(convergence): structural validation of the rift registry"
```

---

## Task 5: Author rifts 2–7

**Files:**
- Modify: `src/content/rifts.ts`

Author six more `RiftDef`s in the **exact shape of `THORNMARSH`** (Task 3) and add them to the `RIFTS` array in order. Each uses real species native to its two biomes for `fusedEncounters` (a mix of both), `pureEncountersA` (biomeA's region only), and `pureEncountersB` (biomeB's region only), with `minLevel/maxLevel` inside the rift's level band. Parameters per rift:

| id | name | biomeA (gen) | biomeB (gen) | band | warden (id) | signatureTactic | example species A / B |
|----|------|--------------|--------------|------|-------------|-----------------|------------------------|
| `drowning-coast` | Drowning Coast | johto-forests (2) | hoenn-beaches (3) | 18–22 | maris | `rain-stall` | Hoppip,Yanma,Wooper / Wingull,Lotad,Carvanha |
| `emberreef` | Emberreef | hoenn-beaches (3) | alola-islands (7) | 25–29 | ignis | `sun-aggro` | Numel,Torkoal,Wingull / Salandit,Magby,Wimpod |
| `neon-wilds` | Neon Wilds | alola-islands (7) | unova-urban (5) | 32–36 | zap | `terrain-speed` | Yungoos,Charjabug,Fomantis / Blitzle,Joltik,Klink |
| `bloomgrave` | Bloomgrave | unova-urban (5) | kalos-gardens (6) | 39–43 | sylas | `trick-room` | Trubbish,Elgyem,Solosis / Flabébé,Spritzee,Espurr |
| `frostbloom` | Frostbloom | kalos-gardens (6) | sinnoh-tundra (4) | 46–50 | glacia | `snow-veil` | Snover,Bergmite / Snorunt,Sneasel,Snover |
| `the-maw` | The Maw | sinnoh-tundra (4) | paldea-wilds (9) | 53–57 | vriska | `dragon-chaos` | Gible,Gabite / Frigibax,Dreepy,Cyclizar |

For each Warden, follow `bramble`'s `WardenDef` shape with escalating `levelCap` (= band max), rising `basePayout` (40→60→80→100→120→150), `baseTier` `easy`→`normal`→`hard` as the chain deepens, and `personality` aggression/caution that fits the tactic (e.g. `trick-room` = high caution; `dragon-chaos`/`sun-aggro` = high aggression). Use sensible 3–4 mon `teamSize`.

> Species note: any name must be a valid Showdown species (the encounter roller resolves it via the Dex). When unsure of a Gen-native species, pick a clearly-correct common one from that region. Three time buckets (morning/day/night) per table, 2–4 entries each, like `THORNMARSH`.

- [ ] **Step 1: Author the six rifts** in `src/content/rifts.ts` and extend `RIFTS` to `[THORNMARSH, DROWNING_COAST, EMBERREEF, NEON_WILDS, BLOOMGRAVE, FROSTBLOOM, THE_MAW]`.

- [ ] **Step 2: Run the registry tests**

Run: `npx vitest run src/content/rifts.test.ts`
Expected: PASS — 7 rifts, monotonic bands, all tables non-empty, every Warden tagged.

- [ ] **Step 3: Run the full suite (nothing else regressed)**

Run: `npx vitest run`
Expected: all prior tests still green + the new rift/generation tests.

- [ ] **Step 4: Commit**

```bash
git add src/content/rifts.ts
git commit -m "feat(convergence): author rifts 2-7 (Drowning Coast .. The Maw)"
```

---

## Self-Review

**Spec coverage (sub-project 1 portion of the design doc):**
- `BIOME_GEN` + `speciesGeneration` bundled data → Task 1. ✓
- `RiftDef` + `WardenDef` types (per-side pure tables, signatureTactic) → Task 2. ✓
- 7-rift roster with biome pairs, wardens, level bands, dual encounter tables → Tasks 3 + 5. ✓
- Structural tests (7 rifts, differing biome gens, non-empty tables, monotonic bands, tactic present, gen-boundary checks) → Tasks 1 + 4. ✓
- Engine + 211 tests untouched → nothing in this plan modifies `src/` runtime logic or `server/`. ✓
- Beats rewrite + `region/index.ts` gym removal → **intentionally deferred to SP2** (documented in Goal/Architecture; they need SP2's rift-tracking). Not a gap — a scope decision.

**Placeholder scan:** Task 1–4 contain complete code; Task 5 is parameterized content authoring (a concrete per-rift table + the worked `THORNMARSH` exemplar to copy), which is the appropriate form for bulk data, not a "TODO." No vague steps.

**Type consistency:** `RiftDef`/`WardenDef` fields defined in Task 2 (`biomeA/biomeB`, `levelBand`, `warden`, `fusedEncounters`, `pureEncountersA/B`, `signatureTactic`) are exactly the fields used in Tasks 3–5 and asserted in Task 4. `BIOME_GEN`/`speciesGeneration` signatures match across Tasks 1 and 4. `getRift`/`RIFTS`/`ALL_RIFTS` names consistent across Tasks 3–5.
