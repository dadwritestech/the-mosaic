# AI Brain 2a — Decision Brain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the in-battle decision core of the AI — a pure `chooseAction(view, ctx) → Action` that scores legal moves/switches using a `@smogon/calc` damage model, with difficulty knobs (randomness, shallow lookahead) and personality weights, then prove it plays competently through the real Battle Bridge.

**Architecture:** A pure scorer fed a caller-assembled `BattleView` (omniscient PvE: it sees both sides' full sets + live HP/status). A `calc-evaluator` wraps `@smogon/calc` to return expected damage % and one-turn KO chance. The brain scores each option, optionally subtracts self-risk via a 1-ply lookahead (Hard tier), applies personality, and lets a seeded `randomness` knob perturb the pick. No graphics, no learning yet (that's plan 2b), no team drafting (2c).

**Tech Stack:** TypeScript, `@smogon/calc` (verified 0.11.x), the existing Battle Bridge, Vitest.

---

## File Structure

- `src/ai/rng.ts` — seedable RNG (mulberry32) for deterministic tests.
- `src/ai/types.ts` — `Knobs`, `Personality`, `ActiveView`, `BattleView`, `BrainContext`, `MoveOption`.
- `src/ai/calc-evaluator.ts` — wraps `@smogon/calc`: `evaluateMove(...) → { avgDamagePercent, koThisTurnChance }`.
- `src/ai/decision-brain.ts` — `chooseAction(view, ctx): Action` + internal scoring.
- `src/ai/view-from-bridge.ts` — test/glue helper: assemble a `BattleView` from Battle Bridge state + known `TeamSpec`s.
- Tests alongside each (`*.test.ts`), plus `src/ai/brain-integration.test.ts` (brain drives p2 through the real Bridge).

Rationale: `calc-evaluator` (analytical model) and `decision-brain` (policy) are separate so each is testable alone; `rng` is injected so "randomness" is deterministic under a seed.

---

### Task 1: Seedable RNG

