# Time & Rematch 3d Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic in-game clock and a player-initiated trainer rematch lifecycle (defeat → 1-day cooldown → ready), with progress-scaled capped rematch levels.

**Architecture:** Pure functions over `GameState`. One new field (`trainerLog`) on `GameState`; `clock.ts` advances time, `rematch.ts` tracks defeats and answers readiness/level queries. No engine calls, no graphics.

**Tech Stack:** TypeScript, the 3a `src/game/*` modules, Vitest.

---

## File Structure

- `src/game/types.ts` — add `trainerLog` to `GameState`.
- `src/game/game-state.ts` — init `trainerLog` in `createNewGame`.
- `src/game/clock.ts` — `advanceTime`, `advanceStep`, `currentDay`, `timeOfDay`.
- `src/game/rematch.ts` — `recordTrainerDefeat`, `isReadyForRematch`, `listReadyRematches`, `rematchLevelCap`.
- Tests alongside the two new modules.

Note: `save.ts` needs no change — `trainerLog` is plain JSON, so `serialize`/`deserialize` (which spread `...state`) round-trip it automatically once `createNewGame` initializes it.

---

### Task 1: Add `trainerLog` to GameState

**Files:**
- Modify: `src/game/types.ts`, `src/game/game-state.ts`
- Test: `src/game/trainer-log.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { createNewGame } from './game-state';
import { serialize, deserialize } from './save';

describe('trainerLog field', () => {
  it('createNewGame initializes an empty trainerLog', () => {
    expect(createNewGame({ difficultyMode: 'normal', nuzlocke: false }).trainerLog).toEqual({});
  });
  it('trainerLog round-trips through save', () => {
    const g = createNewGame({ difficultyMode: 'normal', nuzlocke: false });
    g.trainerLog['rival'] = { defeats: 2, lastDefeatedDay: 3, readyDay: 4 };
    expect(deserialize(serialize(g)).trainerLog.rival.defeats).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/trainer-log.test.ts`
Expected: FAIL — `trainerLog` does not exist on `GameState`.

- [ ] **Step 3: Add the field**

In `src/game/types.ts`, inside the `GameState` interface (after `graveyard`):
```ts
  trainerLog: Record<string, { defeats: number; lastDefeatedDay: number; readyDay: number }>;
```

In `src/game/game-state.ts`, in the object returned by `createNewGame`, add (after `graveyard: [],`):
```ts
    trainerLog: {},
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/game/trainer-log.test.ts && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/game/types.ts src/game/game-state.ts src/game/trainer-log.test.ts
git commit -m "feat(game): add trainerLog field to GameState"
```

---

### Task 2: Clock

**Files:**
- Create: `src/game/clock.ts`
- Test: `src/game/clock.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { advanceTime, advanceStep, currentDay, timeOfDay } from './clock';
import { createNewGame } from './game-state';

const fresh = () => createNewGame({ difficultyMode: 'normal', nuzlocke: false });

describe('clock', () => {
  it('advanceTime carries minutes into days', () => {
    let g = fresh(); g.time = { day: 0, minutes: 1430 };
    g = advanceTime(g, 20); // 1450 -> day 1, 10 min
    expect(g.time.day).toBe(1);
    expect(g.time.minutes).toBe(10);
  });
  it('advanceTime handles multi-day jumps', () => {
    let g = fresh();
    g = advanceTime(g, 1440 * 3 + 5);
    expect(g.time.day).toBe(3);
    expect(g.time.minutes).toBe(5);
  });
  it('advanceStep adds 5 minutes', () => {
    let g = fresh(); const before = g.time.minutes;
    g = advanceStep(g);
    expect(g.time.minutes).toBe(before + 5);
  });
  it('currentDay returns the day', () => {
    const g = fresh(); g.time.day = 7;
    expect(currentDay(g)).toBe(7);
  });
  it('timeOfDay buckets minutes', () => {
    const at = (m: number) => { const g = fresh(); g.time.minutes = m; return timeOfDay(g); };
    expect(at(300)).toBe('morning'); // 05:00
    expect(at(720)).toBe('day');     // 12:00
    expect(at(1200)).toBe('night');  // 20:00
    expect(at(60)).toBe('night');    // 01:00
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/clock.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `clock.ts`**

```ts
import type { GameState } from './types';

export const MINUTES_PER_DAY = 1440;
export const MINUTES_PER_STEP = 5;

export function advanceTime(state: GameState, minutes: number): GameState {
  let total = state.time.minutes + Math.max(0, minutes);
  let day = state.time.day;
  while (total >= MINUTES_PER_DAY) { total -= MINUTES_PER_DAY; day += 1; }
  return { ...state, time: { day, minutes: total } };
}

export function advanceStep(state: GameState): GameState {
  return advanceTime(state, MINUTES_PER_STEP);
}

export function currentDay(state: GameState): number {
  return state.time.day;
}

