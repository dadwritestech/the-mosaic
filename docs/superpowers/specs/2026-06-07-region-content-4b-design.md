# Region Content — Full 8-Badge Region (Sub-project 4b) — Spec

**Date:** 2026-06-07
**Status:** Approved (design)
**Parent:** `2026-06-07-pokemon-region-game-design.md`
**Worldbuilding:** `2026-06-07-the-mosaic-worldbuilding.md`
**Builds on:** 4a (content schema, registry, encounter roller, vertical slice).

## Purpose

Flesh out the complete main path of The Mosaic — all 8 gyms, their towns, the
connecting route map, biome encounter tables, trainers, shops, and basic NPCs — plus
the authoritative National-Dex data tables generated from PokéAPI. Playable start →
8th badge. Headless. Elite Four / Champion / story climax are 4c.

## Two content kinds, sourced differently

- **Factual data** (catch rate, base-exp yield, growth-rate group, EV yield) —
  generated from **PokéAPI** by a committed build script. NOT authored by an LLM
  (hallucination risk; no test can catch a wrong catch rate). Claude writes/verifies.
- **Creative content** (gyms, routes, towns, encounter compositions, trainers, shops,
  NPC flavor) — authored by `pi` against the locked 4a schema, guided by the
  worldbuilding bible. Verified by a Claude-authored region-integrity test suite.

## Section 1 — Data pipeline

- **`scripts/gen-data.mjs`** — fetches the National Dex from PokéAPI
  (`https://pokeapi.co/api/v2/pokemon-species` + `/pokemon`) and emits:
  - `src/data/catch-rates.ts` (`capture_rate`, 0-255)
  - `src/game/exp-yield.ts` (`base_experience`)
  - `src/game/growth-rates.ts` (`growth_rate.name` → our `GrowthGroup`)
  - `src/data/ev-yield.ts` (new — `stats[].effort` per stat; for 3c rewards later)
- Each emitted file keeps the existing exported function signatures
  (`baseCatchRate`/`baseExpYield`/`growthRateOf`, add `evYield`), so all 151 existing
  tests still pass — the seeded stubs become a subset of the full table.
- **Verification:** spot-check generated values against known truths (Pikachu catch
  190, Caterpie 255, Magikarp base-exp 40, Charizard `medium-slow`, etc.). A small
  committed test asserts these anchors so a bad regeneration is caught.
- **Probe at plan time:** confirm PokéAPI is reachable here and the exact JSON field
  names / growth-rate group strings (`slow`, `medium`, `fast`, `medium-slow`,
  `slow-then-very-fast` (erratic), `fast-then-very-slow` (fluctuating)).

## Section 2 — Region content (`src/content/region/` + extended slice)

**Map topology** — a connected location graph from Aethel's Rest through 8 gym towns:

| # | Gym Town | Type | Leader | Biome | levelCap | tier |
|---|---|---|---|---|---|---|
| 1 | Verdant Hollow *(from 4a)* | Grass | Bramble | johto-forests | 12 | easy |
| 2 | Cerulean Deep | Water | Maris | hoenn-beaches | 18 | easy |
| 3 | Ember Peak | Fire | Ignis | alola-islands | 24 | normal |
| 4 | Voltspire | Electric | Zap | unova-urban | 30 | normal |
| 5 | Mindweave | Psychic | Sylas | kalos-gardens | 36 | hard |
| 6 | Frostfell | Ice | Glacia | sinnoh-tundra | 42 | hard |
| 7 | Drakemaw | Dragon | Vriska | paldea-wilds | 48 | hard |
| 8 | Shadowmere | Dark | Noctis | galar-countryside | 52 | hard |

- **Routes** connect consecutive towns (≥1 route each), plus a couple of waypoints
  (a Center-only village, a cave). Each route: a biome-appropriate `EncounterTable`
  across morning/day/night (the Tide), and 1-4 `TrainerDef`s with scaling levels/tiers.
- **Encounter design:** species are biome-appropriate (forest 'mon near Grass, water
  'mon near beaches, etc.), drawn from the now-full dex. Level ranges scale with map
  progression.
- **Shops:** each gym town has a shop with badge-gated, scaling stock (better
  Potions/Balls as badges rise).
- **NPCs:** flavor dialogue per town; some reputation-gated (read the player model's
  `reputationLevel`).
- **Special gyms via difficulty knobs (no new logic in 4b):**
  - Sylas (Psychic) — `advancedToggle` on + reputation-gated prediction ("pre-reads").
  - Noctis (Dark) — `baseTier: hard` + high `counterDraftStrength` (mirror-match).
  - Vriska (Dragon) — one hard Dragon team in 4b; the literal type-per-room gauntlet
    needs battle-sequence logic → deferred to 4c.

## Validation — region-integrity suite (Claude-authored)

A test suite that mechanically validates `pi`'s bulk content:
- **Graph:** every `connections` id resolves; the map is fully connected; all 8 gym
  towns are reachable from Aethel's Rest; connections are symmetric (A↔B).
- **Gyms:** exactly 8 gyms; each `gym.type` is a real type and `gym.trainer.gymType`
  matches; badge ids unique; level caps strictly increase by badge order.
- **Encounters:** every `species` in every table exists in `Dex.forGen(9).species`
  (and isn't `isNonstandard`); level ranges valid (`min ≤ max`, `≥ 1`).
- **Shops:** every `itemId` exists in the 3b item catalog.
- **Trainers:** every `TrainerDef` has valid tier/personality/levelCap; gym leaders'
  drafted teams are type-legal via the Composer (spot-check a couple).
- **Composer smoke test:** for each of the 8 gyms, `composeTeam` produces a legal,
  type-locked team at the gym's levelCap.

## Module / file layout

- `scripts/gen-data.mjs` + generated `src/data/catch-rates.ts`, `src/game/exp-yield.ts`,
  `src/game/growth-rates.ts`, `src/data/ev-yield.ts`.
- `src/content/region/*.ts` — the full region data (towns, routes, gyms, trainers,
  shops, npcs), registered through the existing `region.ts` registry (extended to
  load the full set instead of only the slice).
- `src/content/region-integrity.test.ts` — the validation suite.

## Test strategy

- Data anchors test (known catch/exp/growth/EV values).
- Region-integrity suite (above).
- The 4a `slice-integration` test still passes against the expanded region.
- All 151 prior tests still pass.

## Out of scope (later)
Elite Four, Champion, the stabilize-meter + faction story beats, the Reset/Embrace
ending, and Vriska's literal room-gauntlet (all 4c). Rendering (5). Breeding/day-night
*driver*, post-game. NPC dialogue is flavor-level, not branching quests.
