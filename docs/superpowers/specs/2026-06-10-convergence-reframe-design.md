# The Convergence Reframe — Design

**Status:** Design approved 2026-06-10 (spine + rift roster). This doc captures the overarching reframe and specifies **Sub-project 1 (Region & narrative reframe)** in full; sub-projects 2–4 are described at the decomposition level and each gets its own spec later.

**Supersedes:** the gym/badge/Elite-Four structure in `src/content/region/index.ts` and the badge-gated beats in `src/content/story/beats.ts`. Keeps the faction premise (Purist/Synthesist + Stabilize meter) and the battle/catch/leveling/AI engines untouched (`src/`).

---

## Vision

The world is fusing through the **World Core** — the old regions bleed into one another along unstable **convergence rifts**. The player is a trainer loose in the collapse. Two philosophies pull at the world: **Purist** (Reset — tear the worlds back apart) and **Synthesist** (Embrace — let them become one). The player's choices ride a **Stabilize meter** and resolve at the Core.

There are **no gyms, badges, or Elite Four.** The spine is a chain of **7 rifts**, each a seam where two worlds bleed together (this *is* the map aesthetic — biome fault-lines). Each rift is held by a **Warden**; beating the Warden unlocks a choice:

- **Seal** (Purist) → the seam closes, the zone reverts to a single original region, its fused "convergence" Pokémon vanish for pure-region species, the area calms. Meter → Reset.
- **Attune** (Synthesist) → the seam stays open, the zone keeps its fused Pokémon and grows wilder/more dangerous. Meter → Embrace.

Choices are **mixable** — the *pattern* of seals vs attunes (cumulative meter) decides the finale at the World Core: **Reset**, **Embrace**, or — if balanced — the **third path**. A single climactic **Warden of the Core** replaces the Elite Four gauntlet.

## Decomposition (sub-projects, dependency order)

1. **Region & narrative reframe** *(this doc, in detail)* — the data redesign: 7 rift zones, their bleeding biome pairs, Wardens, level bands, dual encounter tables, the rewritten beats. Everything downstream needs this.
2. **Rift & zone-state system** *(own spec later)* — per-rift `unsealed | sealed | attuned` state in GameState; sealing reverts biome + swaps fused→pure encounters; attuning raises danger; meter accumulation; ending resolution.
3. **Wardens & tricky AI** *(own spec later)* — each Warden a boss using the existing adaptive AI (`personality` aggression/caution) with a **signature convergence tactic**; the post-battle Seal/Attune choice flow + UI.
4. **Seam-based map generation** *(own spec later)* — procedurally generate each zone's map with a biome **fault-line** reflecting its current state, rendered through the SP-1 MapV2 pipeline, then hand-tuned.

---

# Sub-project 1: Region & Narrative Reframe

## The rift chain

A continuous gradient: each rift shares its *second* biome with the next rift's *first*, so walking the chain is one long bleed from Kanto-plains to Paldea-wilds. The hub (Aethel's Rest) sits in the Core's shadow. `galar-countryside` is held in reserve for the Core zone.

| # | Rift | Biome pair (A ⇄ B) | Warden | Lv band | Signature tactic (tricky AI) |
|---|------|--------------------|--------|---------|------------------------------|
| — | Aethel's Rest (hub) | kanto-plains (stable) | — | 5 | — |
| 1 | Thornmarsh Rift | kanto-plains ⇄ johto-forests | Bramble | 10–14 | Grassy-terrain overgrowth + entry hazards from both ecologies; slow attrition. |
| 2 | Drowning Coast | johto-forests ⇄ hoenn-beaches | Maris | 18–22 | Rain + Swift-Swim sweepers behind forest cover; defensive stall, scald burns. |
| 3 | Emberreef | hoenn-beaches ⇄ alola-islands | Ignis | 25–29 | Sun/drought aggression vs your water answers; fast offensive sweeps, fake-out pivots. |
| 4 | Neon Wilds | alola-islands ⇄ unova-urban | Zap | 32–36 | Electric terrain, paralysis, hard speed control; jungle-vs-neon dual coverage. |
| 5 | Bloomgrave | unova-urban ⇄ kalos-gardens | Sylas | 39–43 | Trick Room mind-games, status spam, set-up baiting — the cerebral fight. |
| 6 | Frostbloom | kalos-gardens ⇄ sinnoh-tundra | Glacia | 46–50 | Snow/Slush-Rush, freeze pressure, Aurora Veil walls. |
| 7 | The Maw | sinnoh-tundra ⇄ paldea-wilds | Vriska | 53–57 | The hardest puzzle: dragon-fusions, weather chaos, multi-threat win conditions. |
| ★ | The World Core | galar-countryside / void | Warden of the Core | 60+ | Final multi-phase Warden; the seal/attune pattern shapes the encounter + ending. |

