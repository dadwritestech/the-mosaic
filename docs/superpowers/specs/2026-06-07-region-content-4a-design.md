# Region Content — Schema + Vertical Slice (Sub-project 4a) — Spec

**Date:** 2026-06-07
**Status:** Approved (design)
**Parent:** `2026-06-07-pokemon-region-game-design.md`
**Worldbuilding:** `2026-06-07-the-mosaic-worldbuilding.md`
**Depends on:** Battle Bridge (1), AI Brain (2), Game State 3a/3b/3c/3d.

## Purpose

Encode the region as data and prove a playable slice runs end-to-end through every
engine. 4a delivers the **content schema**, two pure modules (registry + encounter
roller), the **Aethel's Rest → Whispering Path → Verdant Hollow** vertical slice, and
one integration test that walks the slice through the whole stack. Headless.

## Sub-project 4 decomposition

- **4a — Schema + vertical slice** *(this spec)*: data types, registry, encounter
  roller, the first town/route/gym, the end-to-end wiring test.
- **4b — Bulk content** (later, `pi`): the other 7 gyms, all routes/towns, every
  biome's encounter tables, and the full National-Dex data tails (catch-rate,
  exp-yield, growth-rate, EV-yield).

## Content schema (`src/content/types.ts`)

```ts
type Biome = 'kanto-plains' | 'johto-forests' | 'hoenn-beaches' | 'sinnoh-tundra'
  | 'unova-urban' | 'kalos-gardens' | 'alola-islands' | 'galar-countryside' | 'paldea-wilds';
type TimeBucket = 'morning' | 'day' | 'night';

interface EncounterEntry { species: string; minLevel: number; maxLevel: number; weight: number; }
type EncounterTable = Partial<Record<TimeBucket, EncounterEntry[]>>; // Convergence Tide

interface NpcDef { id: string; name: string; lines: string[]; reputationGated?: string; }

interface TrainerDef {
  id: string; name: string;
  gymType?: string;            // present for gym leaders (type-lock for the Composer)
  baseTier: 'easy' | 'normal' | 'hard';
  personality: { aggression: number; caution: number };
  teamSize: number; levelCap: number;
  basePayout: number;
  dropTable?: { itemId: string; chance: number }[];
}

interface GymDef { trainer: TrainerDef; badgeId: string; type: string; }

interface Location {
  id: string; name: string; kind: 'town' | 'route'; biome: Biome;
  connections: string[];               // adjacent location ids
  isPokemonCenter: boolean;
  npcs: NpcDef[];
  encounters?: EncounterTable;         // routes (and some towns)
  shopId?: string;                     // refers to a ShopDef (3b)
  gymId?: string;                      // refers to a GymDef
}
```

## Modules

- `src/content/region.ts` — registry over the slice data: `getLocation(id)`,
  `getTrainer(id)`, `getGym(id)`, `neighbors(id)`, `getShop(id)`. Pure lookups;
  throws on unknown ids.
- `src/content/encounters.ts` — `rollEncounter(table, timeOfDay, rng) →
  { species: string; level: number } | null`: weighted pick from the time-bucket's
  entries; random level in `[min,max]`; `null` if the bucket has no entries.
- `src/content/slice/*.ts` — the vertical-slice data (locations, trainers, gym, shop,
  npcs) conforming to the schema.

## Vertical-slice content

- **Aethel's Rest** (town, `kanto-plains`, `isPokemonCenter: true`): guide NPC Aethel;
  a basic shop (Poké Balls, Potions via 3b catalog); connects to Whispering Path.
- **Whispering Path** (route, `kanto-plains`): an `EncounterTable` with early-gen
  common species across the three time buckets (e.g. morning Pidgey/Rattata, night
  Hoothoot/Zubat — all in our seeded data tables); 1-2 `TrainerDef`s; connects
  Aethel's Rest ↔ Verdant Hollow.
- **Verdant Hollow** (town, `johto-forests`, `isPokemonCenter: true`): Bramble's
  **Grass** `GymDef` (badgeId `mosaic-leaf`, type `Grass`, tier `easy`, levelCap ~12);
  connects back to Whispering Path.

All slice species must exist in the seeded catch-rate / exp-yield / growth-rate tables
(extend those seeds if a chosen species is missing — a small, in-scope addition).

## End-to-end wiring test (the proof)

`src/content/slice-integration.test.ts` walks the slice through the full stack:
1. **Wild encounter:** `rollEncounter(WhisperingPath.encounters, 'day', rng)` → a
   species; `createOwned` it; project to a `PokemonSet`; run a wild battle on the
   **Battle Bridge**; weaken + `attemptCatch` succeeds at high odds.
2. **Gym battle:** `composeTeam` (2c) for Bramble's `GymDef` (Grass-locked, gym
   levelCap) → every drafted mon's typing includes Grass; battle through the **Bridge**
   with the **AI Brain (2a)** choosing the gym's moves → reach a winner.
3. **Reward + progression:** on a win, `applyBattleResult` (3c) grants EXP/money;
   `grantBadge(state,'mosaic-leaf')`; `recordTrainerDefeat(state, bramble.trainer.id)`
   (3d) — assert badge present, money gained, trainerLog updated.

If this passes, the schema provably drives a playable segment through the entire
verified engine stack.

## Test strategy (headless, deterministic)

- **Schema/registry:** `getLocation`/`getTrainer`/`getGym` resolve slice ids and throw
  on unknowns; `neighbors` returns the declared connections; the slice graph is
  connected (Aethel's Rest ↔ Whispering Path ↔ Verdant Hollow).
- **Encounters:** `rollEncounter` only returns species from the given time bucket;
  level falls within the entry's range; respects weights over many rolls (a
  weight-0 entry never appears, a dominant-weight entry appears most often); `null`
  for an empty bucket. Deterministic under a seed.
- **Gym data:** Bramble's `GymDef` is Grass-typed; the Composer drafts a legal
  Grass team from it.
- **Integration:** the end-to-end wiring test above.

## Out of scope (later)
The other 7 gyms / full region map / all biome encounter tables / full data-table
tails (4b, `pi` bulk); the Tide's day-to-day rotation *driver* and the stabilize
meter *content* (hooks exist; tuned with full content); overworld movement & rendering
(5). NPC dialogue *content* is minimal in the slice; bulk dialogue is 4b/5.
