# Endgame & Story Climax (Sub-project 4c) — Spec

**Date:** 2026-06-07
**Status:** Approved (design)
**Parent:** `2026-06-07-pokemon-region-game-design.md`
**Worldbuilding:** `2026-06-07-the-mosaic-worldbuilding.md`
**Depends on:** Battle Bridge (1, HP injection), AI Brain (2), Game State 3a-3d, Region 4a/4b.

## Purpose

The story climax and endgame: a reusable battle-sequence primitive (Vriska's gauntlet,
the Elite Four, the Champion), a stabilize meter driven by faction story beats, and the
Reset/Embrace/Balance ending. Headless logic + content. The last sub-project before
presentation (5).

## Settled decisions

- **Ending = hybrid (C):** the meter gates which endings are available; the final call
  is an explicit player choice.
- **Meter driver = faction choices at story beats (A):** ~5 beats gated by badge
  progress; each pushes the Reset(−)↔Embrace(+) meter.
- **Sequence rules = difficulty-aware (C):** classic no-heal carry baseline; Hardest
  disallows items in-sequence; Nuzlocke permadeath applies per battle.

## Module / ownership

- **Claude (logic):** `battle-sequence.ts`, `story.ts` (+ `stabilizeMeter` field),
  `ending.ts`, and the 4c validation suite.
- **`pi` (content):** story-beat dialogue/choices, Elite Four + Champion teams,
  Vriska's 3-room gauntlet teams, ending narration — validated by the suite.

## Battle sequence (`src/game/battle-sequence.ts`)

A coordinator (battles still run via the Bridge + AI + `applyBattleResult`):
```ts
interface SeqOpponent { id: string; name: string; team: PokemonSet[]; }
interface SeqState { opponents: SeqOpponent[]; index: number; status: 'active' | 'complete' | 'failed'; itemsAllowed: boolean; }

startSequence(opponents: SeqOpponent[], opts: { itemsAllowed: boolean }): SeqState;
currentOpponent(seq: SeqState): SeqOpponent | null;
// HP/PP/status carry from the party's current owned state -> next battle's initialConditions (no heal).
carryConditions(party: OwnedPokemon[]): { p1: MonCondition[] };
// Advance on win; fail (whole run) on loss.
recordBattle(seq: SeqState, won: boolean): SeqState;
```
- **Serves three ladders:** Vriska's gym (3 rooms), the Elite Four (4), the Champion
  (1, appended after the E4 → a 5-battle run).
- **Difficulty:** `itemsAllowed=false` on Hardest. A loss sets `status='failed'`
  (caller restarts from the first opponent). Nuzlocke permadeath is unchanged
  (`applyFaintConsequences` per battle).

## Stabilize meter + story beats (`src/game/story.ts`, content `src/content/story/`)

- New `GameState.stabilizeMeter: number` (−100…+100, starts 0).
- `pushMeter(state, delta)` (clamped); `meterTier(state)` → `'reset'` (≤ −34) /
  `'balance'` (−33…+33) / `'embrace'` (≥ +34).
- `interface StoryBeat { id: string; requiredBadges: number; dialogue: string[]; choices: { label: string; faction: 'purist' | 'synthesist' | 'neutral'; meterDelta: number }[]; }`
- `nextBeat(state, beats): StoryBeat | null` — first beat with `requiredBadges ≤
  badges.length` not yet in `flags['beat:<id>']`.
- `resolveBeat(state, beats, beatId, choiceIndex): GameState` — `pushMeter` by the
  choice's `meterDelta`, set `flags['beat:<id>'] = choice.faction`.
- ~5 beats gated at 0/2/4/6/8 badges (content authored by `pi`).

## Ending (`src/game/ending.ts`)

- Triggered when `flags['championDefeated'] === true`.
- `availableEndings(state): EndingId[]` by `meterTier`: `reset` → `['reset','balance']`;
  `embrace` → `['embrace','balance']`; `balance` → `['reset','embrace','balance']`.
- `applyEnding(state, ending): { state: GameState; narrationKey: string }`:
  - **reset** — set `flags.ending='reset'`; **wipe convergence-born Pokémon**: clear
    `party` and `boxes` (move them to `graveyard` as "released to their home regions").
  - **embrace** — set `flags.ending='embrace'`; keep everything.
  - **balance** — set `flags.ending='balance'`; keep everything; world stays merged.
- `narrationKey` indexes `pi`-authored ending text.

## Content (`src/content/elite/`, `src/content/story/`)

- **Elite Four** (`SeqOpponent`s): Ferrum (Steel), Lumina (Fairy), Wraith (Ghost — the
  most adaptive, `advancedToggle` flavor + high prediction), Kairos (Fighting); levels
  ~58-62; type-locked teams via the Composer at draft time OR fixed `PokemonSet`s.
- **Champion the Warden:** a fixed ~6-mon legendary team (one per era, e.g. Mewtwo /
  Lugia / Rayquaza / Dialga / Reshiram / Zacian); level ~65; not type-locked.
- **Vriska's 3-room gauntlet:** replaces 4b's single Dragon team — 3 `SeqOpponent`s,
  each Dragon-led with a shifting secondary theme; wired so gym 7's challenge runs the
  sequence.
- **Story beats:** 5 `StoryBeat`s of faction confrontation dialogue + choices.
- **Ending narration:** text for reset/embrace/balance.

## Validation suite (`src/game/endgame-integrity.test.ts`, Claude)

- **Sequence:** `startSequence` → `recordBattle(win)` advances; a loss → `failed`;
  completing the last opponent → `complete`. `carryConditions` reflects party HP.
- **Meter/beats:** `nextBeat` returns beats in badge order and skips resolved ones;
  `resolveBeat` pushes the meter and records the faction; `meterTier` thresholds.
- **Ending:** `availableEndings` matches each tier; `applyEnding('reset')` empties party
  and boxes (into graveyard); embrace/balance preserve the team; idempotent flag set.
- **Content legality:** the E4 + Champion + Vriska teams are legal (every `PokemonSet`
  starts a battle through the Bridge); the 5 beats are reachable across a 0→8 badge run.

## Out of scope (later)
Rendering / the actual choice UI (5); New Game+ off a Reset ending; post-game; voice/
music. The sequence runner is headless — the UI drives individual battles through it.
