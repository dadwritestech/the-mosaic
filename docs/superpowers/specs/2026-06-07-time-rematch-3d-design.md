# Time & Rematch Lifecycle (Sub-project 3d) — Spec

**Date:** 2026-06-07
**Status:** Approved (design)
**Parent:** `2026-06-07-pokemon-region-game-design.md`
**Depends on:** 3a (GameState/time), Team Composer 2c, AI per-character memory 2b.

## Purpose

The "living world" logic: a deterministic in-game clock and a player-initiated
(Vs-Seeker-style) trainer rematch lifecycle. The last mechanical piece before content.
Pure, headless, testable. 3d owns the rules and queries; the overworld (4) and UI (5)
wire the physical re-encounter.

## Settled decisions

- **Time = action/step-based in-game clock** (deterministic; no real-world coupling).
- **Rematch surfacing = player-initiated (Vs-Seeker)**: 3d exposes a "ready" list; the
  player tool re-challenges on demand. Trainers do not autonomously travel.
- **Rematch level scales to player progress, capped:** `min(75, strongestPartyLevel +
  2 + badges × 3)`. Team regenerated via the Composer (2c); adapted via memory (2b).
- **Cooldown = 1 in-game day.**

## Clock (`src/game/clock.ts`)

- `advanceTime(state, minutes) → GameState` — adds `minutes`; while `minutes ≥ 1440`,
  subtract 1440 and increment `day` (carries remainder). Never mutates input.
- `advanceStep(state) → GameState` — one overworld step = `MINUTES_PER_STEP` (=5).
- `currentDay(state) → number` = `state.time.day`.
- `timeOfDay(state) → 'morning' | 'day' | 'night'` — buckets `state.time.minutes`
  (morning 240–599, day 600–1079, night otherwise). A hook for day/night encounters
  in sub-project 4 (defined now, consumed later).

## Rematch lifecycle (`src/game/rematch.ts`)

Adds a field to `GameState` (extends 3a `types.ts`, `createNewGame`, save validation):
```ts
trainerLog: Record<string, { defeats: number; lastDefeatedDay: number; readyDay: number }>;
```
- `recordTrainerDefeat(state, trainerId) → GameState` — `defeats++`,
  `lastDefeatedDay = currentDay`, `readyDay = currentDay + COOLDOWN_DAYS` (=1).
- `isReadyForRematch(state, trainerId) → boolean` — a record exists and
  `currentDay(state) ≥ record.readyDay`.
- `listReadyRematches(state) → string[]` — all trainerIds currently ready (Vs-Seeker).
- `rematchLevelCap(state) → number` — `min(75, strongestPartyLevel + 2 +
  badges.length × 3)`, where `strongestPartyLevel` is the max level across the party
  (0 if empty). The overworld passes this as the Composer's `levelCap` for the rematch.

## Integration (wiring, not owned here)

- The battle-result flow (3c) calls `recordTrainerDefeat` when a *trainer* battle is
  won (not wild). 3d provides the function; the call-site wiring lands when the
  overworld drives battles (4/5).
- The Vs-Seeker tool (UI, 5) reads `listReadyRematches`, and on selection composes a
  team via `composeTeam(trainerDef, { ...levelCap: rematchLevelCap(state) })` (2c).

## Test strategy (headless, deterministic)

- **Clock:** `advanceTime` rolls minutes into days with correct carry (e.g. day 0 /
  1430 min + 20 → day 1 / 10 min); `advanceStep` adds 5 minutes; `timeOfDay` buckets
  correctly at boundary values.
- **Rematch lifecycle:** after `recordTrainerDefeat`, `isReadyForRematch` is false on
  the same day and true once `currentDay ≥ readyDay` (advance a day to cross it);
  `listReadyRematches` returns exactly the ready ids; an undefeated trainer is never ready.
- **Level cap:** scales with strongest party level and badge count; clamps at 75; empty
  party + 0 badges yields the floor.

## Out of scope (later)
Physical re-encounter / Vs-Seeker UI (5); trainer travel; day/night encounter tables
(4 — `timeOfDay` is the hook); berry growth / time-based world events (not planned).
