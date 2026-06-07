# Convergence Region — Project Design

**Date:** 2026-06-07
**Status:** Approved (overall vision & architecture)
**Type:** Private experiment — not for public distribution

## One-line summary

A complete, playable-end-to-end Pokémon-style RPG with a new region, new badges,
and adaptive-difficulty AI, built in the browser (Three.js) on top of the
**Pokémon Showdown** battle engine, which is used *only* for battle resolution.

## Goal & framing

- **Goal:** a real, playable game (not a throwaway proof-of-concept), built
  incrementally across many sessions.
- **Distribution:** **PRIVATE.** Never publicly released. This is a deliberate
  decision (see "Legal posture") that makes using real Pokémon and the full
  National Dex acceptable — the same zone Pokémon Showdown itself operates in.

## Legal posture (why private)

- Pokémon fan games are aggressively enforced by The Pokémon Company; free and
  non-commercial is **not** a shield (e.g. Pokémon Uranium, Prism were shut down
  post-release). **Attribution does not protect against infringement.**
- Public release would force a pivot to **original creatures**, which carries an
  enormous asset burden (3D model + textures + rig + animations + icon + portrait
  per creature *and* per evolution stage — thousands of assets at all-gen scale).
- We avoid all of this by staying private and using real Pokémon. The region
  content is kept as **pure data**, so the creature roster remains swappable if
  the project's intent ever changes.

## What Pokémon Showdown provides (and doesn't)

- **Provides:** a headless, competitive-grade battle engine (`sim/`) that knows
  every species, move, ability, item, type interaction, and damage formula across
  all generations. Driven via a text **stream protocol** (`>p1 move 1` in,
  `|-damage|...` out).
- **Does NOT provide:** any overworld, map, story, NPCs, catching, Poké Balls,
  badges, progression, economy, or save system. **All of that is the game we build.**

Mental model: **Showdown is the combat middleware; we build the entire RPG around it.**

## The region: "Convergence"

A region conceived as the *culmination/convergence of all regions* — a believable
in-world reason it hosts species from every generation (the full National Dex).
Gyms/towns can be themed as homages to the classic regions meeting in one place.

- **8 gyms / 8 badges**, each type-locked.
- **Gym type constraint (data-driven rule):** every Pokémon on a gym's roster must
  have a typing that *includes* the gym's type. Dual-types qualify (a Steel gym may
  use Steel/Fire) but off-type mono species do not (a Steel gym may not use pure
  Fire). This falls out of filtering the dex — no special-casing.

## Core gameplay systems

- **Battles:** full Showdown battles for trainers, gyms, and **wild encounters**.
- **Catching (classic, battle-based):** wild encounters are real battles — weaken
  / inflict status, then throw a ball. Showdown has no catch concept, so the
  catch-rate formula is implemented by us and injected as a custom battle action.
- **Pokémon Centers:** full party healing.
- **Shops:** buy/sell items; part of a tuned economy (money rewards vs. item sinks).
- **Progression:** party, PC box, bag, badges, money, location; save/load.
- **Overworld:** 3D **grid/tile** movement (tile-snapped, 3D camera), Pokémon-style.
  Encounters in tall grass; trainer line-of-sight. Ambient "lived-in" polish:
  grass shaders, firefly/leaf particles, NPCs with routines (catching, fishing,
  wandering, chatting).

## Adaptive AI (headline feature)

The differentiator vs. typical fan games (which use simplified scripted battles):
a single-player RPG on a **competitive-grade engine** driven by a **genuinely
adaptive AI**. Two separable layers:

1. **Team composition** — drafts a trainer's team from the full dex, constrained by
   gym type + difficulty + region context.
2. **In-battle decision-making** — one scoring "brain" (heuristic → optional
   one-turn lookahead using Showdown's own engine to evaluate outcomes).

All difficulty behavior is **knobs into that one brain**, not separate AIs:
- **Difficulty tiers:** Easy (near-random) / Normal (greedy best-move) /
  Hard (lookahead + smart switching). Set per-trainer by who they are.
- **Adaptation:** track simple stats about the player's recent choices (lead
  patterns, type over-reliance) and bias scoring within and across battles.
- **Auto-scaling:** measure player performance (win streak, margin) and rubber-band
  overall difficulty to keep it challenging.
- **Advanced-player toggle:** raises the floor for skilled players.

## Architecture (strict downward-only layering)

```
PRESENTATION (Three.js): 3D tile overworld · FX · NPCs · battle scene · menus/shops
GAME LOOP / STATE: party/box/bag/badges/money/location · save/load · triggers · economy
REGION CONTENT (pure data): maps · towns · 8 type-locked gyms · rosters · encounters · shops
AI BRAIN: team composition (gym-type filtered) + in-battle decisions + difficulty knobs
BATTLE BRIDGE: wraps Showdown sim stream · start · submit actions · read results · CATCH
POKÉMON SHOWDOWN sim/  (imported library, untouched)
```

Dependencies point **downward only**. Each layer is built and tested in isolation.
The AI brain and the battle bridge are deliberately separate: the bridge is dumb
plumbing (relays actions), the brain is where intelligence lives.

## Build order (each = its own spec → plan → build, independently testable)

1. **Battle Bridge** — prove a single scripted battle runs end-to-end vs. Showdown,
   including the custom catch action. *Pure logic, no graphics.* (First spec —
   see `2026-06-07-battle-bridge-design.md`.)
2. **AI Brain** — plug smart decisions + difficulty knobs into the bridge.
3. **Game State & Economy** — party/box/bag/badges/money, save/load, shop & Center
   logic. Still headless/testable.
4. **Region Content** — the actual region: 8 type-locked gyms, routes, trainers,
   encounters, shops.
5. **Presentation** — the Three.js 3D overworld, battle scene, UI, lived-in polish.

We reach a **playable-in-terminal** game by step 4, then make it beautiful in step 5.

## Workflow note

High-volume, well-bounded work (region data files, UI scaffolding) will be
delegated to a local coding agent ("pi"), with Claude writing the mini-spec,
reviewing the diff, and running tests before accepting. Good module isolation
makes that delegation effective.
