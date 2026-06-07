# AI Brain 2b — Player Model + Observer + Difficulty Controller Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AI *learn the player gradually* — a persisted player model of behavioral tendencies (with slow-building confidence), an Observer that updates it from battle summaries, a reputation track, and a Difficulty Controller that turns tier/toggle/auto-scale/reputation into the brain's knobs (with a confidence+reputation gate so adaptation is earned, never instant).

**Architecture:** Pure functions over a plain-data `PlayerModel`. The Observer is the ONLY writer; everything else reads. Tendencies are `{value, confidence}` updated with a small learning rate (gradual). The Difficulty Controller derives knobs + a `predictionWeight`/`counterDraftStrength`, where prediction is gated to ~0 until reputation is earned. No graphics; deterministic; no new dependencies.

**Tech Stack:** TypeScript, Vitest. Builds on `src/ai/types.ts` (`Knobs`) from plan 2a.

---

## File Structure

- `src/ai/player-model.ts` — `PlayerModel` data + `createPlayerModel()`, `updateTendency()`, `isActionable()`.
- `src/ai/observer.ts` — `BattleSummary` type + `observeBattle(model, summary, opts?)` (the only writer).
- `src/ai/reputation.ts` — `updateReputation()`, `deriveNotableTraits()`, `ReputationLevel`.
- `src/ai/difficulty-controller.ts` — `DifficultySettings`, `computeSettings(inputs)`, `effectivePredictionWeight()`.
- Tests alongside each.

Rationale: model primitives, the writer (observer), reputation derivation, and the knob math each have one job and are tested in isolation.

---

### Task 1: Player model primitives

**Files:**
- Create: `src/ai/player-model.ts`
- Test: `src/ai/player-model.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { createPlayerModel, updateTendency, isActionable, TENDENCY_NAMES } from './player-model';

describe('player model primitives', () => {
  it('creates a neutral model with all tendencies at value 0.5, confidence 0', () => {
    const m = createPlayerModel();
    for (const name of TENDENCY_NAMES) {
      expect(m.tendencies[name].value).toBeCloseTo(0.5);
      expect(m.tendencies[name].confidence).toBe(0);
    }
    expect(m.battlesObserved).toBe(0);
  });

  it('one update moves value only slightly (gradual) and confidence stays low', () => {
    const t = updateTendency({ value: 0.5, confidence: 0 }, 1.0, 0.15);
    expect(t.value).toBeCloseTo(0.575, 3); // 0.5 + 0.15*(1-0.5)
    expect(t.confidence).toBeLessThan(0.5);
  });

  it('repeated updates converge value toward the observed and raise confidence past threshold', () => {
    let t = { value: 0.5, confidence: 0 };
    for (let i = 0; i < 10; i++) t = updateTendency(t, 1.0, 0.15);
    expect(t.value).toBeGreaterThan(0.8);
    expect(t.confidence).toBeGreaterThan(0.5);
  });

  it('isActionable requires BOTH confidence>=threshold AND reputationRamp>0', () => {
    const high = { value: 0.9, confidence: 0.8 };
    expect(isActionable(high, 1.0)).toBe(true);
    expect(isActionable(high, 0)).toBe(false);          // no reputation yet
    expect(isActionable({ value: 0.9, confidence: 0.2 }, 1.0)).toBe(false); // not confident
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ai/player-model.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `player-model.ts`**

```ts
export const TENDENCY_NAMES = [
  'aggression', 'switchiness', 'typeReliance', 'statusUsage',
  'sacrificeWillingness', 'leadPattern', 'rosterStability',
] as const;
export type TendencyName = typeof TENDENCY_NAMES[number];

export interface Tendency { value: number; confidence: number; }

export interface CharacterMemory {
  encounters: number;
  lastOutcome: 'win' | 'loss' | null; // from the player's perspective
  lastTeam: string[];
}

export interface PlayerModel {
  tendencies: Record<TendencyName, Tendency>;
  battlesObserved: number;
  reputation: { level: string; score: number; notableTraits: string[] };
  characters: Record<string, CharacterMemory>;
  /** internal cross-battle state */
  _leadCounts: Record<string, number>;
  _lastTeam: string[] | null;
}

