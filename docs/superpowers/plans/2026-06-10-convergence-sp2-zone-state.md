# Convergence SP2 — Rift & Zone-State System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The engine layer that makes rifts mean something — per-rift `unsealed/sealed/attuned` state, the Seal/Attune actions (team-gen-lean direction), zone-encounter selection, rift-triggered beats, and the Core ending — as tested pure functions on `GameState`.

**Architecture:** One additive `GameState` field (`riftStates`) with a save default; a new `src/game/rift-state.ts` of pure functions; small additive changes to `src/game/story.ts` and a rewrite of `src/content/story/beats.ts`. No server/UI/region changes (SP3). Mirrors the existing `src/game` pure-function + Vitest style.

**Tech Stack:** TypeScript (NodeNext), Vitest, `pokemon-showdown` Dex (already a dep).

---

## File Structure
- **Modify:** `src/game/types.ts` (add `RiftStatus`, `RiftState`, `riftStates` field), `src/game/game-state.ts` (`createNewGame` init), `src/game/save.ts` (deserialize default + `SCHEMA_VERSION` → 2), `src/game/story.ts` (`requiredRifts` + `nextBeat` + `convergenceEnding`), `src/content/story/beats.ts` (rewrite to rift beats).
- **Create:** `src/game/rift-state.ts`, `src/game/rift-state.test.ts`, `src/game/save.migrate.test.ts`.

---

## Task 1: `riftStates` on GameState (+ save default & schema bump)

**Files:**
- Modify: `src/game/types.ts`, `src/game/game-state.ts`, `src/game/save.ts`
- Test: `src/game/save.migrate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/game/save.migrate.test.ts
import { describe, it, expect } from 'vitest';
import { createNewGame } from './game-state';
import { deserialize } from './save';

describe('riftStates migration', () => {
  it('a new game starts with no rift states', () => {
    const g = createNewGame({} as never);
    expect(g.riftStates).toEqual({});
  });
  it('deserialize defaults riftStates for an old save that lacks it', () => {
    const g = createNewGame({} as never);
    const { riftStates: _omit, ...rest } = g;
    const oldJson = JSON.stringify({ ...rest, pokedex: { seen: [], caught: [] } });
    expect(deserialize(oldJson).riftStates).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/save.migrate.test.ts`
Expected: FAIL — `riftStates` does not exist / is undefined.

- [ ] **Step 3: Implement**

In `src/game/types.ts`, add above `interface GameState` and a field inside it:

