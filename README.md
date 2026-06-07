# Convergence Region

A private experiment: a playable Pokémon-style RPG with a new region, built on the
[Pokémon Showdown](https://github.com/smogon/pokemon-showdown) battle engine (used
only for battle resolution). See `docs/superpowers/specs/` for the design and
`docs/superpowers/plans/` for implementation plans.

## Battle Bridge (sub-project 1 — complete)

A headless, typed wrapper over Showdown's engine. No graphics, no AI — pure logic.

```ts
import { BattleBridge } from './src/bridge/battle-bridge';
import { PIKACHU_TEAM, GYARADOS_TEAM } from './src/bridge/test-teams';

const bridge = new BattleBridge();
await bridge.startBattle(PIKACHU_TEAM, GYARADOS_TEAM, { formatid: 'gen9customgame' });

while (bridge.state.winner === undefined) {
  const { events } = await bridge.submitTurn(
    { kind: 'move', index: 1 },
    { kind: 'move', index: 1 },
  );
  console.log(events);
}
console.log('Winner:', bridge.state.winner);
```

Wild battle + catching (catching is synthetic — Showdown has no Poké Balls):

```ts
await bridge.startBattle(playerTeam, wildTeam, { formatid: 'gen9customgame', isWild: true });
const result = bridge.attemptCatch('ultra'); // { caught, shakes }
```

### How it works

- Drives Showdown via `getPlayerStreams(stream)` → `{ omniscient, p1, p2 }`.
- Background loops consume each side's `|request|` (auto-resolving `teamPreview`/
  `wait`) and the public battle log; `submitTurn` resolves on the next `|turn|`/`|win|`.