export function createPlayerModel(): PlayerModel {
  const tendencies = {} as Record<TendencyName, Tendency>;
  for (const name of TENDENCY_NAMES) tendencies[name] = { value: 0.5, confidence: 0 };
  return {
    tendencies,
    battlesObserved: 0,
    reputation: { level: 'Unknown', score: 0, notableTraits: [] },
    characters: {},
    _leadCounts: {},
    _lastTeam: null,
  };
}

/** Gradual update: value eases toward `observed`; confidence saturates toward 1. */
export function updateTendency(t: Tendency, observed: number, learnRate: number): Tendency {
  const value = t.value + learnRate * (observed - t.value);
  const confidence = Math.min(1, t.confidence + (1 - t.confidence) * 0.12);
  return { value, confidence };
}

/** The brain/composer may ACT on a tendency only when confident AND reputation permits. */
export function isActionable(t: Tendency, reputationRamp: number, threshold = 0.5): boolean {
  return t.confidence >= threshold && reputationRamp > 0;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/ai/player-model.test.ts && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/ai/player-model.ts src/ai/player-model.test.ts
git commit -m "feat(ai): player model primitives (gradual tendency + confidence gate)"
```

---

### Task 2: Reputation derivation

**Files:**
- Create: `src/ai/reputation.ts`
- Test: `src/ai/reputation.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { reputationLevel, deriveNotableTraits } from './reputation';
import { createPlayerModel } from './player-model';

describe('reputation', () => {
  it('maps score+badges to ascending levels', () => {
    expect(reputationLevel(0, 0)).toBe('Unknown');
    expect(reputationLevel(3, 0)).toBe('Noticed');
    expect(reputationLevel(8, 0)).toBe('Known');
    expect(reputationLevel(10, 5)).toBe('Renowned'); // 10 + 5*2 = 20
    expect(reputationLevel(40, 8)).toBe('Legendary');
  });

  it('derives traits only from high-confidence extreme tendencies', () => {
    const m = createPlayerModel();
    m.tendencies.typeReliance = { value: 0.95, confidence: 0.8 };  // confident + extreme
    m.tendencies.statusUsage = { value: 0.95, confidence: 0.1 };   // extreme but NOT confident
    const traits = deriveNotableTraits(m.tendencies);
    expect(traits.some((t) => /type/i.test(t))).toBe(true);
    expect(traits.some((t) => /status/i.test(t))).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ai/reputation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `reputation.ts`**

```ts
import type { Tendency, TendencyName } from './player-model';

export type ReputationLevel = 'Unknown' | 'Noticed' | 'Known' | 'Renowned' | 'Legendary';

export function reputationLevel(score: number, badges: number): ReputationLevel {
  const s = score + badges * 2;
  if (s >= 40) return 'Legendary';
  if (s >= 20) return 'Renowned';
  if (s >= 8) return 'Known';
  if (s >= 3) return 'Noticed';
  return 'Unknown';
}

const TRAIT_LABELS: Partial<Record<TendencyName, { high: string; low: string }>> = {
  typeReliance: { high: 'type-matchup specialist', low: 'unpredictable coverage' },
  statusUsage: { high: 'status spammer', low: 'rarely uses status' },
  aggression: { high: 'relentless attacker', low: 'defensive player' },
  switchiness: { high: 'constant pivoter', low: 'stands and fights' },
  rosterStability: { high: 'loyal to one team', low: 'ever-changing roster' },
};

/** Only confident (>=0.6) and extreme (<=0.2 or >=0.8) tendencies become traits. */
export function deriveNotableTraits(tendencies: Record<TendencyName, Tendency>): string[] {
  const out: string[] = [];
  for (const [name, t] of Object.entries(tendencies) as [TendencyName, Tendency][]) {
    const label = TRAIT_LABELS[name];
    if (!label || t.confidence < 0.6) continue;
    if (t.value >= 0.8) out.push(label.high);
    else if (t.value <= 0.2) out.push(label.low);
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/ai/reputation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ai/reputation.ts src/ai/reputation.test.ts
git commit -m "feat(ai): reputation levels + notable-trait derivation"
```

---

### Task 3: Observer (the only writer)

**Files:**
- Create: `src/ai/observer.ts`
- Test: `src/ai/observer.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { observeBattle } from './observer';
import { createPlayerModel } from './player-model';
import type { BattleSummary } from './observer';

const aggressiveBattle = (over: Partial<BattleSummary> = {}): BattleSummary => ({
  outcome: 'win', attackRatio: 1, switchRatio: 0, statusRatio: 0,
  superEffectiveRatio: 0.9, sacrificeRatio: 0, leadSpecies: 'Charizard',
  teamSpecies: ['Charizard', 'Blastoise', 'Venusaur'], badgesAtTime: 0, ...over,
});

describe('observeBattle', () => {
  it('gradually raises aggression over repeated aggressive battles', () => {
    const m = createPlayerModel();
    const after1 = observeBattle(createPlayerModel(), aggressiveBattle());
    expect(after1.tendencies.aggression.value).toBeLessThan(0.65); // barely moved
    let mm = m;
    for (let i = 0; i < 10; i++) mm = observeBattle(mm, aggressiveBattle());
    expect(mm.tendencies.aggression.value).toBeGreaterThan(0.8);
    expect(mm.tendencies.aggression.confidence).toBeGreaterThan(0.5);
    expect(mm.battlesObserved).toBe(10);
  });

  it('detects an unstable roster (low rosterStability) across differing teams', () => {
    let m = createPlayerModel();
    m = observeBattle(m, aggressiveBattle({ teamSpecies: ['Pikachu', 'Snorlax'] }));
    for (let i = 0; i < 8; i++) {
      m = observeBattle(m, aggressiveBattle({ teamSpecies: i % 2 ? ['Gengar', 'Onix'] : ['Lapras', 'Jolteon'] }));
    }
    expect(m.tendencies.rosterStability.value).toBeLessThan(0.4);
  });

  it('records per-character memory faster than the global model', () => {
    let m = createPlayerModel();
    m = observeBattle(m, aggressiveBattle({ trainerId: 'rival', outcome: 'win' }));
    expect(m.characters.rival.encounters).toBe(1);
    expect(m.characters.rival.lastOutcome).toBe('win');
  });

  it('climbs reputation with wins', () => {
    let m = createPlayerModel();
    for (let i = 0; i < 10; i++) m = observeBattle(m, aggressiveBattle({ outcome: 'win' }));
    expect(m.reputation.score).toBeGreaterThan(0);
    expect(m.reputation.level).not.toBe('Unknown');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ai/observer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `observer.ts`**

```ts
import { updateTendency, type PlayerModel, type TendencyName } from './player-model';
import { reputationLevel, deriveNotableTraits } from './reputation';

export interface BattleSummary {
  outcome: 'win' | 'loss';     // player's perspective
  attackRatio: number;         // fraction of player turns spent attacking -> aggression
  switchRatio: number;         // fraction of player turns spent switching -> switchiness
  statusRatio: number;         // fraction of player moves that were status -> statusUsage
  superEffectiveRatio: number; // fraction of damaging moves that were SE -> typeReliance
  sacrificeRatio: number;      // fraction of faints that were avoidable sacks -> sacrificeWillingness
  leadSpecies: string;         // -> leadPattern (cross-battle consistency)
  teamSpecies: string[];       // -> rosterStability (cross-battle overlap)
  badgesAtTime?: number;
  trainerId?: string;          // present for recurring characters (rival, gym leaders)
}

export interface ObserveOpts { globalRate?: number; characterRate?: number; }

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a), B = new Set(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 1 : inter / union;
}

export function observeBattle(model: PlayerModel, s: BattleSummary, opts: ObserveOpts = {}): PlayerModel {
  const rate = opts.globalRate ?? 0.15;
  const upd = (name: TendencyName, observed: number) => {
    model.tendencies[name] = updateTendency(model.tendencies[name], observed, rate);
  };

  upd('aggression', s.attackRatio);
  upd('switchiness', s.switchRatio);
  upd('statusUsage', s.statusRatio);
  upd('typeReliance', s.superEffectiveRatio);
  upd('sacrificeWillingness', s.sacrificeRatio);

  // leadPattern: how repetitive the player's lead is so far.
  model._leadCounts[s.leadSpecies] = (model._leadCounts[s.leadSpecies] ?? 0) + 1;
  const maxLead = Math.max(...Object.values(model._leadCounts));
  upd('leadPattern', maxLead / (model.battlesObserved + 1));

  // rosterStability: overlap with the previous battle's team (1 = identical).
  if (model._lastTeam) upd('rosterStability', jaccard(model._lastTeam, s.teamSpecies));
  model._lastTeam = s.teamSpecies.slice();

  // Per-character memory updates sharper (the "personal grudge" reacts faster).
  if (s.trainerId) {
    const prev = model.characters[s.trainerId];
    model.characters[s.trainerId] = {
      encounters: (prev?.encounters ?? 0) + 1,
      lastOutcome: s.outcome,
      lastTeam: s.teamSpecies.slice(),
    };
  }

  model.battlesObserved += 1;

  // Reputation: grows on wins (small bump on losses for sheer notoriety).
  model.reputation.score += s.outcome === 'win' ? 1 : 0.2;
  model.reputation.level = reputationLevel(model.reputation.score, s.badgesAtTime ?? 0);
  model.reputation.notableTraits = deriveNotableTraits(model.tendencies);

  return model;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/ai/observer.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ai/observer.ts src/ai/observer.test.ts
git commit -m "feat(ai): observer updates player model gradually from battle summaries"
```

---

### Task 4: Difficulty Controller

**Files:**
- Create: `src/ai/difficulty-controller.ts`
- Test: `src/ai/difficulty-controller.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { computeSettings } from './difficulty-controller';

describe('difficulty controller', () => {
  it('Easy is noisy, Hard is crisp', () => {
    const easy = computeSettings({ baseTier: 'easy', advancedToggle: false, autoScale: 0, reputationRamp: 0 });
    const hard = computeSettings({ baseTier: 'hard', advancedToggle: false, autoScale: 0, reputationRamp: 0 });
    expect(easy.randomness).toBeGreaterThan(hard.randomness);
    expect(hard.lookaheadDepth).toBe(1);
    expect(easy.lookaheadDepth).toBe(0);
  });

  it('advanced toggle sharpens play (less randomness, enables lookahead)', () => {
    const base = computeSettings({ baseTier: 'normal', advancedToggle: false, autoScale: 0, reputationRamp: 0 });
    const adv = computeSettings({ baseTier: 'normal', advancedToggle: true, autoScale: 0, reputationRamp: 0 });
    expect(adv.randomness).toBeLessThan(base.randomness);
    expect(adv.lookaheadDepth).toBe(1);
  });

  it('auto-scale tightens the AI when the player is crushing it', () => {
    const calm = computeSettings({ baseTier: 'normal', advancedToggle: false, autoScale: 0, reputationRamp: 0 });
    const pressured = computeSettings({ baseTier: 'normal', advancedToggle: false, autoScale: 1, reputationRamp: 0 });
    expect(pressured.randomness).toBeLessThan(calm.randomness);
  });

  it('IMMERSION GUARDRAIL: prediction stays ~0 until reputation is earned', () => {
    const unknown = computeSettings({ baseTier: 'hard', advancedToggle: true, autoScale: 0, reputationRamp: 0 });
    const renowned = computeSettings({ baseTier: 'hard', advancedToggle: true, autoScale: 0, reputationRamp: 1 });
    expect(unknown.predictionWeight).toBe(0);
    expect(renowned.predictionWeight).toBeGreaterThan(0.5);
    expect(unknown.counterDraftStrength).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ai/difficulty-controller.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `difficulty-controller.ts`**

```ts
import type { Knobs } from './types';

export type BaseTier = 'easy' | 'normal' | 'hard';

export interface DifficultyInputs {
  baseTier: BaseTier;
  advancedToggle: boolean;
  autoScale: number;       // -1..+1 smoothed: + = player dominating, - = player struggling
  reputationRamp: number;  // 0..1 how much the world has "learned" the player
}

export interface DifficultySettings extends Knobs {
  predictionWeight: number;     // how much the brain acts on the player model (gated)
  counterDraftStrength: number; // how hard the composer tailors a team vs the player
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

const TIER_BASE: Record<BaseTier, Knobs> = {
  easy:   { randomness: 0.80, lookaheadDepth: 0, switchSmarts: 0.10 },
  normal: { randomness: 0.30, lookaheadDepth: 0, switchSmarts: 0.60 },
  hard:   { randomness: 0.05, lookaheadDepth: 1, switchSmarts: 1.00 },
};

export function computeSettings(inp: DifficultyInputs): DifficultySettings {
  const base = TIER_BASE[inp.baseTier];

  let randomness = base.randomness;
  if (inp.advancedToggle) randomness -= 0.20;          // sharper floor for skilled players
  randomness -= inp.autoScale * 0.15;                  // crank up when player is winning hard
  randomness = clamp01(randomness);

  const lookaheadDepth: 0 | 1 = (base.lookaheadDepth === 1 || inp.advancedToggle) ? 1 : 0;

  let switchSmarts = base.switchSmarts;
  if (inp.advancedToggle) switchSmarts += 0.20;
  switchSmarts += Math.max(0, inp.autoScale) * 0.10;
  switchSmarts = clamp01(switchSmarts);

  // Prediction + counter-draft are GATED by reputation: ~0 until earned.
  const tierPredCap = inp.baseTier === 'easy' ? 0.3 : 1;
  const predictionWeight = clamp01(inp.reputationRamp * tierPredCap);
  const counterDraftStrength = clamp01(inp.reputationRamp * (inp.advancedToggle ? 1 : 0.8));

  return { randomness, lookaheadDepth, switchSmarts, predictionWeight, counterDraftStrength };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/ai/difficulty-controller.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ai/difficulty-controller.ts src/ai/difficulty-controller.test.ts
git commit -m "feat(ai): difficulty controller -> knobs with reputation-gated prediction"
```

---

### Task 5: Full suite + wrap

**Files:**
- Modify: `README.md` (append a 2b note)

- [ ] **Step 1: Full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: ALL tests pass (bridge + 2a + 2b), no type errors.

- [ ] **Step 2: Append to `README.md`**

````markdown
## AI Brain (sub-project 2b — adaptation)

```ts
import { createPlayerModel } from './src/ai/player-model';
import { observeBattle } from './src/ai/observer';
import { computeSettings } from './src/ai/difficulty-controller';

let model = createPlayerModel();           // persisted in the save
model = observeBattle(model, battleSummary); // after each battle (only writer)

const settings = computeSettings({
  baseTier: 'hard', advancedToggle: false,
  autoScale: 0,                 // smoothed recent performance (-1..+1)
  reputationRamp: model.reputation.score / 40, // 0..1, earned over time
});
// settings -> Knobs for the decision brain; predictionWeight/counterDraftStrength
// are gated to ~0 until the player has earned a reputation.
```
````

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: AI adaptation (plan 2b) usage"
```

---

## Self-Review notes

- **Spec coverage (2b slice):** behavioral tendencies + confidence (Task 1); gradual
  update math (Task 1); reputation level + notable traits (Task 2); Observer as sole
  writer, global-slow vs per-character-sharp, rosterStability/leadPattern cross-battle
  (Task 3); difficulty knobs from tier/toggle/auto-scale (Task 4); the immersion
  guardrail — prediction/counter-draft gated by reputation (Task 4, explicit test).
  Deferred to 2c (by design): the Team Composer consuming `counterDraftStrength`;
  wiring `predictionWeight` into `chooseAction` lands when prediction signals exist.
- **Type consistency:** `Knobs` reused from `src/ai/types.ts`; `DifficultySettings
  extends Knobs`; `PlayerModel`/`Tendency`/`TendencyName` shared across Tasks 1–3.
- **No placeholders:** all formulas and thresholds are concrete (tunable constants
  with sensible defaults; refine by playtest later).
- **Note:** `BattleSummary` ratios are produced by the game layer from the player's
  chosen actions during a battle; deriving them from live `BattleBridge` events is
  glue that lands with the Game State sub-project (3). 2b tests feed summaries directly.
```