**Files:**
- Create: `src/ai/rng.ts`
- Test: `src/ai/rng.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { makeRng } from './rng';

describe('makeRng', () => {
  it('is deterministic for a given seed', () => {
    const a = makeRng(42); const b = makeRng(42);
    const seqA = [a(), a(), a()]; const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });
  it('returns values in [0,1)', () => {
    const r = makeRng(1);
    for (let i = 0; i < 100; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
  it('differs across seeds', () => {
    expect(makeRng(1)()).not.toEqual(makeRng(2)());
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ai/rng.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `rng.ts`**

```ts
/** Deterministic, seedable PRNG (mulberry32). Returns a function yielding [0,1). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/ai/rng.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ai/rng.ts src/ai/rng.test.ts
git commit -m "feat(ai): seedable mulberry32 rng"
```

---

### Task 2: AI types

**Files:**
- Create: `src/ai/types.ts`
- Test: `src/ai/types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import type { Knobs, Personality, BattleView, ActiveView } from './types';

describe('ai types', () => {
  it('constructs a minimal BattleView', () => {
    const set = {
      name: 'Pikachu', species: 'Pikachu', ability: 'Static', item: '',
      moves: ['thunderbolt'], nature: 'Hardy',
      evs: { hp: 0, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 },
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50,
    };
    const av: ActiveView = { set, hpPercent: 100, status: '' };
    const view: BattleView = {
      self: av, selfBench: [], opponent: av,
      moves: [{ index: 1, id: 'thunderbolt', name: 'Thunderbolt' }],
    };
    const knobs: Knobs = { randomness: 0, lookaheadDepth: 1, switchSmarts: 1 };
    const pers: Personality = { aggression: 0.5, caution: 0.5 };
    expect(view.moves[0].id).toBe('thunderbolt');
    expect(knobs.lookaheadDepth).toBe(1);
    expect(pers.aggression).toBe(0.5);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ai/types.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `types.ts`**

```ts
import type { PokemonSet } from '../bridge/types';

export interface ActiveView {
  set: PokemonSet;
  hpPercent: number;          // 0..100
  status: string;             // '', 'brn', 'par', 'slp', 'psn', 'tox', 'frz'
  boosts?: Partial<Record<'atk' | 'def' | 'spa' | 'spd' | 'spe', number>>;
}

export interface MoveOption { index: number; id: string; name: string; }
export interface SwitchOption { index: number; }

export interface BattleView {
  self: ActiveView;           // the AI's active mon
  selfBench: ActiveView[];    // the AI's non-active, non-fainted mons (in switch order)
  opponent: ActiveView;       // the player's active mon (omniscient PvE)
  moves: MoveOption[];        // legal moves this turn (from the Bridge)
  switchIndices?: number[];   // legal switch slot indices (1-based), optional
}

export interface Knobs {
  randomness: number;         // 0..1, P(pick a random legal action instead of best)
  lookaheadDepth: 0 | 1;      // 1 = subtract self-risk from opponent's best retaliation
  switchSmarts: number;       // 0..1, willingness/quality of switching
}

export interface Personality {
  aggression: number;         // 0..1, weights raw damage / KO
  caution: number;            // 0..1, weights self-preservation / switching
}

export interface BrainContext {
  gen: number;                // generation for @smogon/calc (e.g. 9)
  knobs: Knobs;
  personality: Personality;
  rng: () => number;          // injected for deterministic randomness
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/ai/types.test.ts && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/ai/types.ts src/ai/types.test.ts
git commit -m "feat(ai): brain type contract"
```

---

### Task 3: calc-evaluator (wraps @smogon/calc)

**Verified @smogon/calc facts (0.11.x):** `Generations.get(9)`; `new Pokemon(gen, name, {level, evs, ivs, nature, item, ability, status, curHP, boosts})`; `new Move(gen, name)`; `calculate(gen, atk, def, move)` → Result; `result.damage` is a number or array of rolls; `result.kochance()` → `{chance?, n, text}` where **`chance` is the one-turn KO probability and is OMITTED when `n>1`** (i.e. cannot KO this turn). `def.maxHP()` gives max HP.

**Files:**
- Create: `src/ai/calc-evaluator.ts`
- Test: `src/ai/calc-evaluator.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { evaluateMove } from './calc-evaluator';
import type { ActiveView } from './types';

const set = (species: string, extra: Partial<any> = {}) => ({
  name: species, species, ability: extra.ability ?? '', item: extra.item ?? '',
  moves: extra.moves ?? [], nature: 'Hardy',
  evs: extra.evs ?? { hp: 0, atk: 252, def: 0, spa: 252, spd: 0, spe: 0 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50,
});

describe('evaluateMove', () => {
  it('reports a guaranteed OHKO as koThisTurnChance=1 for a strong hit', () => {
    const atk: ActiveView = { set: set('Pikachu', { evs: { spa: 252 } }), hpPercent: 100, status: '' };
    const def: ActiveView = { set: set('Gyarados'), hpPercent: 100, status: '' };
    const r = evaluateMove(9, atk, def, 'Thunderbolt');
    expect(r.koThisTurnChance).toBe(1);
    expect(r.avgDamagePercent).toBeGreaterThan(90);
  });

  it('reports koThisTurnChance=0 when the move cannot KO this turn', () => {
    const atk: ActiveView = { set: set('Pikachu', { evs: { spa: 252 } }), hpPercent: 100, status: '' };
    const def: ActiveView = { set: set('Snorlax', { evs: { hp: 252, spd: 252 } }), hpPercent: 100, status: '' };
    const r = evaluateMove(9, atk, def, 'Thunderbolt');
    expect(r.koThisTurnChance).toBe(0);
    expect(r.avgDamagePercent).toBeGreaterThan(0);
  });

  it('a damaged + statused target is easier to KO', () => {
    const atk: ActiveView = { set: set('Pikachu', { evs: { spa: 252 } }), hpPercent: 100, status: '' };
    const full: ActiveView = { set: set('Snorlax', { evs: { hp: 252 } }), hpPercent: 100, status: '' };
    const weak: ActiveView = { set: set('Snorlax', { evs: { hp: 252 } }), hpPercent: 12, status: 'brn' };
    expect(evaluateMove(9, atk, weak, 'Thunderbolt').koThisTurnChance)
      .toBeGreaterThan(evaluateMove(9, atk, full, 'Thunderbolt').koThisTurnChance);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ai/calc-evaluator.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `calc-evaluator.ts`**

```ts
import * as calc from '@smogon/calc';
import type { ActiveView } from './types';

export interface MoveEval {
  avgDamagePercent: number;   // mean damage as % of defender max HP
  koThisTurnChance: number;   // 0..1 probability of KO this turn (0 if needs >1 turn)
}

function toCalcPokemon(gen: any, v: ActiveView): any {
  const s = v.set;
  const maxHP = new calc.Pokemon(gen, s.species, {
    level: s.level, evs: s.evs, ivs: s.ivs, nature: s.nature,
    item: s.item || undefined, ability: s.ability || undefined,
  }).maxHP();
  const curHP = Math.max(1, Math.round((v.hpPercent / 100) * maxHP));
  return new calc.Pokemon(gen, s.species, {
    level: s.level, evs: s.evs, ivs: s.ivs, nature: s.nature,
    item: s.item || undefined, ability: s.ability || undefined,
    status: v.status || undefined,
    curHP,
    boosts: v.boosts as any,
  });
}

export function evaluateMove(genNum: number, attacker: ActiveView, defender: ActiveView, moveName: string): MoveEval {
  const gen = calc.Generations.get(genNum);
  const atk = toCalcPokemon(gen, attacker);
  const def = toCalcPokemon(gen, defender);
  const move = new calc.Move(gen, moveName);
  const result = calc.calculate(gen, atk, def, move);

  const dmg = result.damage;
  const rolls: number[] = Array.isArray(dmg) ? (dmg as number[]) : [Number(dmg)];
  const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
  const avgDamagePercent = (avg / def.maxHP()) * 100;

  const ko = result.kochance();
  // chance is present only for a one-turn KO (n===1). Absent/n>1 => cannot KO now.
  const koThisTurnChance = ko && ko.n === 1 && typeof ko.chance === 'number' ? ko.chance : 0;

  return { avgDamagePercent, koThisTurnChance };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/ai/calc-evaluator.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ai/calc-evaluator.ts src/ai/calc-evaluator.test.ts
git commit -m "feat(ai): @smogon/calc evaluator for damage% and KO chance"
```

---

### Task 4: Decision brain — move scoring

**Files:**
- Create: `src/ai/decision-brain.ts`
- Test: `src/ai/decision-brain.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { chooseAction } from './decision-brain';
import type { BattleView, BrainContext } from './types';
import { makeRng } from './rng';

const set = (species: string, moves: string[], extra: Partial<any> = {}) => ({
  name: species, species, ability: extra.ability ?? '', item: extra.item ?? '',
  moves, nature: 'Hardy',
  evs: extra.evs ?? { hp: 0, atk: 252, def: 0, spa: 252, spd: 0, spe: 0 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50,
});

const ctx = (over: Partial<BrainContext> = {}): BrainContext => ({
  gen: 9,
  knobs: { randomness: 0, lookaheadDepth: 0, switchSmarts: 0 },
  personality: { aggression: 1, caution: 0 },
  rng: makeRng(7),
  ...over,
});

describe('chooseAction — move scoring', () => {
  it('picks the super-effective move over a weak one', () => {
    // Pikachu vs Gyarados: Thunderbolt (4x) should beat Quick Attack.
    const selfSet = set('Pikachu', ['thunderbolt', 'quickattack'], { evs: { spa: 252 } });
    const oppSet = set('Gyarados', ['waterfall']);
    const view: BattleView = {
      self: { set: selfSet, hpPercent: 100, status: '' },
      selfBench: [],
      opponent: { set: oppSet, hpPercent: 100, status: '' },
      moves: [
        { index: 1, id: 'thunderbolt', name: 'Thunderbolt' },
        { index: 2, id: 'quickattack', name: 'Quick Attack' },
      ],
    };
    const action = chooseAction(view, ctx());
    expect(action).toEqual({ kind: 'move', index: 1 });
  });

  it('prefers a lethal move over a stronger-looking non-lethal one', () => {
    // Against a nearly-fainted foe, the guaranteed KO move wins even if another
    // move has higher raw power but the foe would survive neither — KO bonus decides.
    const selfSet = set('Pikachu', ['thunderbolt', 'thunderwave'], { evs: { spa: 252 } });
    const oppSet = set('Snorlax', ['bodyslam'], { evs: { hp: 252 } });
    const view: BattleView = {
      self: { set: selfSet, hpPercent: 100, status: '' },
      selfBench: [],
      opponent: { set: oppSet, hpPercent: 8, status: '' },
      moves: [
        { index: 1, id: 'thunderbolt', name: 'Thunderbolt' },
        { index: 2, id: 'thunderwave', name: 'Thunder Wave' },
      ],
    };
    const action = chooseAction(view, ctx());
    expect(action).toEqual({ kind: 'move', index: 1 }); // the damaging KO, not status
  });

  it('randomness=1 still returns a legal move index', () => {
    const selfSet = set('Pikachu', ['thunderbolt', 'quickattack'], { evs: { spa: 252 } });
    const oppSet = set('Gyarados', ['waterfall']);
    const view: BattleView = {
      self: { set: selfSet, hpPercent: 100, status: '' },
      selfBench: [],
      opponent: { set: oppSet, hpPercent: 100, status: '' },
      moves: [
        { index: 1, id: 'thunderbolt', name: 'Thunderbolt' },
        { index: 2, id: 'quickattack', name: 'Quick Attack' },
      ],
    };
    const action = chooseAction(view, ctx({ knobs: { randomness: 1, lookaheadDepth: 0, switchSmarts: 0 } }));
    expect(action.kind).toBe('move');
    if (action.kind === 'move') expect([1, 2]).toContain(action.index);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ai/decision-brain.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `decision-brain.ts` (move scoring only; switching added in Task 5)**

```ts
import type { Action } from '../bridge/types';
import type { BattleView, BrainContext, MoveOption } from './types';
import { evaluateMove } from './calc-evaluator';

interface Scored { action: Action; score: number; }

// Score a single move option from the AI's perspective.
function scoreMove(view: BattleView, ctx: BrainContext, move: MoveOption): number {
  const e = evaluateMove(ctx.gen, view.self, view.opponent, move.name);
  // Base value: expected damage %, with a large bonus for an actual KO this turn.
  let score = e.avgDamagePercent * ctx.personality.aggression;
  score += e.koThisTurnChance * 1000; // securing a KO dominates
  return score;
}

export function chooseAction(view: BattleView, ctx: BrainContext): Action {
  const candidates: Scored[] = view.moves.map((m) => ({
    action: { kind: 'move', index: m.index } as Action,
    score: scoreMove(view, ctx, m),
  }));

  // Epsilon-random: with probability `randomness`, pick any legal action.
  if (ctx.rng() < ctx.knobs.randomness) {
    const pick = candidates[Math.floor(ctx.rng() * candidates.length)];
    return pick.action;
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].action;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/ai/decision-brain.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ai/decision-brain.ts src/ai/decision-brain.test.ts
git commit -m "feat(ai): decision brain move scoring (damage + KO + randomness)"
```

---

### Task 5: Switching + shallow lookahead (self-risk)

**Files:**
- Modify: `src/ai/decision-brain.ts`
- Test: `src/ai/decision-brain-switch.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { chooseAction } from './decision-brain';
import type { BattleView, BrainContext } from './types';
import { makeRng } from './rng';

const set = (species: string, moves: string[], extra: Partial<any> = {}) => ({
  name: species, species, ability: extra.ability ?? '', item: extra.item ?? '',
  moves, nature: 'Hardy',
  evs: extra.evs ?? { hp: 0, atk: 252, def: 0, spa: 252, spd: 0, spe: 0 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50,
});

const ctx = (over: Partial<BrainContext> = {}): BrainContext => ({
  gen: 9,
  knobs: { randomness: 0, lookaheadDepth: 1, switchSmarts: 1 },
  personality: { aggression: 1, caution: 1 },
  rng: makeRng(3),
  ...over,
});

describe('chooseAction — switching + lookahead', () => {
  it('switches away when the active mon faces a hopeless matchup and a great answer is benched', () => {
    // Active Magikarp (only Splash) vs Pikachu; benched Sandshrew (Ground, immune to Electric, strong).
    const view: BattleView = {
      self: { set: set('Magikarp', ['splash']), hpPercent: 100, status: '' },
      selfBench: [{ set: set('Sandshrew', ['earthquake'], { evs: { atk: 252 } }), hpPercent: 100, status: '' }],
      opponent: { set: set('Pikachu', ['thunderbolt'], { evs: { spa: 252 } }), hpPercent: 100, status: '' },
      moves: [{ index: 1, id: 'splash', name: 'Splash' }],
      switchIndices: [2],
    };
    const action = chooseAction(view, ctx());
    expect(action).toEqual({ kind: 'switch', index: 2 });
  });

  it('does NOT switch when switchSmarts=0 even in a bad matchup', () => {
    const view: BattleView = {
      self: { set: set('Magikarp', ['splash']), hpPercent: 100, status: '' },
      selfBench: [{ set: set('Sandshrew', ['earthquake'], { evs: { atk: 252 } }), hpPercent: 100, status: '' }],
      opponent: { set: set('Pikachu', ['thunderbolt'], { evs: { spa: 252 } }), hpPercent: 100, status: '' },
      moves: [{ index: 1, id: 'splash', name: 'Splash' }],
      switchIndices: [2],
    };
    const action = chooseAction(view, ctx({ knobs: { randomness: 0, lookaheadDepth: 1, switchSmarts: 0 } }));
    expect(action).toEqual({ kind: 'move', index: 1 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ai/decision-brain-switch.test.ts`
Expected: FAIL — switches not yet considered.

- [ ] **Step 3: Extend `decision-brain.ts`**

Replace the body of `chooseAction` and add helpers. Full updated file:

```ts
import type { Action } from '../bridge/types';
import type { BattleView, BrainContext, MoveOption, ActiveView } from './types';
import { evaluateMove } from './calc-evaluator';

interface Scored { action: Action; score: number; }

// Best expected damage% the `attacker` view can do to the `defender` view this turn,
// across the attacker's own moveset. Used for matchup + self-risk lookahead.
function bestOutgoing(view: BattleView, ctx: BrainContext, attacker: ActiveView, defender: ActiveView): number {
  let best = 0;
  for (const moveName of attacker.set.moves) {
    const e = evaluateMove(ctx.gen, attacker, defender, moveName);
    const val = e.avgDamagePercent + e.koThisTurnChance * 1000;
    if (val > best) best = val;
  }
  return best;
}

function scoreMove(view: BattleView, ctx: BrainContext, move: MoveOption): number {
  const e = evaluateMove(ctx.gen, view.self, view.opponent, move.name);
  let score = e.avgDamagePercent * ctx.personality.aggression;
  score += e.koThisTurnChance * 1000;
  // Shallow lookahead: subtract the opponent's best retaliation against us (self-risk).
  if (ctx.knobs.lookaheadDepth >= 1) {
    const risk = bestOutgoing(view, ctx, view.opponent, view.self);
    score -= risk * ctx.personality.caution * 0.5;
  }
  return score;
}

// Score a switch: value of the incoming mon's matchup minus the free hit we take
// coming in. Scaled by switchSmarts so it can be tuned/disabled per difficulty.
function scoreSwitch(view: BattleView, ctx: BrainContext, benchIdx: number, switchSlot: number): number {
  const incoming = view.selfBench[benchIdx];
  const ourOffense = bestOutgoing(view, ctx, incoming, view.opponent);
  const incomingRisk = bestOutgoing(view, ctx, view.opponent, incoming);
  const matchup = ourOffense - incomingRisk;
  return matchup * ctx.knobs.switchSmarts;
}

export function chooseAction(view: BattleView, ctx: BrainContext): Action {
  const candidates: Scored[] = view.moves.map((m) => ({
    action: { kind: 'move', index: m.index } as Action,
    score: scoreMove(view, ctx, m),
  }));

  const slots = view.switchIndices ?? [];
  slots.forEach((slot, i) => {
    if (i < view.selfBench.length && ctx.knobs.switchSmarts > 0) {
      candidates.push({
        action: { kind: 'switch', index: slot } as Action,
        score: scoreSwitch(view, ctx, i, slot),
      });
    }
  });

  if (ctx.rng() < ctx.knobs.randomness) {
    const pick = candidates[Math.floor(ctx.rng() * candidates.length)];
    return pick.action;
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].action;
}
```

- [ ] **Step 4: Run to verify both brain test files pass**

Run: `npx vitest run src/ai/decision-brain.test.ts src/ai/decision-brain-switch.test.ts`
Expected: PASS (5 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/ai/decision-brain.ts src/ai/decision-brain-switch.test.ts
git commit -m "feat(ai): switching + 1-ply self-risk lookahead in decision brain"
```

---

### Task 6: View assembler (Bridge state → BattleView)

The brain is pure; this helper builds its input from the live Battle Bridge plus the
known team specs (omniscient PvE). For single-active singles it maps the active
species back to its `PokemonSet` by species name.

**Files:**
- Create: `src/ai/view-from-bridge.ts`
- Test: `src/ai/view-from-bridge.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildView } from './view-from-bridge';
import { PIKACHU_TEAM, GYARADOS_TEAM } from '../bridge/test-teams';

describe('buildView', () => {
  it('assembles a BattleView for the AI side from active species + teams', () => {
    const state = {
      isWild: false, turn: 1,
      active: { p1: { species: 'Pikachu', hpPercent: 100, status: '' },
                p2: { species: 'Gyarados', hpPercent: 100, status: '' } },
      winner: undefined as const,
    };
    const moves = [{ index: 1, id: 'waterfall', name: 'Waterfall' }];
    const view = buildView('p2', state, GYARADOS_TEAM, PIKACHU_TEAM, moves, []);
    expect(view.self.set.species).toBe('Gyarados');
    expect(view.opponent.set.species).toBe('Pikachu');
    expect(view.moves[0].id).toBe('waterfall');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ai/view-from-bridge.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `view-from-bridge.ts`**

```ts
import type { BattleState, Side, TeamSpec } from '../bridge/types';
import type { BattleView, MoveOption, ActiveView } from './types';

function activeView(species: string, hpPercent: number, status: string, team: TeamSpec): ActiveView {
  const set = team.find((s) => s.species === species) ?? team[0];
  return { set, hpPercent, status };
}

export function buildView(
  aiSide: Side,
  state: BattleState,
  aiTeam: TeamSpec,
  oppTeam: TeamSpec,
  moves: MoveOption[],
  switchIndices: number[],
): BattleView {
  const oppSide: Side = aiSide === 'p1' ? 'p2' : 'p1';
  const selfActive = state.active[aiSide]!;
  const oppActive = state.active[oppSide]!;
  const selfView = activeView(selfActive.species, selfActive.hpPercent, selfActive.status, aiTeam);
  const bench = aiTeam
    .filter((s) => s.species !== selfActive.species)
    .map((s) => ({ set: s, hpPercent: 100, status: '' } as ActiveView));
  return {
    self: selfView,
    selfBench: bench,
    opponent: activeView(oppActive.species, oppActive.hpPercent, oppActive.status, oppTeam),
    moves,
    switchIndices,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/ai/view-from-bridge.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ai/view-from-bridge.ts src/ai/view-from-bridge.test.ts
git commit -m "feat(ai): assemble BattleView from Bridge state + teams"
```

---

### Task 7: Integration — brain plays through the real Battle Bridge

**Files:**
- Create: `src/ai/brain-integration.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { BattleBridge } from '../bridge/battle-bridge';
import { PIKACHU_TEAM, GYARADOS_TEAM } from '../bridge/test-teams';
import { chooseAction } from './decision-brain';
import { buildView } from './view-from-bridge';
import { makeRng } from './rng';
import type { BrainContext } from './types';
import type { Action } from '../bridge/types';

function brainCtx(seed: number, hard: boolean): BrainContext {
  return {
    gen: 9,
    knobs: hard
      ? { randomness: 0.0, lookaheadDepth: 1, switchSmarts: 1 }
      : { randomness: 0.85, lookaheadDepth: 0, switchSmarts: 0 },
    personality: { aggression: 1, caution: hard ? 1 : 0 },
    rng: makeRng(seed),
  };
}

// Runs one battle: p1 driven by `p1Ctx`, p2 by `p2Ctx`. Returns the winner.
async function playBattle(p1Ctx: BrainContext, p2Ctx: BrainContext): Promise<string> {
  const bridge = new BattleBridge();
  await bridge.startBattle(PIKACHU_TEAM, GYARADOS_TEAM, { formatid: 'gen9customgame' });
  let guard = 0;
  while (bridge.state.winner === undefined && guard++ < 200) {
    const c1 = bridge.getChoices('p1');
    const c2 = bridge.getChoices('p2');
    const v1 = buildView('p1', bridge.state, PIKACHU_TEAM, GYARADOS_TEAM, c1.moves, []);
    const v2 = buildView('p2', bridge.state, GYARADOS_TEAM, PIKACHU_TEAM, c2.moves, []);
    const a1: Action = chooseAction(v1, p1Ctx);
    const a2: Action = chooseAction(v2, p2Ctx);
    await bridge.submitTurn(a1, a2);
  }
  return bridge.state.winner ?? 'none';
}

describe('decision brain — integration through the Battle Bridge', () => {
  it('drives a battle to completion', async () => {
    const winner = await playBattle(brainCtx(1, true), brainCtx(2, true));
    expect(['p1', 'p2']).toContain(winner);
  });

  it('Hard beats Easy clearly more than half the time', async () => {
    let hardWins = 0;
    const N = 12;
    for (let i = 0; i < N; i++) {
      // p1 = Hard, p2 = Easy; vary seeds.
      const winner = await playBattle(brainCtx(100 + i, true), brainCtx(500 + i, false));
      if (winner === 'p1') hardWins++;
    }
    expect(hardWins).toBeGreaterThan(N / 2);
  });
});
```

- [ ] **Step 2: Run to verify it (initially) fails or is red**

Run: `npx vitest run src/ai/brain-integration.test.ts`
Expected: the "drives a battle" case should pass once prior tasks are done; the
Hard-vs-Easy case is the real bar. If Hard does not clearly win, that's a signal —
proceed to Step 3.

- [ ] **Step 3: Tune if needed**

If "Hard beats Easy" fails, the most likely causes (fix in `decision-brain.ts`, do
NOT weaken the test bar):
- Easy's `randomness` too low to create a skill gap — raise to `0.85` (already set).
- KO bonus not dominating — confirm `koThisTurnChance * 1000` is applied.
- Hard's self-risk subtraction too aggressive causing passivity — the `* 0.5` damping
  in `scoreMove` exists for this; keep aggression high for an attacker matchup.
Re-run until the Hard-vs-Easy case passes deterministically across the seed set.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: ALL tests pass (bridge suite + ai suite).

- [ ] **Step 5: Commit**

```bash
git add src/ai/brain-integration.test.ts src/ai/decision-brain.ts
git commit -m "test(ai): brain plays through the real Bridge; Hard beats Easy"
```

---

### Task 8: Typecheck + plan-2a wrap

**Files:**
- Modify: `README.md` (append an AI section)

- [ ] **Step 1: Typecheck and full suite**

Run: `npm run typecheck && npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 2: Append AI usage to `README.md`**

````markdown
## AI Brain (sub-project 2a — decision core)

```ts
import { chooseAction } from './src/ai/decision-brain';
import { buildView } from './src/ai/view-from-bridge';
import { makeRng } from './src/ai/rng';

const ctx = {
  gen: 9,
  knobs: { randomness: 0, lookaheadDepth: 1, switchSmarts: 1 }, // "Hard"
  personality: { aggression: 1, caution: 1 },
  rng: makeRng(Date.now()),
};
const view = buildView('p2', bridge.state, aiTeam, playerTeam, bridge.getChoices('p2').moves, []);
const action = chooseAction(view, ctx); // -> feed to bridge.submitTurn
```

Difficulty = knob values (randomness/lookahead/switchSmarts); personality = weights.
Learning/adaptation (player model) and team drafting come in plans 2b and 2c.
````

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: AI decision-brain usage (plan 2a)"
```

---

## Self-Review notes

- **Spec coverage (2a slice):** decision brain `chooseAction` (Tasks 4–5), calc
  lookahead via `@smogon/calc` (Task 3), difficulty knobs randomness/lookahead/
  switchSmarts (Tasks 4–5), personality weights (Tasks 4–5), omniscient view
  (Task 6), integration + difficulty gradient (Task 7). Deferred to 2b/2c (by
  design): player model, observer, gradual reputation, auto-scale, team composer.
- **Verified-API risks settled:** `@smogon/calc` constructor/`calculate`/`kochance`
  shape (incl. `chance` omitted when `n>1`) confirmed empirically before coding.
- **Known simplification (noted, not a placeholder):** `selfBench` mons are viewed at
  100% HP / no status in `buildView` (live bench HP tracking lands with multi-mon
  battles in a later sub-project); single-active singles tests are unaffected.
- **Type consistency:** `Action` reused from `bridge/types`; `chooseAction` signature
  identical across Tasks 4, 5, 7; `evaluateMove` signature identical across Tasks 3–5.
```