export function timeOfDay(state: GameState): 'morning' | 'day' | 'night' {
  const m = state.time.minutes;
  if (m >= 240 && m < 600) return 'morning';
  if (m >= 600 && m < 1080) return 'day';
  return 'night';
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/game/clock.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/clock.ts src/game/clock.test.ts
git commit -m "feat(game): deterministic in-game clock"
```

---

### Task 3: Rematch lifecycle

**Files:**
- Create: `src/game/rematch.ts`
- Test: `src/game/rematch.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { recordTrainerDefeat, isReadyForRematch, listReadyRematches, rematchLevelCap } from './rematch';
import { createNewGame, addToParty, grantBadge } from './game-state';
import { advanceTime } from './clock';
import { createOwned } from './owned-pokemon';

const fresh = () => createNewGame({ difficultyMode: 'normal', nuzlocke: false });

describe('rematch lifecycle', () => {
  it('records a defeat with a 1-day cooldown', () => {
    let g = fresh(); g.time.day = 5;
    g = recordTrainerDefeat(g, 'gymSteel');
    expect(g.trainerLog.gymSteel.defeats).toBe(1);
    expect(g.trainerLog.gymSteel.lastDefeatedDay).toBe(5);
    expect(g.trainerLog.gymSteel.readyDay).toBe(6);
  });

  it('is not ready on the same day, ready after the cooldown passes', () => {
    let g = fresh(); g.time.day = 5;
    g = recordTrainerDefeat(g, 'gymSteel');
    expect(isReadyForRematch(g, 'gymSteel')).toBe(false);
    g = advanceTime(g, 1440); // -> day 6
    expect(isReadyForRematch(g, 'gymSteel')).toBe(true);
  });

  it('an undefeated trainer is never ready', () => {
    expect(isReadyForRematch(fresh(), 'whoever')).toBe(false);
  });

  it('listReadyRematches returns exactly the ready ids', () => {
    let g = fresh(); g.time.day = 0;
    g = recordTrainerDefeat(g, 'a');         // readyDay 1
    g.time.day = 10;
    g = recordTrainerDefeat(g, 'b');         // readyDay 11 (not ready at day 10)
    expect(listReadyRematches(g).sort()).toEqual(['a']);
  });

  it('rematchLevelCap scales with party level + badges, capped at 75', () => {
    let g = fresh();
    expect(rematchLevelCap(g)).toBe(2); // empty party, 0 badges -> 0 + 2 + 0
    g = addToParty(g, createOwned({ species: 'Charizard', level: 40 }));
    g = grantBadge(grantBadge(g, 'x'), 'y'); // 2 badges
    expect(rematchLevelCap(g)).toBe(40 + 2 + 6); // 48
    g = addToParty(g, createOwned({ species: 'Mewtwo', level: 100 }));
    expect(rematchLevelCap(g)).toBe(75); // clamped
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/rematch.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `rematch.ts`**

```ts
import type { GameState } from './types';
import { currentDay } from './clock';

export const COOLDOWN_DAYS = 1;
export const REMATCH_LEVEL_CAP = 75;

export function recordTrainerDefeat(state: GameState, trainerId: string): GameState {
  const day = currentDay(state);
  const prev = state.trainerLog[trainerId];
  const record = {
    defeats: (prev?.defeats ?? 0) + 1,
    lastDefeatedDay: day,
    readyDay: day + COOLDOWN_DAYS,
  };
  return { ...state, trainerLog: { ...state.trainerLog, [trainerId]: record } };
}

export function isReadyForRematch(state: GameState, trainerId: string): boolean {
  const r = state.trainerLog[trainerId];
  return !!r && currentDay(state) >= r.readyDay;
}

export function listReadyRematches(state: GameState): string[] {
  return Object.keys(state.trainerLog).filter((id) => isReadyForRematch(state, id));
}

export function rematchLevelCap(state: GameState): number {
  const strongest = state.party.reduce((max, m) => Math.max(max, m.level), 0);
  return Math.min(REMATCH_LEVEL_CAP, strongest + 2 + state.badges.length * 3);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/game/rematch.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/rematch.ts src/game/rematch.test.ts
git commit -m "feat(game): trainer rematch lifecycle (cooldown, ready list, level cap)"
```

---

### Task 4: Full suite + wrap

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: ALL pass (bridge + ai + game), no type errors.

- [ ] **Step 2: Append to `README.md`**

````markdown
## Time & Rematch (sub-project 3d)

```ts
import { advanceStep, currentDay, timeOfDay } from './src/game/clock';
import { recordTrainerDefeat, listReadyRematches, rematchLevelCap } from './src/game/rematch';

game = advanceStep(game);                  // overworld step advances the clock
game = recordTrainerDefeat(game, 'gymSteel'); // on a won trainer battle (1-day cooldown)
const ready = listReadyRematches(game);    // Vs-Seeker list, after the cooldown
const cap = rematchLevelCap(game);         // -> Team Composer levelCap for the rematch
```

Deterministic step-based clock with a `timeOfDay` hook for day/night encounters;
player-initiated rematches scale to progress (capped at 75).
````

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: time & rematch (3d) usage — sub-project 3 complete"
```

---

## Self-Review notes

- **Spec coverage:** `trainerLog` field (T1); clock advance/step/day/timeOfDay (T2);
  rematch record/ready/list/levelCap with 1-day cooldown + cap 75 (T3). Save round-trip
  covered (T1) — no `save.ts` change needed (plain JSON).
- **Deferred (not placeholders):** `recordTrainerDefeat` call-site wiring + Vs-Seeker UI
  (overworld 4 / UI 5); `timeOfDay` consumption by day/night encounter tables (4).
- **Type consistency:** `trainerLog` shape identical in `types.ts`, `createNewGame`,
  and `rematch.ts`; `currentDay` shared between `clock.ts` and `rematch.ts`.
```