Wardens are the existing leader names recast as seam-keepers (no longer "the X-type Gym"). The old Elite Four names (Ferrum, Lumina, Wraith, Kairos) are dropped from the spine; one may be repurposed as the Warden of the Core or its lieutenants (deferred to sub-project 3).

## Zone states

Each rift zone is one of three states, tracked in GameState (system built in sub-project 2; this doc defines the *data* each state needs):

- **`unsealed`** (default): live seam. Map shows the biome fault-line; encounters use the rift's **fused table** (convergence Pokémon — cross-region species mixes, the catch hook); ambient hazard/danger flavor.
- **`sealed`**: the seam closes. Map reverts toward the rift's **`sealedBiome`** (one of its pair — by default biome A, the older/upstream world). Encounters use the **pure table** (single-region species). Calmer.
- **`attuned`**: seam stays open and intensifies. Map keeps the fault-line (more extreme). Encounters use the fused table at a **raised level/rarity** (stronger, rarer convergence mons). More dangerous, better rewards.

## Data model changes

In `src/content/types.ts` (additive + one replacement):
- **Add `RiftDef`** (replaces `GymDef` for the spine):
  - `id`, `name`, `biomeA: Biome`, `biomeB: Biome`, `sealedBiome: Biome` (defaults to `biomeA`)
  - `levelBand: { min: number; max: number }`
  - `warden: WardenDef`
  - `fusedEncounters: EncounterTable` (unsealed & attuned)
  - `pureEncounters: EncounterTable` (sealed)
- **Add `WardenDef`** (extends the current `TrainerDef` shape): existing fields (`id`, `name`, `baseTier`, `personality`, `teamSize`, `levelCap`, `basePayout`, `dropTable`) **plus** `signatureTactic: string` (a tag the AI/team-builder reads, e.g. `'rain-stall'`, `'trick-room'`, `'dragon-chaos'`).
- **Keep `Biome`, `EncounterTable`, `EncounterEntry`, `NpcDef`, `TrainerDef`** as-is. `TrainerDef` still used for ordinary overworld trainers (sub-project 3).
- **Remove/retire `GymDef`** usages once `region/index.ts` is rewritten (leave the type defined but unused until cleanup, to avoid breaking imports mid-migration).

In `src/content/region/index.ts`:
- Replace the 8 gym `TrainerDef`s + `GymDef`s + the gym-town `Location`s with **7 `RiftDef`s** + their hub/zone `Location`s.
- Each rift zone is a `Location` (kind `route` for the seam approach + a small settlement, per sub-project 4's maps) carrying its `RiftDef` id instead of a `gymId`.

In `src/content/story/beats.ts`:
- The 5 beats fire on **rifts addressed** (e.g. after rifts 0/2/4/6 plus the Core), not badge counts. Dialogue updated to reference rifts/Wardens, not gyms. The faction `meterDelta` choices stay.

## Ending resolution (data only here; logic in sub-project 2)
At the Core, the finale reads the cumulative meter:
- meter ≤ −T → **Reset** (worlds restored).
- meter ≥ +T → **Embrace** (one fused world).
- |meter| < T → **Third path** (the synthesis ending).
The thresholds `T` and the per-choice deltas are tuned in sub-project 2; this doc only fixes that all three exist and are driven by the seal/attune pattern.

## What stays untouched
- `src/` engine: battle, catching, leveling, exp-yield, rewards, AI core — no changes.
- The SP-1 map pipeline (MapV2 format, renderer, autotiles, warps) — reused by sub-project 4; **the whole-map Essentials importer is demoted to a tileset-harvester/reference** (we no longer ship ripped layouts).
- The faction/meter concept and the `Biome` taxonomy.

## Testing (sub-project 1)
- Content is data; tests assert structure: 7 rifts present, each with a valid biome pair, a `sealedBiome` within its pair, both encounter tables non-empty, level bands monotonically increasing, every Warden has a `signatureTactic`. Mirror the existing `slice-species`/`data-anchors` test style in `src/content`.
- The 190+ engine tests must stay green; gym-specific tests are updated/replaced as the gym data is removed.

## Out of scope (here)
- The zone-state machine + ending logic (sub-project 2).
- Warden teams, AI tactic implementation, the Seal/Attune choice UI (sub-project 3).
- Seam map generation + fine-tuning (sub-project 4).
- Writing the actual flavor dialogue, fused-species rosters, and Warden teams — that's bulk authoring against this design (Pi), after the types and one worked example exist.
