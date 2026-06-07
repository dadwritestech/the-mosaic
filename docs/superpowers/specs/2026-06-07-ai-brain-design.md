# AI Brain — Spec (Sub-project 2)

**Date:** 2026-06-07
**Status:** Approved (design)
**Parent:** `2026-06-07-pokemon-region-game-design.md`
**Depends on:** Battle Bridge (sub-project 1, complete)

## Purpose

The adaptive opponent intelligence — the headline feature that makes trainers feel
like humans who *know you*, not the stateless, semi-random AI of the real games. It
chooses the opponent's actions each turn, drafts opponent teams, and **learns the
player gradually** across battles. Fully headless and unit-testable; plugs into the
Battle Bridge (the brain is simply "the thing that chooses the opponent's Action").

## Design goals (from brainstorming)

- **Smart, not dumb:** a heuristic, *omniscient* (PvE) scorer that never makes
  obviously bad moves; a shallow `@smogon/calc` lookahead on the hardest tier.
- **Human, not robotic:** deliberate imperfection (a `randomness` knob), per-trainer
  personality, and prediction/reads — a perfectly optimal bot feels *less* human.
- **Gradual reputation:** the world does NOT react instantly. Tendencies accrue with
  a low learning rate; the AI only acts on them past a confidence threshold; global
  reputation diffuses slowly while recurring characters react sharper. Adaptation is
  *earned*, like real-world reputation.
- **Immersion-safe for erratic players:** profile *behavior/style*, not specific
  rosters, so a team-switcher is still "known"; degrade gracefully — low roster
  stability becomes its own signal that makes the AI play safe/balanced instead of
  making wrong hard-counter reads.

## Scope boundary (decomposition)

This sub-project owns: **player model + observer + team composer + decision brain +
difficulty controller.** It EXPOSES hooks for two systems built later:
- **Dialogue reputation** (Region/Presentation): the model exposes a `reputationLevel`
  + `notableTraits` + recognition flag for NPC lines. Rendering dialogue is NOT here.
- **Trainer rematch lifecycle** (Game State/overworld + a time/day system): defeated
  trainers heal at a Center and re-challenge after ~a day, possibly traveling to find
  the player. The *machinery* is NOT here; this sub-project provides the **per-character
  memory** that makes a rematch feel personal.

## Architecture (six single-purpose units)

```
TEAM COMPOSER  → drafts opponent TeamSpec: gym-type constraint · difficulty ·
                 player model (counter tendencies, gated). Uses Showdown learnsets.
DECISION BRAIN → chooseAction(state, choices, context) -> Action. Scores each legal
                 action: heuristics + @smogon/calc evaluator + personality + player
                 model prediction + difficulty knobs.
OBSERVER       → the ONLY writer of the player model. Turns Battle Bridge events into
                 gradual tendency updates (global slow, per-character sharp).
PLAYER MODEL   → persisted in save: behavioral tendencies (+confidence) · reputation
                 · per-character memory. Read by Composer & Brain; written by Observer.
DIFFICULTY     → combines baseTier · advancedToggle · autoScale · reputationRamp into
  CONTROLLER     knobs: randomness · lookaheadDepth · switchSmarts · predictionWeight ·
                 counterDraftStrength.
TRAINER        → per-trainer personality (aggressive/defensive/tricky) = weight biases.
  PROFILE
```

