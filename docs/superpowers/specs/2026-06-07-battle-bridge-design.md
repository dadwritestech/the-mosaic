# Battle Bridge — Spec (Sub-project 1)

**Date:** 2026-06-07
**Status:** Approved (design)
**Parent:** `2026-06-07-pokemon-region-game-design.md`

## Purpose

Turn Pokémon Showdown's competitive battle simulator into a clean, typed,
**headless** module the rest of the game can drive. The Battle Bridge is the
foundation every other system depends on. It contains **no graphics and no AI
decision-making** — it is plumbing that starts battles, exposes legal choices,
applies chosen actions, reports what happened, and adds the one mechanic Showdown
lacks: **catching**.

## Single responsibility

> Given two teams and a format, run a battle to completion by applying externally
> chosen actions, reporting structured results each turn — and allow a synthetic
> "throw ball" capture action in wild battles.

It does **not** decide moves (the AI Brain does, later). It does **not** know about
the overworld, party management, items beyond Poké Balls, or rendering.

## Background: how Showdown's sim works

- `sim/` exposes a `BattleStream`: write text commands in, read text protocol
  events out.
  - In:  `>p1 move 1`, `>p2 switch 2`, `>start {...}`, etc.
  - Out: `|move|p1a: Pikachu|Thunderbolt|p2a: Gyarados`, `|-damage|p2a: Gyarados|62/100`,
    `|faint|p2a: Gyarados`, `|turn|2`, `|win|p1`.
- Battles initialize from a **packed team** (Showdown's team format) and a **format**
  (we use a singles format over the full default dex; teams provided explicitly).
- The bridge's job is to **hide this text protocol** behind a typed API and parse
  events into structured data.

## Proposed interface (the contract)

```ts
class BattleBridge {
  // Start a battle from two team specs + format/options. Returns initial state.
  startBattle(p1Team: TeamSpec, p2Team: TeamSpec, opts: BattleOpts): BattleState

  // What can this side legally do right now?
  getChoices(side: Side): {
    moves: MoveChoice[],       // index, name, type, pp, disabled?
    switches: SwitchChoice[],  // index, species, hp%, fainted?
    canCatch: boolean          // true only in wild battles, player side
  }

  // Apply both sides' chosen actions, advance the turn,
  // return everything that happened + the new state.
  submitTurn(p1Action: Action, p2Action: Action): TurnResult
  // TurnResult = { events: BattleEvent[], state: BattleState }

  // Custom, non-Showdown action: attempt capture (wild battles only).
  attemptCatch(ballType: BallType): CatchResult
  // CatchResult = { caught: boolean, shakes: number }

  get state(): BattleState   // active mons, hp, status, field, isWild, winner?
}
```

Supporting types (sketch): `Action = MoveAction | SwitchAction | CatchAction`;
`BattleEvent` is a parsed, structured form of the protocol messages (move used,
damage, status applied, faint, stat change, weather, win) — the presentation layer
later renders these; tests assert on them.

## Catching as a synthetic action

Showdown has no Poké Balls or catch concept, so catching is modeled by the bridge,
not sent to Showdown:

1. Player chooses `attemptCatch(ball)` instead of a move (only allowed when
   `state.isWild` and on the player side).
2. The bridge computes capture using the **standard catch-rate formula** with
   inputs: target's current HP%, the target's status, the species **base catch
   rate**, and a ball modifier.
   - **NOTE (verified 2026-06-07):** Showdown's `Dex.species.get(...)` does **not**
     expose `catchRate` — it's a competitive sim and omits catching stats. We
     therefore bundle our own `catchRates` data file (species id → base catch rate,
     sourced from the public PokéAPI/Bulbapedia dataset) and look the value up
     there. Architecture is unchanged; this is just one extra data dependency owned
     by the bridge.
3. On **success**: end the battle as a capture (`CatchResult.caught = true`),
   surface the captured 'mon's full set so the game can add it to the party/box.
4. On **failure**: the throw **consumes the player's turn** — the bridge then lets
   Showdown resolve only the wild Pokémon's action for that turn, and the battle
   continues.

Note: this means a "catch turn" is asymmetric (player acts outside Showdown, wild
'mon acts inside it). The bridge orchestrates that ordering internally.

## Out of scope (later sub-projects)

- Any AI / move selection (the bridge receives actions; the AI Brain chooses them).
- Overworld, encounters, trainers, gyms.
- Party/box/bag/economy/save (Game State sub-project).
- Items other than Poké Balls.
- Rendering / Three.js.

## Test plan (test-first, pure Node, zero graphics)

1. **Scripted full battle:** fixed teams, hardcoded move choices each turn. Run to
   completion; assert the structured events are coherent — damage is dealt, at least
   one faint occurs, and the battle terminates with a declared winner.
2. **Type effectiveness sanity:** a super-effective move produces more damage than a
   not-very-effective one against the same target (guards that we're reading
   Showdown's results correctly).
3. **Catch success at low HP / status:** weaken a wild 'mon to low HP (and/or apply
   status), call `attemptCatch` with a strong ball, assert high success rate over N
   trials.
4. **Catch failure at full HP:** `attemptCatch` against a full-HP wild 'mon with a
   basic ball fails the large majority of the time, and the failed throw correctly
   consumes the turn (wild 'mon still gets to act).
5. **Illegal action handling:** `attemptCatch` in a trainer (non-wild) battle, or a
   move index that isn't legal, is rejected cleanly rather than corrupting state.

## Definition of done

- The interface above is implemented over Showdown's `BattleStream`.
- All five tests pass in pure Node with no rendering.
- A short README snippet shows how to start a battle, take a few turns, and attempt
  a catch — demonstrating the bridge in isolation.

## Open implementation questions (to resolve during planning, not now)

- Exact catch-rate formula variant (Gen-style) and ball modifier table.
- Team format representation we standardize on (packed vs. object) at the bridge
  boundary.
- Sync vs. async handling of the `BattleStream` (it is event/stream based).
