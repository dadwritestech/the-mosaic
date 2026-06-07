# Game State & Core (Sub-project 3a) — Spec

**Date:** 2026-06-07
**Status:** Approved (design)
**Parent:** `2026-06-07-pokemon-region-game-design.md`
**Depends on:** Battle Bridge (1) — for the `PokemonSet` projection seam.

## Sub-project 3 decomposition

Game State & Economy is several systems; built as sequenced specs:
- **3a — Core player state + save/load** *(this spec)*: owned-Pokémon model, party, PC
  box, bag, badges, money, pokedex, location, settings; persistence; rule hooks.
- **3b — Economy**: shops (buy/sell), Pokémon Centers (healing), item definitions.
- **3c — Rewards & leveling**: EXP gain (exp-yield table), level-ups, money/item
  rewards scaling with opponent strength (see memory: rewards-and-economy-design).
- **3d — Time/day system + trainer rematch lifecycle**.

Everything in 3b–3d reads/writes the 3a `GameState`.

## Purpose

The persistent heart of the game: a full-fidelity, serializable `GameState` plus the
pure helpers to read/mutate it, a storage-agnostic save system, and the rule hooks
(save policy, Nuzlocke) that later systems enforce. Fully headless and testable.

## Fidelity decision

**Full mainline fidelity (option C).** Owned Pokémon track IVs, EVs (with caps),
nature, ability slot, friendship, Pokérus, shininess, held item, per-move PP, caught
metadata, and current HP/status that **persists between battles** (which is what makes
Pokémon Centers economically meaningful). Derived values (battle stats, Hidden Power
type, level-from-exp) are computed by pure functions, never stored, so they can't drift.

### Data Showdown lacks (bundle our own tables, same pattern as catch rates)
Verified at plan time, but expected gaps: **growth-rate curve** per species (leveling
speed group) and **EV yield** per species — Showdown omits these (competitive sim).
We bundle them like `src/data/catch-rates.ts`. Exp yield already noted in 3c.

## Data model

```ts
interface OwnedPokemon {
  uid: string; species: string; nickname?: string;
  level: number; exp: number;            // exp is source of truth; level synced via growthRate
  ivs: Stats6;                           // each 0..31
  evs: Stats6;                           // each ≤252, total ≤510
  nature: string;
  ability: string; abilitySlot: '0' | '1' | 'H' | 'S';
  gender?: 'M' | 'F' | 'N'; shiny: boolean;
  moves: { id: string; pp: number; ppUps: number }[]; // ≤4
  heldItem?: string;
  currentHp: number; status: string;     // PERSIST between battles ('', psn, brn, par, slp, frz, tox)
  friendship: number;                    // 0..255
  pokerus: 'none' | 'infected' | 'cured';
  caughtInfo: { ball: string; location: string; metLevel: number; day: number; originalTrainer: string };
}

interface GameState {
  schemaVersion: number;
  settings: { difficultyMode: 'normal' | 'hard' | 'hardest'; nuzlocke: boolean };
  party: OwnedPokemon[];                  // ≤6
  boxes: { name: string; slots: (OwnedPokemon | null)[] }[];
  bag: Record<string, Record<string, number>>; // pocket -> itemId -> count
  money: number;
  badges: string[];
  pokedex: { seen: Set<number>; caught: Set<number> };
  location: { mapId: string; x: number; y: number; atPokemonCenter: boolean };
  flags: Record<string, unknown>;         // story/event + per-area "encounter:<areaId>" markers
  graveyard: OwnedPokemon[];              // Nuzlocke fallen
  time: { day: number; minutes: number }; // structure owned by 3d; field lives here
}
```

## Core modules & responsibilities

- `src/game/stats.ts` — pure stat math: `computeStats(mon, baseStats)` (mainline
  formula incl. nature), `hiddenPowerType(ivs)`, `maxHp(mon, baseStats)`.
- `src/game/owned-pokemon.ts` — construct/mutate one Pokémon: `createOwned(...)`,
  `gainExp`, `levelFromExp(exp, growthRate)`, `healFull`, `setHp`, PP helpers,
  EV-add with caps. Pure functions returning new/updated mons.
- `src/game/projection.ts` — `ownedToSet(mon): PokemonSet` (the Battle Bridge seam).
- `src/game/game-state.ts` — `createNewGame(settings)`; container ops: party
  add/remove/swap (≤6 enforced), box deposit/withdraw, bag add/remove/use, money
  add/spend (no negative), badge grant, pokedex register (seen/caught).
- `src/game/save.ts` — `serialize(state)→string` / `deserialize(string)→GameState`
  (Sets ↔ arrays, `schemaVersion` stamp), `validateAndRepair(state)` (clamp party
  size, EV caps, HP≤max), and the `SaveStore` interface + `InMemorySaveStore`.
- `src/game/rules.ts` — `canSaveHere(state)` (B/C by difficultyMode + atPokemonCenter);
  `applyFaintConsequences(state)` (Nuzlocke permadeath → graveyard); area-encounter
  marker helpers `markEncounterUsed`/`isEncounterUsed`.

## Rule hooks (enforced by later systems)

- **Save policy:** `canSaveHere` — `normal`/`hard` always true; `hardest` true only when
  `location.atPokemonCenter`. The save menu (UI, later) greys out Save otherwise.
- **Nuzlocke** (flag in `settings.nuzlocke`): 3a owns the flag + graveyard. Permadeath
  fires via `applyFaintConsequences` from the post-battle flow; first-encounter-only
  fires from the catch flow checking `isEncounterUsed`. Both no-ops when toggled off.

## Open integration question (resolve at plan time, with verification)

Showdown's team format starts mons at **full HP** with no slot for current HP/status.
Carrying persistent HP/status *into* a battle needs a probe: inject via the sim API,
or accept battles begin at full and persist HP only in the overworld. Does NOT block
3a (the state model is correct regardless); affects the Battle Bridge↔state wiring,
addressed when 3c/battle-start integration is planned.

## Test strategy (headless, deterministic)

- **Stat math:** `computeStats` matches known mainline values for a sample mon
  (e.g., a level-50 Garchomp with set IVs/EVs/nature); nature raises/lowers the right
  stats; `hiddenPowerType` matches a known IV spread.
- **Exp/level:** `gainExp` crosses level thresholds correctly per growth rate; level
  never exceeds 100.
- **Containers:** party capped at 6; box deposit/withdraw round-trips; money can't go
  negative; bag add/use adjusts counts; pokedex seen/caught register.
- **Projection:** `ownedToSet` yields a `PokemonSet` the Battle Bridge accepts (a
  composed/owned team starts a battle that runs to completion).
- **Save:** `deserialize(serialize(state))` deep-equals the original (incl. Sets);
  `validateAndRepair` clamps an over-cap/oversized save; `SaveStore` save→load→delete.
- **Rules:** `canSaveHere` true/false per mode+location; `applyFaintConsequences`
  moves fainted party mons to graveyard only when Nuzlocke on; encounter markers.

## Out of scope (later sub-projects)

Shops/Centers/economy (3b), exp/money/item *rewards* from battles (3c), the time/day
system + rematch lifecycle behavior (3d), overworld movement & encounters (4), UI (5).
3a provides the data + helpers those systems call.
