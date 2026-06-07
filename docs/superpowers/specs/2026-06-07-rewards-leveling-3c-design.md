# Rewards & Leveling (Sub-project 3c) — Spec

**Date:** 2026-06-07
**Status:** Approved (design)
**Parent:** `2026-06-07-pokemon-region-game-design.md`
**Depends on:** Battle Bridge (1), AI Brain (2), Game State 3a, Economy 3b.

## Purpose

The connective tissue that turns a finished battle into growth: EXP gain + level-ups
(with move-learning and level-up evolution), money/item rewards scaled to the
opponent, and the battle-result writeback (persisting HP/status onto owned Pokémon,
plus injecting persisted HP *into* a battle at the start). Headless and testable.

## Settled decisions

- **EXP distribution = difficulty-dependent (option C):** Normal → participants get
  full EXP + benched get a reduced Exp-Share cut; Hard/Hardest → participants only.
- **Persisted HP = option C:** design for injecting current HP/status into a battle at
  start; if the plan-time probe shows it's too fragile, fall back to full-HP start.
- **Rewards scale to the OPPONENT's strength, never the player's performance**
  (see memory: rewards-and-economy-design).

## EXP & leveling

- **Formula:** Gen-5+ scaled — `exp = floor( (baseExp × Lₒ / 5) × (1/s) ×
  ((2Lₒ+10)/(Lₒ+Lₚ+10))^2.5 + 1 )` where `baseExp` = our bundled yield, `Lₒ` =
  defeated level, `Lₚ` = winner level, `s` = participant count. The level-ratio term
  reduces EXP when the winner out-levels the foe (natural anti-grind / opponent-scaling).
- **Bundled `exp-yield.ts`** — `baseExpYield(species)` (Showdown has no `baseExp`;
  same gap pattern as catch rates). Core species seeded; full table is later bulk (`pi`).
- **Distribution (`leveling.ts` `distributeExp`):** Normal — each participant gets full
  per-KO EXP; each non-participant gets a reduced share (e.g. 50%). Hard/Hardest —
  participants only, bench gets 0.
- **`applyExpGain(mon, amount) → { mon, levelsGained, movesToLearn, evolutionInto }`:**
  adds EXP via 3a `gainExp`; for each new level, reads level-up moves from Showdown's
  learnset (probe the level-tag format, e.g. `"9L15"`, at plan time); checks
  `evolutionFor(mon, {kind:'level'})` (reuses 3b). Auto-learns into free move slots;
  **surfaces** a decision when the moveset is full or an evolution is available (never
  silently overwrites). `movesToLearn: {level:number, moveId:string}[]`,
  `evolutionInto: string | null`.

## Rewards (`rewards.ts`)

`computeRewards(context) → { money, items }`:
- **Money** (trainer battles only): `basePayout × highestOpponentLevel × moneyMod`,
  `moneyMod` = Normal 1.0 / Hard 0.9 / Hardest 0.8. Wild battles award no money.
- **Items:** roll an optional per-trainer `dropTable` with a seeded RNG; quality scales
  with trainer tier. (Drop tables authored in Region Content, 4; 3c implements the roller.)
- Pure: a function of the defeated team + trainer def + difficulty + seed — never the
  player's win streak.

## Battle-result writeback (`battle-result.ts`)

`applyBattleResult(state, outcome) → { state, summary }` where `outcome` carries the
win/loss, per-party-uid final HP/status, the defeated team (for EXP), participant uids,
and the trainer def (if any):
1. Write each party mon's final HP/status back onto its owned Pokémon (persistence out).
2. `applyFaintConsequences` (Nuzlocke permadeath — 3a hook).
3. `distributeExp` + `applyExpGain` per mon; collect move-learn/evolution decisions
   into `summary.levelUps` for the caller to resolve.
4. `computeRewards` → add money (`addMoney`) and items (`addItem`) to state.
`summary` = `{ expGained, levelUps, money, items }`.

## Battle Bridge extension

- `startBattle(p1, p2, opts)` gains `opts.initialConditions?: Record<side, {uid/slot →
  {hpPercent, status}}>` — injected into the sim's internal `battle.sides[].pokemon[]`
  after init.
- `finalConditions(): per-side per-mon { species, hpPercent, status, fainted }` — read
  from the sim's internal battle object at battle end (the Bridge currently tracks only
  the active mon).
- **Plan-time probe:** confirm the `BattleStream` exposes the underlying `Battle`
  (`.battle.sides[].pokemon[]` with settable `hp`/`status`). **C-fallback:** if
  injection is too fragile, ship `finalConditions` (read-only) + full-HP start, and
  revisit. Read-out is lower-risk than injection and is required for writeback either way.

## Modules

`src/game/exp-yield.ts`, `src/game/leveling.ts`, `src/game/learnset.ts`,
`src/game/rewards.ts`, `src/game/battle-result.ts`, + Battle Bridge extension.

## Test strategy (headless, deterministic)

- **EXP formula:** known-input check (a fixed baseExp/levels produces the expected
  integer); the level-ratio term lowers EXP when `Lₚ > Lₒ`.
- **Distribution:** Normal gives bench a partial share; Hard gives bench zero; full
  EXP to participants in both.
- **Level-up:** crossing a level returns `levelsGained`; a species with a level-up move
  surfaces it in `movesToLearn`; a mon at its evo level returns `evolutionInto`;
  auto-learn fills an empty slot.
- **Rewards:** trainer money = `basePayout × highestLevel × moneyMod` (per mode); wild
  = 0; drop roller is deterministic under a seed.
- **Writeback:** a hurt/statused mon persists its condition onto the owned Pokémon;
  Nuzlocke faints route to graveyard; money/items land in state.
- **Bridge (post-probe):** `finalConditions` reports correct end HP after a scripted
  battle; if injection lands, a mon started at injected HP reflects it on turn 1.
- **Integration:** owned teams battle through the Bridge → `applyBattleResult` →
  winner's participants gained EXP, a pre-hurt mon stays hurt, trainer money awarded.

## Out of scope (later)
Trainer `dropTable` / `basePayout` *content* (Region Content, 4); full exp-yield table
tail (bulk, `pi`); the day/rematch lifecycle (3d); UI confirmation of level-up
decisions (5). 3c surfaces decisions; the UI resolves them.