Dependency direction: Composer + Brain READ the player model; Observer WRITES it
(clean split so learning can't corrupt mid-battle decisions). The Brain reduces to a
single pure function `chooseAction(state, choices, context) -> Action`, matching the
Battle Bridge's action input.

## The Player Model (heart of "feels human")

**1. Behavioral tendencies** (global, style-based — survive team-switching). Each is a
value in [0,1] with a `confidence` (observation count / saturating counter):
- `aggression` — attack vs. switch/setup
- `switchiness` — pivot frequency
- `typeReliance` — super-effective coverage vs. balanced
- `statusUsage` — status-move frequency
- `sacrificeWillingness` — letting mons faint to preserve a win-condition
- `leadPattern` — predictable lead vs. varied
- `rosterStability` — keeps the same team? (low = "unpredictable" → AI plays
  safe/balanced instead of hard-countering)

**2. Reputation** (dialogue + difficulty hook): derived `reputationLevel`
(Unknown → Noticed → Known → Renowned → Legendary), climbing slowly with
wins/badges/margins; plus `notableTraits` (short strings like "Steel Gym crusher",
"status spammer"); plus a `recognized` flag.

**3. Per-character memory** (recurring trainers): `{ lastTeam, lastOutcome,
whatBeatThem }`, allowed a faster learning rate than the global model.

### Gradual update math
- Tendency update: `value += rate * (observed - value)` with a small `rate`
  (global) — one battle barely moves it; sustained behavior does.
- `confidence` rises per observation; the Brain/Composer only ACT on a tendency once
  `confidence > threshold` AND `reputationRamp` permits — early game plays the player
  "blind" regardless of behavior (the immersion guardrail, in code).
- Two learning rates: global tendencies slow; per-character memory sharp.

## Difficulty Controller

**Inputs:** `baseTier` (Easy/Normal/Hard per trainer), `advancedToggle` (global,
raises floor), `autoScale` (smoothed rubber-band from recent win streak / KO margins —
gradual, not snappy), `reputationRamp` (gates counter-draft & prediction; rises with
reputation).

**Output knobs:**
- `randomness` — P(pick a non-optimal move). The human-imperfection dial.
- `lookaheadDepth` — 0 (heuristic only) for Easy/Normal; 1 (`@smogon/calc`) for Hard.
- `switchSmarts` — quality of switching on bad matchups / predicted moves.
- `predictionWeight` — how much the Brain acts on the player model (further gated by
  per-tendency confidence + reputationRamp).
- `counterDraftStrength` — fed to the Composer.

One brain, parameterized by knobs — never branching "if Easy do X". Personality
(weights) is orthogonal to difficulty (sharpness).

## Team Composer

- **Inputs:** trainer def (gym-type constraint if gym, baseTier, personality, level
  cap, team size), `counterDraftStrength`, player model, Showdown dex.
- **Process:** (1) filter dex by constraint — typing must *include* the gym type
  (dual-types pass; off-type mono fails); (2) draft N species scaled to level/tier;
  (3) bias toward answers to confident, reputation-gated tendencies via
  `counterDraftStrength`, BUT draft balanced/flexible for low `rosterStability`;
  (4) assign movesets/items/EVs from each species' **Showdown learnset** via a
  tier-scaled heuristic (higher tier = better coverage/items/investment).
- **Determinism:** seedable RNG — (trainer, seed, model) always drafts the same team.
- **Output:** `TeamSpec` (consumed by the Battle Bridge).

## Decision Brain internals

For each legal action, compute a score:
- **Move:** expected damage & KO chance (`@smogon/calc`), type effectiveness,
  status/hazard value; on Hard, subtract **self-risk** from the opponent's predicted
  best retaliation (the shallow lookahead).
- **Switch:** matchup improvement if the active mon is outclassed.
- Apply **personality weights**, bias by **predicted player move**
  (`predictionWeight`, confidence-gated), then let **`randomness`** perturb the final
  pick. Output one `Action`.
- **Omniscient:** the brain may see the player's team and HP (legitimate for PvE and
  the main reason a pure heuristic can be strong without deep search).
- All randomness behind an **injectable seed**.

## Test strategy (headless, deterministic, no graphics)

- **Type sense:** picks the super-effective move when available.
- **KO sense:** picks the lethal move over a stronger-but-non-lethal one.
- **Switch sense:** Hard switches out of a hopeless matchup; Easy often doesn't.
- **Difficulty gradient:** over N games through the real Battle Bridge, Hard beats
  Easy head-to-head clearly more than 50% of the time.
- **Gradual reputation:** `predictionWeight`/acting-on-tendencies stays ~0 after a few
  battles, rises only after many (assert the guardrail).
- **Team-switcher:** erratic-roster behavior keeps specific-counter confidence low and
  makes the Composer draft balanced (not countered).
- **Composer constraint:** every mon drafted for a typed gym includes that type.
- **Determinism:** same seed + inputs → same team and same action choices.

## Dependencies / open implementation questions (resolve at planning time)

- Add `@smogon/calc` (verify it interoperates with the installed Showdown dex/gens).
- Exact moveset-assignment heuristic per tier (coverage selection from learnset).
- Precise tendency formulas, learning rates, confidence thresholds, and the
  reputation-level cutoffs (tunable constants; pick sensible defaults, refine by
  playtest).
- Player-model persistence format (JSON shape embedded in the save).
```