```ts
export type RiftStatus = 'unsealed' | 'sealed' | 'attuned';
export interface RiftState { status: RiftStatus; biome?: Biome; }
```
```ts
  // inside GameState (additive):
  riftStates: Record<string, RiftState>;
```
(`Biome` is imported from `../content/types` if not already — check the top of `types.ts`; if `Biome` isn't imported there, use `import type { Biome } from '../content/types';`.)

In `src/game/game-state.ts` `createNewGame`, add the field (next to `flags: {}`):
```ts
    flags: {}, graveyard: [], time: { day: 0, minutes: 0 },
    trainerLog: {},
    stabilizeMeter: 0,
    riftStates: {},
```

In `src/game/save.ts`: bump the constant and default the field on load:
```ts
const SCHEMA_VERSION = 2;
```
```ts
export function deserialize(json: string): GameState {
  const raw = JSON.parse(json);
  return {
    ...raw,
    riftStates: raw.riftStates ?? {},
    pokedex: { seen: new Set<number>(raw.pokedex.seen), caught: new Set<number>(raw.pokedex.caught) },
  } as GameState;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/save.migrate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/types.ts src/game/game-state.ts src/game/save.ts src/game/save.migrate.test.ts
git commit -m "feat(convergence): riftStates on GameState + save default + schema v2"
```

---

## Task 2: Rift status helpers + team gen-lean + seal direction

**Files:**
- Create: `src/game/rift-state.ts`, `src/game/rift-state.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/game/rift-state.test.ts
import { describe, it, expect } from 'vitest';
import { riftStatus, riftsAddressedCount, partyGenLean, sealDirectionBiome } from './rift-state';
import { getRift } from '../content/rifts';
import type { GameState } from './types';

const stateWith = (riftStates: GameState['riftStates']) => ({ riftStates } as GameState);

describe('rift status helpers', () => {
  it('absent rift reads as unsealed; addressed count ignores unsealed', () => {
    const s = stateWith({ thornmarsh: { status: 'sealed', biome: 'kanto-plains' }, emberreef: { status: 'attuned' } });
    expect(riftStatus(s, 'thornmarsh')).toBe('sealed');
    expect(riftStatus(s, 'nope')).toBe('unsealed');
    expect(riftsAddressedCount(s)).toBe(2);
  });
});

describe('partyGenLean', () => {
  it("'old' when the team skews Gen 4 and below", () => {
    expect(partyGenLean([{ species: 'Pidgey' }, { species: 'Totodile' }])).toBe('old'); // gens 1,2
  });
  it("'new' when at least half are Gen 5+", () => {
    expect(partyGenLean([{ species: 'Pidgey' }, { species: 'Blitzle' }, { species: 'Frigibax' }])).toBe('new'); // 1,5,9 -> new>=old
  });
  it("tie resolves to 'new'", () => {
    expect(partyGenLean([{ species: 'Pidgey' }, { species: 'Blitzle' }])).toBe('new'); // old1,new1 -> tie -> new
  });
});

describe('sealDirectionBiome', () => {
  const thornmarsh = getRift('thornmarsh')!; // kanto-plains g1 <-> johto-forests g2
  it('new-leaning team collapses the seam to the higher-gen region', () => {
    expect(sealDirectionBiome(thornmarsh, [{ species: 'Blitzle' }, { species: 'Frigibax' }])).toBe('johto-forests');
  });
  it('old-leaning team collapses to the lower-gen region', () => {
    expect(sealDirectionBiome(thornmarsh, [{ species: 'Pidgey' }, { species: 'Rattata' }])).toBe('kanto-plains');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/rift-state.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/game/rift-state.ts
import * as Sim from 'pokemon-showdown';
import type { GameState, RiftStatus } from './types';
import type { Biome } from '../content/types';
import type { RiftDef } from '../content/types';
import { BIOME_GEN, speciesGeneration } from './generations';

const DEX = (Sim.Dex as any).forGen(9);
function genOf(species: string): number {
  const sp = DEX.species.get(species);
  return sp && sp.exists ? speciesGeneration(sp.num) : 0;
}

export function riftStatus(state: GameState, riftId: string): RiftStatus {
  return state.riftStates[riftId]?.status ?? 'unsealed';
}

export function riftsAddressedCount(state: GameState): number {
  return Object.values(state.riftStates).filter((r) => r.status !== 'unsealed').length;
}

/** 'new' iff the party has at least as many Gen-5+ mons as Gen-4-and-below. */
export function partyGenLean(party: { species: string }[]): 'new' | 'old' {
  let newLean = 0, oldLean = 0;
  for (const p of party) { const g = genOf(p.species); if (g >= 5) newLean++; else if (g >= 1) oldLean++; }
  return newLean >= oldLean ? 'new' : 'old';
}

/** Which of the rift's two regions survives a seal, by the team's gen lean. */
export function sealDirectionBiome(rift: RiftDef, party: { species: string }[]): Biome {
  const lean = partyGenLean(party);
  const a = rift.biomeA, b = rift.biomeB;
  const higher = BIOME_GEN[a] >= BIOME_GEN[b] ? a : b;
  const lower = higher === a ? b : a;
  return lean === 'new' ? higher : lower;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/rift-state.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/rift-state.ts src/game/rift-state.test.ts
git commit -m "feat(convergence): rift status helpers + team gen-lean seal direction"
```

---

## Task 3: Seal & Attune actions

**Files:**
- Modify: `src/game/rift-state.ts`, `src/game/rift-state.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// append to src/game/rift-state.test.ts
import { sealRift, attuneRift } from './rift-state';

const baseState = (party: { species: string }[]) =>
  ({ riftStates: {}, stabilizeMeter: 0, party } as unknown as GameState);

describe('seal / attune actions', () => {
  const thornmarsh = getRift('thornmarsh')!;
  it('sealRift sets sealed + chosen biome and pushes the meter toward Reset', () => {
    const s = sealRift(baseState([{ species: 'Pidgey' }]), thornmarsh);
    expect(s.riftStates['thornmarsh']).toEqual({ status: 'sealed', biome: 'kanto-plains' });
    expect(s.stabilizeMeter).toBeLessThan(0);
  });
  it('attuneRift sets attuned and pushes the meter toward Embrace', () => {
    const s = attuneRift(baseState([{ species: 'Pidgey' }]), thornmarsh);
    expect(s.riftStates['thornmarsh'].status).toBe('attuned');
    expect(s.stabilizeMeter).toBeGreaterThan(0);
  });
  it('is a no-op once a rift is already addressed', () => {
    const once = sealRift(baseState([{ species: 'Pidgey' }]), thornmarsh);
    const twice = attuneRift(once, thornmarsh);
    expect(twice).toBe(once); // unchanged reference
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/rift-state.test.ts`
Expected: FAIL — `sealRift`/`attuneRift` not exported.

- [ ] **Step 3: Implement** (append to `src/game/rift-state.ts`)

```ts
import { pushMeter } from './story';

export const SEAL_DELTA = 16;       // toward Reset (negative)
export const ATTUNE_DELTA = 16;     // toward Embrace (positive)

function addressed(state: GameState, riftId: string): boolean {
  return riftStatus(state, riftId) !== 'unsealed';
}

export function sealRift(state: GameState, rift: RiftDef): GameState {
  if (addressed(state, rift.id)) return state;
  const biome = sealDirectionBiome(rift, state.party as { species: string }[]);
  const pushed = pushMeter(state, -SEAL_DELTA);
  return { ...pushed, riftStates: { ...pushed.riftStates, [rift.id]: { status: 'sealed', biome } } };
}

export function attuneRift(state: GameState, rift: RiftDef): GameState {
  if (addressed(state, rift.id)) return state;
  const pushed = pushMeter(state, +ATTUNE_DELTA);
  return { ...pushed, riftStates: { ...pushed.riftStates, [rift.id]: { status: 'attuned' } } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/rift-state.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/rift-state.ts src/game/rift-state.test.ts
git commit -m "feat(convergence): sealRift / attuneRift actions (meter + permanent state)"
```

---

## Task 4: `zoneEncounters` by state

**Files:**
- Modify: `src/game/rift-state.ts`, `src/game/rift-state.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// append to src/game/rift-state.test.ts
import { zoneEncounters, ATTUNE_LEVEL_BUMP } from './rift-state';

describe('zoneEncounters', () => {
  const thornmarsh = getRift('thornmarsh')!;
  it('unsealed yields the fused table', () => {
    const s = { riftStates: {} } as GameState;
    expect(zoneEncounters(s, thornmarsh)).toBe(thornmarsh.fusedEncounters);
  });
  it('sealed yields the surviving region pure table', () => {
    const a = { riftStates: { thornmarsh: { status: 'sealed', biome: 'kanto-plains' } } } as unknown as GameState;
    expect(zoneEncounters(a, thornmarsh)).toBe(thornmarsh.pureEncountersA);
    const b = { riftStates: { thornmarsh: { status: 'sealed', biome: 'johto-forests' } } } as unknown as GameState;
    expect(zoneEncounters(b, thornmarsh)).toBe(thornmarsh.pureEncountersB);
  });
  it('attuned yields fused with levels bumped', () => {
    const s = { riftStates: { thornmarsh: { status: 'attuned' } } } as unknown as GameState;
    const tbl = zoneEncounters(s, thornmarsh);
    const base = thornmarsh.fusedEncounters.morning![0];
    const bumped = tbl.morning![0];
    expect(bumped.minLevel).toBe(base.minLevel + ATTUNE_LEVEL_BUMP);
    expect(bumped.maxLevel).toBe(base.maxLevel + ATTUNE_LEVEL_BUMP);
    expect(thornmarsh.fusedEncounters.morning![0].minLevel).toBe(base.minLevel); // original untouched
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/rift-state.test.ts`
Expected: FAIL — `zoneEncounters` not exported.

- [ ] **Step 3: Implement** (append to `src/game/rift-state.ts`)

```ts
import type { EncounterTable, TimeBucket } from '../content/types';

export const ATTUNE_LEVEL_BUMP = 4;

function bumpLevels(table: EncounterTable, by: number): EncounterTable {
  const out: EncounterTable = {};
  for (const bucket of Object.keys(table) as TimeBucket[]) {
    const list = table[bucket];
    if (!list) continue;
    out[bucket] = list.map((e) => ({ ...e, minLevel: e.minLevel + by, maxLevel: e.maxLevel + by }));
  }
  return out;
}

export function zoneEncounters(state: GameState, rift: RiftDef): EncounterTable {
  const st = state.riftStates[rift.id];
  if (!st || st.status === 'unsealed') return rift.fusedEncounters;
  if (st.status === 'attuned') return bumpLevels(rift.fusedEncounters, ATTUNE_LEVEL_BUMP);
  return st.biome === rift.biomeA ? rift.pureEncountersA : rift.pureEncountersB;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/rift-state.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/rift-state.ts src/game/rift-state.test.ts
git commit -m "feat(convergence): zoneEncounters table selection by rift state"
```

---

## Task 5: Rift-triggered beats + `convergenceEnding`

**Files:**
- Modify: `src/game/story.ts`
- Test: `src/game/story.rifts.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```ts
// src/game/story.rifts.test.ts
import { describe, it, expect } from 'vitest';
import { nextBeat, convergenceEnding, type StoryBeat } from './story';
import type { GameState } from './types';

const S = (over: Partial<GameState>) =>
  ({ badges: [], flags: {}, riftStates: {}, stabilizeMeter: 0, ...over } as GameState);

const beats: StoryBeat[] = [
  { id: 'b0', requiredRifts: 0, dialogue: ['x'], choices: [] },
  { id: 'b2', requiredRifts: 2, dialogue: ['x'], choices: [] },
];

describe('rift-gated beats', () => {
  it('a requiredRifts beat fires only once enough rifts are addressed', () => {
    expect(nextBeat(S({}), beats)?.id).toBe('b0');
    const seen0 = S({ flags: { 'beat:b0': 'neutral' } });
    expect(nextBeat(seen0, beats)).toBeNull(); // b2 needs 2 rifts
    const two = S({ flags: { 'beat:b0': 'neutral' }, riftStates: { a: { status: 'sealed' }, b: { status: 'attuned' } } });
    expect(nextBeat(two, beats)?.id).toBe('b2');
  });
});

describe('convergenceEnding', () => {
  it('maps the meter to reset / embrace / third', () => {
    expect(convergenceEnding(S({ stabilizeMeter: -50 }))).toBe('reset');
    expect(convergenceEnding(S({ stabilizeMeter: 50 }))).toBe('embrace');
    expect(convergenceEnding(S({ stabilizeMeter: 0 }))).toBe('third');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/story.rifts.test.ts`
Expected: FAIL — `requiredRifts` not on `StoryBeat`, `convergenceEnding` undefined.

- [ ] **Step 3: Implement** (edit `src/game/story.ts`)

Add the import and field, update `nextBeat`, add `convergenceEnding`:

```ts
import { riftsAddressedCount } from './rift-state';
```
```ts
export interface StoryBeat { id: string; requiredBadges?: number; requiredRifts?: number; dialogue: string[]; choices: StoryChoice[]; }
```
```ts
export function nextBeat(state: GameState, beats: StoryBeat[]): StoryBeat | null {
  const rifts = riftsAddressedCount(state);
  return beats.find((b) => {
    if (state.flags[`beat:${b.id}`]) return false;
    if (b.requiredRifts !== undefined) return b.requiredRifts <= rifts;
    return (b.requiredBadges ?? Infinity) <= state.badges.length;
  }) ?? null;
}
```
```ts
export function convergenceEnding(state: GameState): 'reset' | 'embrace' | 'third' {
  const t = meterTier(state);
  return t === 'balance' ? 'third' : t;
}
```

> Note: `requiredBadges` becomes optional — confirm the existing `src/content/story/beats.ts` still compiles (it sets `requiredBadges`, which is fine). `rift-state.ts` imports from `story.ts` (`pushMeter`) and `story.ts` now imports from `rift-state.ts` (`riftsAddressedCount`) — this is a benign cycle of *functions* (no top-level use), which ES modules handle; if Vitest/tsc complain, move `riftsAddressedCount` to read `state.riftStates` inline in `story.ts` instead of importing.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/story.rifts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/story.ts src/game/story.rifts.test.ts
git commit -m "feat(convergence): rift-gated beats + convergenceEnding"
```

---

## Task 6: Rewrite the story beats to the rift run

**Files:**
- Modify: `src/content/story/beats.ts`

- [ ] **Step 1: Rewrite the 5 beats** to fire on `requiredRifts` 0 / 2 / 4 / 6 / 7, with dialogue reworded for the rifts / Wardens / the Core (drop gym/badge references). Keep each beat's `choices` (label + `faction` + `meterDelta`) — the faction meter is unchanged. Each beat keeps its `id`. Replace `requiredBadges: N` with `requiredRifts: M` per the mapping. Example shape for the first beat:

```ts
{
  id: 'beat_0_rifts',
  requiredRifts: 0,
  dialogue: [
    "Aethel's Rest trembles as the Convergence Tide surges. The World Core pulses — worlds bleed into one another along the rifts.",
    "A Purist elder grips your shoulder: 'Seal the rifts. The old worlds must be set free.'",
    "A Synthesist runner darts past: 'Attune to them — one world, one future, the way the Core intends.'",
  ],
  choices: [
    { label: '"The old worlds deserve their own sky again."', faction: 'purist', meterDelta: -18 },
    { label: '"We are meant to be one. Let the Core finish its work."', faction: 'synthesist', meterDelta: 18 },
    { label: '"I need to see more before I pick a side."', faction: 'neutral', meterDelta: 0 },
  ],
},
```

Author the remaining four beats (`requiredRifts` 2/4/6/7) in the same shape, reworking the existing dialogue from `beats.ts` to reference rifts/Wardens/the Core instead of gyms/Bramble's-gym/Voltspire-lab/Elite-Four. Keep the existing factional `meterDelta` values.

- [ ] **Step 2: Run the story + full suite**

Run: `npx vitest run src/game/story.rifts.test.ts && npx vitest run`
Expected: rift-beat tests pass; whole suite green (existing story tests, if any reference the old beats, are updated to the new `requiredRifts` shape in this step).

- [ ] **Step 3: Commit**

```bash
git add src/content/story/beats.ts
git commit -m "feat(convergence): rewrite story beats to the rift run"
```

---

## Self-Review

**Spec coverage:**
- `riftStates` field + save default + schema bump → Task 1. ✓
- `riftStatus` / `riftsAddressedCount` / `partyGenLean` / `sealDirectionBiome` → Task 2. ✓
- `sealRift` / `attuneRift` (meter + permanent + team-driven biome) → Task 3. ✓
- `zoneEncounters` (unsealed/sealed-A/sealed-B/attuned-bump) → Task 4. ✓
- `requiredRifts` beats + `nextBeat` + `convergenceEnding` → Task 5. ✓
- Beats rewrite to the rift run → Task 6. ✓
- Engine-only, no server/UI/region → no task touches `server/`, `web/`, `region/index.ts`, `src/ai/`. ✓

**Placeholder scan:** complete code in Tasks 1–5; Task 6 is content authoring with a worked first beat + concrete rewrite instructions (rework existing dialogue, keep meterDeltas, map requiredRifts) — appropriate for prose content, not a vague TODO.

**Type consistency:** `RiftStatus`/`RiftState`/`riftStates` (Task 1) used identically in Tasks 2–4. `partyGenLean`/`sealDirectionBiome` (Task 2) consumed by `sealRift` (Task 3). `riftsAddressedCount` (Task 2) consumed by `nextBeat` (Task 5). `StoryBeat.requiredRifts` (Task 5) authored in Task 6. `SEAL_DELTA`/`ATTUNE_DELTA`/`ATTUNE_LEVEL_BUMP` exported where tested. The `story.ts` ↔ `rift-state.ts` function cycle is called out with a fallback in Task 5.
