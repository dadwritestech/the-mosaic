# AI Brain 2c — Team Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draft an opponent's `TeamSpec` from Showdown's full dex — constrained by gym type, scaled by difficulty tier, and biased by `counterDraftStrength` — with legal movesets pulled from real learnsets, deterministic under a seed.

**Architecture:** Three pure-ish modules over the gen-scoped Showdown dex (`Dex.forGen(9)`): a species pool filter (gym-type constraint), a tier-scaled moveset builder (from the legal movepool), and the composer that drafts N species and assembles `PokemonSet`s. Output feeds straight into the Battle Bridge. No graphics; seeded RNG for reproducibility.

**Tech Stack:** TypeScript, `pokemon-showdown` (`Dex.forGen`), the existing Battle Bridge + `makeRng`, Vitest.

---

## Verified Showdown API (probed 2026-06-07)

- `Dex.forGen(9)` → gen-scoped dex. **Required** — the base `Dex.getMovePool(id)` returns an EMPTY set; only the gen-scoped one works.
- `g9.species.all()` → array of ~1425 species; each has `.name`, `.id`, `.num`, `.types` (string[]), `.isNonstandard` (string|null), `.baseStats` (hp/atk/def/spa/spd/spe), `.abilities` ({0,1?,H?,S?}).
- Type filter: `s.types.includes('Steel') && !s.isNonstandard && s.num > 0` → 56 Steel-typed (dual-types like Skarmory Steel/Flying included).
- `g9.species.getMovePool(id)` → `Set<string>` of legal move ids (58 for Skarmory).
- `g9.moves.get(id)` → move with `.name`, `.category` ('Physical'|'Special'|'Status'), `.basePower` (number), `.type` (string).

---

## File Structure

- `src/ai/species-pool.ts` — `gymSpeciesPool(gen, type?)` → candidate species list (type-constrained, standard only).
- `src/ai/moveset-builder.ts` — `buildMoveset(gen, speciesId, tier)` → up to 4 move ids, tier-scaled.
- `src/ai/team-composer.ts` — `composeTeam(def, ctx)` → `TeamSpec`. Drafts species (counter-draft BST bias), builds each `PokemonSet`.
- Tests alongside each + `src/ai/composer-integration.test.ts` (a composed team runs through the real Bridge).

---

### Task 1: Species pool (gym-type constraint)

**Files:**
- Create: `src/ai/species-pool.ts`
- Test: `src/ai/species-pool.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { gymSpeciesPool, baseStatTotal } from './species-pool';

describe('gymSpeciesPool', () => {
  it('returns only species whose typing INCLUDES the gym type (dual-types pass)', () => {
    const pool = gymSpeciesPool(9, 'Steel');
    expect(pool.length).toBeGreaterThan(20);
    for (const s of pool) expect(s.types.includes('Steel')).toBe(true);
    // a Steel/Flying mon qualifies; a pure Fire mon does not.
    expect(pool.some((s) => s.name === 'Skarmory')).toBe(true);
    expect(pool.some((s) => s.name === 'Charizard')).toBe(false);
  });

  it('excludes non-standard species and missingno (num<=0)', () => {
    const pool = gymSpeciesPool(9, 'Steel');
    for (const s of pool) { expect(s.isNonstandard).toBeFalsy(); expect(s.num).toBeGreaterThan(0); }
  });

  it('with no type returns a large standard pool', () => {
    expect(gymSpeciesPool(9).length).toBeGreaterThan(500);
  });

  it('baseStatTotal sums the six base stats', () => {
    expect(baseStatTotal({ hp: 1, atk: 2, def: 3, spa: 4, spd: 5, spe: 6 })).toBe(21);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ai/species-pool.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `species-pool.ts`**

```ts
import * as Sim from 'pokemon-showdown';

export interface SpeciesLite {
  name: string;
  id: string;
  num: number;
  types: string[];
  baseStats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  isNonstandard: string | null;
  ability: string;
}

export function baseStatTotal(b: SpeciesLite['baseStats']): number {
  return b.hp + b.atk + b.def + b.spa + b.spd + b.spe;
}

