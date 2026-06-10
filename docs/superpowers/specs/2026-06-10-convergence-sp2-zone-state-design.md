# Convergence SP2 — Rift & Zone-State System Design

**Status:** Design draft 2026-06-10. Builds on SP1 (rift data) and the approved reframe (`2026-06-10-convergence-reframe-design.md`). Engine-only and additive; no server/UI/region changes (those are SP3).

## Goal

The pure game-logic layer that makes rifts *mean* something: per-rift state (`unsealed | sealed | attuned`), the **Seal** and **Attune** actions (including the team-gen-lean seal direction from SP1's data), which encounter table a zone yields in each state, story beats that fire on rifts addressed, and the Core ending resolution. All as tested functions on `GameState` — the server/UI wire to them in SP3.

## What exists (grounding)
- `GameState` (`src/game/types.ts`): has `party`, `stabilizeMeter`, `flags: Record<string, unknown>`, `schemaVersion`.
- Meter (`src/game/story.ts`): `pushMeter(state, delta)`, `meterTier(state)` → `'reset' | 'balance' | 'embrace'` (thresholds ∓34).
- Encounters (`src/content/encounters.ts`): `rollEncounter(table, bucket, rng)` takes an `EncounterTable`.
- Beats (`src/game/story.ts`): `StoryBeat { id, requiredBadges, dialogue, choices }`; `nextBeat(state, beats)` finds the first beat with `requiredBadges <= badges.length` not yet seen.
- SP1: `RiftDef` (`biomeA/biomeB`, `fusedEncounters`, `pureEncountersA/B`, `warden`), `ALL_RIFTS`/`getRift`, `BIOME_GEN`, `speciesGeneration`.

## Design

### 1. Rift state on GameState
Add one field (bump `schemaVersion`):
```ts
type RiftStatus = 'unsealed' | 'sealed' | 'attuned';
interface RiftState { status: RiftStatus; biome?: Biome; } // biome set only when sealed (the surviving region)
// in GameState:
riftStates: Record<string, RiftState>;   // keyed by rift id; absent ⇒ unsealed
```
A rift is "addressed" once its status is `sealed` or `attuned`. Choices are **permanent** (no re-choosing) — that's what makes them weigh.

### 2. Helpers (`src/game/rift-state.ts`, pure)
- `riftStatus(state, riftId): RiftStatus` — absent ⇒ `'unsealed'`.
- `riftsAddressedCount(state): number` — count of rifts not `unsealed`.
- `partyGenLean(party): 'new' | 'old'` — `newLean` = party mons with `speciesGeneration(num) ≥ 5`, `oldLean` = `≤ 4`; returns `'new'` iff `newLean ≥ oldLean` (the exact rule from the reframe). Species num via `Sim.Dex.forGen(9).species.get(species).num`.
- `sealDirectionBiome(rift, party): Biome` — `partyGenLean === 'new'` ⇒ the higher-`BIOME_GEN` of `{biomeA, biomeB}`, else the lower one.

### 3. Actions (pure; return new GameState)
- `sealRift(state, rift): GameState` — sets `riftStates[rift.id] = { status: 'sealed', biome: sealDirectionBiome(rift, state.party) }` and `pushMeter(state, -SEAL_DELTA)` (toward Reset). No-op if already addressed.
- `attuneRift(state, rift): GameState` — sets `{ status: 'attuned' }` and `pushMeter(state, +ATTUNE_DELTA)` (toward Embrace). No-op if already addressed.
- Constants: `SEAL_DELTA = ATTUNE_DELTA = 16` (7 rifts × 16 = 112 > 100 cap → seal-all reaches full Reset; an even mix lands near 0 = third path). Tunable.

### 4. Zone encounters by state (`zoneEncounters(state, rift): EncounterTable`)
- `unsealed` ⇒ `rift.fusedEncounters`.
- `attuned` ⇒ fused, **danger-bumped**: a copy of `fusedEncounters` with every entry's `minLevel`/`maxLevel` `+ATTUNE_LEVEL_BUMP` (default `4`). Tunable. (Weights/rarity left as-is for determinism; rebalancing is a later tuning pass.)
- `sealed` ⇒ the surviving region's pure table: `riftStates[id].biome === rift.biomeA ? pureEncountersA : pureEncountersB`.
The caller still does `rollEncounter(zoneEncounters(state, rift), bucket, rng)` — unchanged roller.

### 5. Story beats on rifts addressed
- Extend `StoryBeat` with optional `requiredRifts?: number` (keep `requiredBadges` for back-compat). Update `nextBeat` to prefer `requiredRifts` when present: a beat is eligible when `(b.requiredRifts ?? Infinity) <= riftsAddressedCount(state)` **or** the legacy `b.requiredBadges <= badges.length`, and not yet seen. (Additive — old badge beats still work; new rift beats use the new field.)
- Rewrite `src/content/story/beats.ts`: the 5 beats fire at `requiredRifts` 0 / 2 / 4 / 6 / 7, dialogue reworded for rifts/Wardens/the Core (drop gym references). Keep each beat's faction `choices` + `meterDelta` (the meter system is unchanged).

### 6. Core ending resolution
- `convergenceEnding(state): 'reset' | 'embrace' | 'third'` — maps `meterTier`: `'reset'→'reset'`, `'embrace'→'embrace'`, `'balance'→'third'`. The Core finale (SP3) reads this.

## Files
- **Modify:** `src/game/types.ts` (add `RiftStatus`/`RiftState`, `riftStates` field, bump `schemaVersion`; new-game init sets `riftStates: {}`), `src/game/story.ts` (`requiredRifts` + `nextBeat` update, `convergenceEnding`), `src/content/story/beats.ts` (rewrite to rift beats).
- **Create:** `src/game/rift-state.ts` (helpers + actions + `zoneEncounters`), `src/game/rift-state.test.ts`.
- **Untouched:** `server/`, `web/`, `src/content/region/index.ts`, `src/ai/`, the battle engine. SP3 does that wiring.

## Testing
- `partyGenLean`: a party of Gen-1/2 mons ⇒ `'old'`; a party with ≥ half Gen-5+ ⇒ `'new'`; tie ⇒ `'new'`.
- `sealDirectionBiome`: Thornmarsh (kanto g1 ⇄ johto g2) with a new-leaning party ⇒ `johto-forests`; old-leaning ⇒ `kanto-plains`.
- `sealRift`/`attuneRift`: set status + biome, move the meter the right direction, are no-ops when already addressed.
- `zoneEncounters`: unsealed ⇒ fused; sealed-to-A ⇒ pureEncountersA; sealed-to-B ⇒ pureEncountersB; attuned ⇒ fused with levels bumped by 4.
- `riftsAddressedCount` + `nextBeat`: a beat with `requiredRifts: 2` fires only after 2 rifts addressed.
- `convergenceEnding`: meter −50 ⇒ reset; +50 ⇒ embrace; 0 ⇒ third.
- Full suite (219+) stays green; save schemaVersion bump handled in new-game/migration init.

## Open defaults (tunable, not blocking)
`SEAL_DELTA`/`ATTUNE_DELTA` (16), `ATTUNE_LEVEL_BUMP` (4), and the rift→beat thresholds (0/2/4/6/7) are first-pass values to tune during playtest.

## Out of scope (SP3)
Warden teams + AI tactic implementation, the post-battle Seal/Attune **choice UI**, the battle trigger at a rift, `region/index.ts` gym→rift rewire, server wiring of `zoneEncounters`, and full badge removal.