- Catch-rate data is bundled in `src/data/catch-rates.ts` because Showdown's species
  data has no catch rate (it's a competitive sim).

## AI Brain (sub-project 2a — decision core)

```ts
import { chooseAction } from './src/ai/decision-brain';
import { buildView } from './src/ai/view-from-bridge';
import { makeRng } from './src/ai/rng';

const ctx = {
  gen: 9,
  knobs: { randomness: 0, lookaheadDepth: 1, switchSmarts: 1 }, // "Hard"
  personality: { aggression: 1, caution: 1 },
  rng: makeRng(Date.now()),
};
const view = buildView('p2', bridge.state, aiTeam, playerTeam, bridge.getChoices('p2').moves, []);
const action = chooseAction(view, ctx); // -> feed to bridge.submitTurn
```

Difficulty = knob values (randomness / lookaheadDepth / switchSmarts) via a
`@smogon/calc` damage model; personality = weights. Learning/adaptation (player
model) and team drafting arrive in plans 2b and 2c.

## AI Brain (sub-project 2b — adaptation)

```ts
import { createPlayerModel } from './src/ai/player-model';
import { observeBattle } from './src/ai/observer';
import { computeSettings } from './src/ai/difficulty-controller';

let model = createPlayerModel();             // persisted in the save
model = observeBattle(model, battleSummary); // after each battle (only writer)

const settings = computeSettings({
  baseTier: 'hard', advancedToggle: false,
  autoScale: 0,                                  // smoothed recent performance (-1..+1)
  reputationRamp: model.reputation.score / 40,   // 0..1, earned over time
});
// settings -> Knobs for the decision brain; predictionWeight/counterDraftStrength
// are gated to ~0 until the player has earned a reputation (the immersion guardrail).
```

## AI Brain (sub-project 2c — team composer)

```ts
import { composeTeam } from './src/ai/team-composer';
import { makeRng } from './src/ai/rng';

const gymTeam = composeTeam(
  { baseTier: 'hard', teamSize: 6, levelCap: 50, gymType: 'Steel' },
  { gen: 9, counterDraftStrength: 0.7, rng: makeRng(seed) },
); // -> TeamSpec for the Battle Bridge
```

Every drafted mon's typing includes the gym type (dual-types allowed); movesets come
from real legal movepools, tier-scaled; `counterDraftStrength` (from the difficulty
controller) biases toward stronger mons. Deterministic under a seed.

## Game State (sub-project 3a — core + save)

```ts
import { createNewGame, addToParty } from './src/game/game-state';
import { createOwned } from './src/game/owned-pokemon';
import { serialize, deserialize, InMemorySaveStore } from './src/game/save';
import { ownedToSet } from './src/game/projection';

let game = createNewGame({ difficultyMode: 'hard', nuzlocke: false });
game = addToParty(game, createOwned({ species: 'Pikachu', level: 5, moves: ['thunderbolt'] }));

const store = new InMemorySaveStore();
await store.save('slot1', serialize(game));       // persist
const loaded = deserialize((await store.load('slot1'))!);

const battleTeam = loaded.party.map(ownedToSet);  // -> Battle Bridge
```

Full-fidelity owned Pokémon (stats validated vs `@smogon/calc`); HP/status persist
between battles; save policy is anywhere (normal/hard) or Centers-only (hardest);
Nuzlocke is an independent toggle enforced via `rules.ts` hooks.

## Economy (sub-project 3b)

```ts
import { applyItem } from './src/game/items/effects';
import { buyItem } from './src/game/shop';
import { healParty } from './src/game/center';

let r = buyItem(game, mart, 'ultraball', 5);   // shop
r = { state: healParty(r.state), result: { ok: true } }; // Pokémon Center
const used = applyItem(r.state, 'thunderstone', pikachuUid); // evolves -> Raichu
```

Full item roster with a data-driven effect engine; evolution (level + stone) and TM
teaching from Showdown data; shops with badge-gated stock + difficulty pricing.
Repel/Escape-Rope set state flags the overworld will honor (sub-project 4).

## Rewards & Leveling (sub-project 3c)

```ts
import { applyBattleResult } from './src/game/battle-result';

const fc = bridge.finalConditions();           // read end HP/status from the battle
const { state, summary } = applyBattleResult(game, {
  won: bridge.state.winner === 'p1',
  finalConditions: myParty.map((m, i) => ({ uid: m.uid, hpPercent: fc.p1[i].hpPercent, status: fc.p1[i].status })),
  defeatedTeam, participantUids, isWild: false, trainer, rng,
});
// summary: { expGained, levelUps (moves/evolution to resolve), money, items }
```

EXP scales to the opponent (Gen-5 formula); Exp Share is difficulty-dependent;
level-ups surface move-learn/evolution decisions; HP/status persist in and out of
battle via the Bridge's `initialConditions` / `finalConditions`.

## Time & Rematch (sub-project 3d)

```ts
import { advanceStep, currentDay, timeOfDay } from './src/game/clock';
import { recordTrainerDefeat, listReadyRematches, rematchLevelCap } from './src/game/rematch';

game = advanceStep(game);                       // overworld step advances the clock
game = recordTrainerDefeat(game, 'gymSteel');   // on a won trainer battle (1-day cooldown)
const ready = listReadyRematches(game);         // Vs-Seeker list, after the cooldown
const cap = rematchLevelCap(game);              // -> Team Composer levelCap for the rematch
```

Deterministic step-based clock with a `timeOfDay` hook for day/night encounters;
player-initiated rematches scale to progress (capped at 75).

## Region Content (sub-project 4b — full 8-badge region)

The complete main path of The Mosaic: 8 type-locked gyms (Verdant Hollow → Shadowmere,
caps 12→52), connecting routes with biome-appropriate encounter tables (the Convergence
Tide), trainers, shops, and NPCs — 18 locations in one connected map. Factual species
data (catch/exp/growth/EV for all 1025 species) is generated from PokéAPI by
`scripts/gen-data.mjs`; region content is validated by `region-integrity.test.ts`.
Elite Four / Champion / story climax are sub-project 4c.

## Commands

```bash
npm test        # run the full vitest suite
npm run typecheck
```