/** Standard species whose typing includes `type` (or all standard species if omitted). */
export function gymSpeciesPool(gen: number, type?: string): SpeciesLite[] {
  const dex = (Sim.Dex as any).forGen(gen);
  const out: SpeciesLite[] = [];
  for (const s of dex.species.all() as any[]) {
    if (s.isNonstandard || s.num <= 0) continue;
    if (type && !s.types.includes(type)) continue;
    out.push({
      name: s.name, id: s.id, num: s.num, types: s.types.slice(),
      baseStats: s.baseStats, isNonstandard: s.isNonstandard,
      ability: (s.abilities && (s.abilities['0'] as string)) || 'No Ability',
    });
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/ai/species-pool.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ai/species-pool.ts src/ai/species-pool.test.ts
git commit -m "feat(ai): gym-type-constrained species pool from the dex"
```

---

### Task 2: Tier-scaled moveset builder

**Files:**
- Create: `src/ai/moveset-builder.ts`
- Test: `src/ai/moveset-builder.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { buildMoveset } from './moveset-builder';
import * as Sim from 'pokemon-showdown';

const bp = (id: string) => (Sim.Dex as any).forGen(9).moves.get(id).basePower as number;
const avgBp = (ids: string[]) => {
  const dmg = ids.map((id) => (Sim.Dex as any).forGen(9).moves.get(id)).filter((m: any) => m.category !== 'Status' && m.basePower > 0);
  return dmg.length ? dmg.reduce((a: number, m: any) => a + m.basePower, 0) / dmg.length : 0;
};

describe('buildMoveset', () => {
  it('returns 1..4 legal moves including at least one damaging move', () => {
    const moves = buildMoveset(9, 'skarmory', 'hard');
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.length).toBeLessThanOrEqual(4);
    expect(moves.some((id) => bp(id) > 0)).toBe(true);
  });

  it('hard tier picks higher-power damaging moves than easy tier', () => {
    const hard = buildMoveset(9, 'skarmory', 'hard');
    const easy = buildMoveset(9, 'skarmory', 'easy');
    expect(avgBp(hard)).toBeGreaterThan(avgBp(easy));
  });

  it('is deterministic for a given species+tier', () => {
    expect(buildMoveset(9, 'skarmory', 'normal')).toEqual(buildMoveset(9, 'skarmory', 'normal'));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ai/moveset-builder.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `moveset-builder.ts`**

```ts
import * as Sim from 'pokemon-showdown';
import type { BaseTier } from './difficulty-controller';

interface MoveLite { id: string; category: string; basePower: number; type: string; }

function poolMoves(gen: number, speciesId: string): MoveLite[] {
  const dex = (Sim.Dex as any).forGen(gen);
  const ids: string[] = Array.from(dex.species.getMovePool(speciesId));
  return ids.map((id) => {
    const m = dex.moves.get(id);
    return { id, category: m.category, basePower: m.basePower, type: m.type };
  });
}

/**
 * Up to 4 moves, tier-scaled. Hard = the strongest damaging coverage (distinct
 * types) + a utility move. Easy = weaker damaging moves. Always >=1 damaging move.
 * Deterministic: sorts by basePower, no RNG.
 */
export function buildMoveset(gen: number, speciesId: string, tier: BaseTier): string[] {
  const all = poolMoves(gen, speciesId);
  const damaging = all.filter((m) => m.category !== 'Status' && m.basePower > 0)
    .sort((a, b) => b.basePower - a.basePower);
  const status = all.filter((m) => m.category === 'Status').map((m) => m.id);

  if (damaging.length === 0) return all.slice(0, 4).map((m) => m.id); // pathological fallback

  // Tier selects the slice of damaging moves to draw from.
  const ranked = tier === 'hard' ? damaging
    : tier === 'normal' ? damaging.slice(Math.floor(damaging.length * 0.15))
    : damaging.slice(Math.floor(damaging.length * 0.5)); // easy = weaker half

  // Pick distinct-type coverage from the ranked list.
  const picked: string[] = [];
  const seenTypes = new Set<string>();
  for (const m of ranked) {
    if (seenTypes.has(m.type)) continue;
    picked.push(m.id); seenTypes.add(m.type);
    if (picked.length >= (tier === 'hard' ? 3 : 4)) break;
  }
  // Top up with next-best damaging if coverage was thin.
  for (const m of ranked) { if (picked.length >= 4) break; if (!picked.includes(m.id)) picked.push(m.id); }
  // Hard tier gets one utility/status move if room remains.
  if (tier === 'hard' && picked.length < 4 && status.length) picked.push(status[0]);

  return picked.slice(0, 4);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/ai/moveset-builder.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ai/moveset-builder.ts src/ai/moveset-builder.test.ts
git commit -m "feat(ai): tier-scaled moveset builder from legal movepool"
```

---

### Task 3: Team composer

**Files:**
- Create: `src/ai/team-composer.ts`
- Test: `src/ai/team-composer.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { composeTeam } from './team-composer';
import type { TrainerDef, ComposeContext } from './team-composer';
import { makeRng } from './rng';

const def = (over: Partial<TrainerDef> = {}): TrainerDef => ({
  baseTier: 'hard', teamSize: 3, levelCap: 50, gymType: 'Steel', ...over,
});
const ctx = (over: Partial<ComposeContext> = {}): ComposeContext => ({
  gen: 9, counterDraftStrength: 0, rng: makeRng(11), ...over,
});

describe('composeTeam', () => {
  it('drafts the requested number of mons, all matching the gym type', () => {
    const team = composeTeam(def(), ctx());
    expect(team.length).toBe(3);
    for (const set of team) {
      const types = (require('pokemon-showdown').Dex as any).forGen(9).species.get(set.species).types;
      expect(types.includes('Steel')).toBe(true);
      expect(set.level).toBe(50);
      expect(set.moves.length).toBeGreaterThan(0);
    }
  });

  it('is deterministic for the same def + seed', () => {
    const a = composeTeam(def(), ctx({ rng: makeRng(99) }));
    const b = composeTeam(def(), ctx({ rng: makeRng(99) }));
    expect(a.map((s) => s.species)).toEqual(b.map((s) => s.species));
  });

  it('higher counterDraftStrength drafts a stronger team (higher avg base-stat total)', () => {
    const { baseStatTotal, gymSpeciesPool } = require('./species-pool');
    const bstOf = (species: string) => {
      const s = gymSpeciesPool(9, 'Steel').find((x: any) => x.name === species || x.id === species.toLowerCase());
      return s ? baseStatTotal(s.baseStats) : 0;
    };
    const avg = (team: any[]) => team.reduce((a, s) => a + bstOf(s.species), 0) / team.length;
    const weak = composeTeam(def({ teamSize: 4 }), ctx({ counterDraftStrength: 0, rng: makeRng(5) }));
    const strong = composeTeam(def({ teamSize: 4 }), ctx({ counterDraftStrength: 1, rng: makeRng(5) }));
    expect(avg(strong)).toBeGreaterThan(avg(weak));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ai/team-composer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `team-composer.ts`**

```ts
import type { TeamSpec, PokemonSet } from '../bridge/types';
import type { BaseTier } from './difficulty-controller';
import { gymSpeciesPool, baseStatTotal, type SpeciesLite } from './species-pool';
import { buildMoveset } from './moveset-builder';

export interface TrainerDef {
  baseTier: BaseTier;
  teamSize: number;
  levelCap: number;
  gymType?: string;
}

export interface ComposeContext {
  gen: number;
  counterDraftStrength: number; // 0..1 — higher = prefer stronger mons (tougher tailored team)
  rng: () => number;
}

function pickWeighted(pool: SpeciesLite[], counter: number, rng: () => number): SpeciesLite {
  // weight = 1 + counter * (normalized BST). counter=0 -> uniform; counter=1 -> favor strong.
  const bsts = pool.map((s) => baseStatTotal(s.baseStats));
  const min = Math.min(...bsts), max = Math.max(...bsts);
  const span = max - min || 1;
  const weights = pool.map((s, i) => 1 + counter * 3 * ((bsts[i] - min) / span));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

const EVS_BY_TIER: Record<BaseTier, PokemonSet['evs']> = {
  easy:   { hp: 85, atk: 85, def: 85, spa: 85, spd: 85, spe: 85 },
  normal: { hp: 0, atk: 128, def: 64, spa: 128, spd: 64, spe: 128 },
  hard:   { hp: 0, atk: 252, def: 4, spa: 252, spd: 0, spe: 252 },
};

export function composeTeam(def: TrainerDef, ctx: ComposeContext): TeamSpec {
  const pool = gymSpeciesPool(ctx.gen, def.gymType);
  const chosen: SpeciesLite[] = [];
  const used = new Set<string>();
  let guard = 0;
  while (chosen.length < def.teamSize && guard++ < def.teamSize * 50 && used.size < pool.length) {
    const pick = pickWeighted(pool, ctx.counterDraftStrength, ctx.rng);
    if (used.has(pick.id)) continue;
    used.add(pick.id); chosen.push(pick);
  }

  const ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
  return chosen.map((s): PokemonSet => ({
    name: s.name,
    species: s.name,
    ability: s.ability,
    item: def.baseTier === 'hard' ? 'Leftovers' : '',
    moves: buildMoveset(ctx.gen, s.id, def.baseTier),
    nature: 'Hardy',
    evs: EVS_BY_TIER[def.baseTier],
    ivs,
    level: def.levelCap,
  }));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/ai/team-composer.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ai/team-composer.ts src/ai/team-composer.test.ts
git commit -m "feat(ai): team composer — gym-type draft with counter-draft BST bias"
```

---

### Task 4: Integration — a composed team battles through the Bridge

**Files:**
- Create: `src/ai/composer-integration.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { BattleBridge } from '../bridge/battle-bridge';
import { composeTeam } from './team-composer';
import { makeRng } from './rng';

describe('composer -> Bridge integration', () => {
  it('a composed gym team is a legal team that battles to completion', async () => {
    const steelTeam = composeTeam(
      { baseTier: 'hard', teamSize: 3, levelCap: 50, gymType: 'Steel' },
      { gen: 9, counterDraftStrength: 0.5, rng: makeRng(21) },
    );
    const fireTeam = composeTeam(
      { baseTier: 'normal', teamSize: 3, levelCap: 50, gymType: 'Fire' },
      { gen: 9, counterDraftStrength: 0, rng: makeRng(22) },
    );

    const bridge = new BattleBridge();
    await bridge.startBattle(steelTeam, fireTeam, { formatid: 'gen9customgame' });

    let guard = 0;
    while (bridge.state.winner === undefined && guard++ < 300) {
      // simple scripted play: both sides use move 1 / default switch handled by Bridge.
      await bridge.submitTurn({ kind: 'move', index: 1 }, { kind: 'move', index: 1 });
    }
    expect(['p1', 'p2']).toContain(bridge.state.winner);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/ai/composer-integration.test.ts`
Expected: PASS. If a turn rejects `move 1` because the active mon must switch (a fainted-mon forced switch with multi-mon teams), that exposes the Bridge's known multi-mon `forceSwitch` gap — in that case, see Step 3.

- [ ] **Step 3: If multi-mon forced switches block completion, extend the Bridge minimally**

The Battle Bridge (sub-project 1) auto-resolves `teamPreview`/`wait` but does not yet
drive mid-battle `forceSwitch` (it was scoped to single-active singles). For this
integration to pass with 3-mon teams, add `forceSwitch` handling in
`src/bridge/battle-bridge.ts` `consumeRequests`: when a stored request has
`forceSwitch`, the bridge should auto-send `default` (send the next available mon) so
scripted play can continue.

In `consumeRequests`, change the stored-request branch to auto-resolve forced switches:

```ts
          if (req.wait) { this.latestRequest[side] = null; continue; }
          if (req.teamPreview) { void s.write('default'); continue; }
          if (req.forceSwitch) { void s.write('default'); this.latestRequest[side] = null; continue; }
          this.latestRequest[side] = req; // active move request
```

Re-run Step 2. (This is a deliberate, minimal extension of the Bridge to support
multi-mon teams; full player-driven switch selection arrives with the UI later.)

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: ALL pass (bridge + 2a + 2b + 2c).

- [ ] **Step 5: Commit**

```bash
git add src/ai/composer-integration.test.ts src/bridge/battle-bridge.ts
git commit -m "test(ai): composed gym teams battle through the Bridge (+forceSwitch auto-resolve)"
```

---

### Task 5: Typecheck + wrap

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Typecheck + full suite**

Run: `npm run typecheck && npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 2: Append to `README.md`**

````markdown
## AI Brain (sub-project 2c — team composer)

```ts
import { composeTeam } from './src/ai/team-composer';
import { makeRng } from './src/ai/rng';

const gymTeam = composeTeam(
  { baseTier: 'hard', teamSize: 6, levelCap: 50, gymType: 'Steel' },
  { gen: 9, counterDraftStrength: 0.7, rng: makeRng(seed) },
); // -> TeamSpec for the Battle Bridge
```

Every drafted mon's typing includes the gym type (dual-types allowed); movesets come
from real legal movepools, tier-scaled; `counterDraftStrength` (from the difficulty
controller) biases toward stronger mons. Deterministic under a seed.
````

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: team composer (plan 2c) usage — AI Brain complete"
```

---

## Self-Review notes

- **Spec coverage (2c slice):** gym-type constraint with dual-type inclusion (Task 1);
  movesets from real learnsets, tier-scaled (Task 2); draft of N species with
  `counterDraftStrength` bias + determinism + `TeamSpec` output (Task 3); composed
  teams are legal and battle through the Bridge (Task 4). Deferred (by design):
  deep type-matchup counter-drafting against the player's specific tendencies (current
  counter-draft is a BST/strength proxy — a clean, testable first cut; tendency-aware
  countering can layer on once the game feeds live profiles).
- **Verified-API risks settled:** `Dex.forGen(gen)` required (base `getMovePool` is
  empty); species `.types`/`.isNonstandard`/`.num`/`.baseStats`/`.abilities` shapes;
  `moves.get(id)` `.category`/`.basePower`/`.type`.
- **Cross-sub-project note:** Task 4 may surface the Bridge's known multi-mon
  `forceSwitch` gap and includes the minimal fix (auto-`default`), advancing the
  Bridge from single-active to multi-mon scripted play.
- **Type consistency:** `BaseTier` reused from `difficulty-controller`; `SpeciesLite`/
  `baseStatTotal` shared Tasks 1→3; `PokemonSet`/`TeamSpec` from `bridge/types`.
```
