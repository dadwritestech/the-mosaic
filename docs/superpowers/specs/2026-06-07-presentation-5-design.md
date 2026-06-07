# Presentation (Sub-project 5) — Design

**Date:** 2026-06-07
**Status:** Approved (design); 5a is the first build slice.
**Parent:** `2026-06-07-pokemon-region-game-design.md`
**Depends on:** ALL prior sub-projects (1-4c) — the verified game logic this renders.

## Purpose

Make the game visible and playable: a web front-end (Vite + TS) over the existing,
fully-tested logic. Turns ~180 passing tests into a game you can walk around and play.

## Locked visual direction (from the visual-companion session)

- **Overworld + menus: 2D.** Classic top-down tile world (cute, readable, Let's-Go
  *spirit*), sprite-based. (Overrides the earlier "3D low-poly overworld" idea.)
- **Battles: 3D.** Real ripped **3D creature models** (GLB/GLTF) on a **cinematic
  tilted field with a dynamic camera** (the "b+A" combo), under a **classic 2D HUD**
  (corner HP bars, 4-move grid, you-back/foe-front).
- **Asset sourcing (private experiment — ripped assets OK, never distributed):**
  2D tilesets + overworld/creature sprites and 3D battle models from rip sites;
  **Pokémon Showdown's own sprite server** (`play.pokemonshowdown.com/sprites/...`)
  covers the full National Dex for 2D, matching our engine. Full-dex 3D model sourcing
  is a later bulk task; **5a uses only the slice species' models.**

## Stack & architecture

- **Vite + TypeScript** web app in `web/`, importing `src/game`/`src/ai`/`src/bridge`/
  `src/content` as the model. Presentation is view/controller; **no new game logic.**
- **Two renderers switched by screen:** a 2D layer (Canvas/PixiJS or DOM) for overworld
  + menus; **Three.js** for the 3D battle scene. A DOM/CSS overlay for HUD/menus.
- **Screen state machine** (`GameApp`): one of `overworld` / `battle` / `dialogue`
  active at a time (more screens in 5b); holds the live `GameState`; transitions
  between screens and threads results back (e.g. `applyBattleResult` after a battle).

## Decomposition

- **5a — Playable vertical slice** *(first)*: app shell + 2D overworld (slice map,
  tile-step movement, camera, grass encounters, NPC dialogue) + 3D battle scene wired
  to the real Bridge + AI + `applyBattleResult`, rendering Aethel's Rest → Whispering
  Path → Verdant Hollow incl. Bramble's gym. Screenshot-verified.
- **5b — Full UI suite**: party / bag / PC box / shop / Center / pokédex / save-load /
  Vs-Seeker / story-choice / ending screens, over the full region.
- **5c — Lived-in polish**: grass-sway, firefly/leaf particles, roaming NPC routines,
  transitions, audio.

## 5a detail

### New presentation-only data
- **Tilemaps:** `web/overworld/maps/*.ts` — a 2D grid of tile types
  (`floor`/`grass`/`wall`/`building`/`exit`/`gym`/`npc`) per slice location, since the
  `content.Location` schema is logical (connections/encounters/npcs), not spatial. Each
  exit/gym/npc tile references a content id (location to move to / gym id / npc id).
- **Asset manifest:** `web/assets/manifest.ts` — species → { spriteUrl, modelUrl } for
  the slice species (Pikachu, Pidgey, Rattata, Caterpie, Hoothoot, Bramble's grass
  team). 2D from Showdown sprites; 3D GLB from a rip source (a few files for 5a).

### Modules
- `web/main.ts` — bootstraps `GameApp`, loads assets, starts the overworld.
- `web/app/game-app.ts` — screen state machine + live `GameState` + transitions.
- `web/overworld/overworld-screen.ts` — render tilemap, player sprite, input
  (tile-step), camera; on grass → `rollEncounter`(clock `timeOfDay`) → battle; on
  exit → change location; on gym → gym battle; on npc → dialogue; each step
  `advanceStep`.
- `web/battle/battle-screen.ts` — Three.js scene (field/camera/lights/2 GLB models) +
  DOM HUD; orchestrates `BattleBridge` + `chooseAction` (AI) + animates `events`;
  player input drives `submitTurn`; catch via `attemptCatch`; ends → `applyBattleResult`
  → back to overworld.
- `web/ui/hud.ts`, `web/ui/dialogue.ts` — DOM overlays.

### Battle flow (reuses verified logic exactly)
1. Build the player's `TeamSpec` via `ownedToSet`; build the opponent (wild =
   `createOwned` from the encounter; gym = `composeTeam(gym.trainer)`).
2. `bridge.startBattle(player, opp, { formatid:'gen9customgame', isWild, initialConditions: carryConditions(party) })`.
3. Each turn: player picks a move/switch/ball in the HUD; the AI picks via
   `chooseAction(buildView(...))`; `bridge.submitTurn(...)`; animate `events`, update HUD.
4. End: `applyBattleResult(state, outcome)` (writeback + exp + rewards); if a gym win,
   `grantBadge` + `recordTrainerDefeat`; return to overworld.

### What 5a renders (the demo path)
Aethel's Rest (walk, talk to Aethel, see shop/Center tiles) → Whispering Path (tall
grass → wild encounter → 3D battle → catch or win → back) → Verdant Hollow → Bramble's
gym tile → 3D gym battle vs the AI Brain → win → badge granted. A complete on-screen
vertical slice.

## Verification

- **Visual/manual:** run the Vite dev server; use browser automation tools to load the
  app, drive input (walk, enter grass, fight), and **screenshot** each milestone
  (overworld, encounter, 3D battle, victory+badge). This is the acceptance proof.
- **Logic:** unchanged — the 179 existing tests still cover everything underneath.
- **Light unit tests** where cheap: tilemap loader (tile-type parsing, exit refs),
  screen-machine transitions, `carryConditions`/asset-manifest resolution. Rendering
  itself is verified visually, not unit-tested.

## Tooling notes
- Add Vite + Three.js (+ Pixi if used) as deps; a `web/index.html` entry; an `npm run
  dev` / `npm run build:web` script. Keep Vitest config working (separate from the app
  build).

## Out of scope (later sub-slices / never)
5b UI screens; 5c polish/audio; full-dex 3D model sourcing (bulk); mobile/touch;
multiplayer; New Game+. The overworld map *content* beyond the slice arrives with 5b.
