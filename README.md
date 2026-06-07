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

## Commands

```bash
npm test        # run the full vitest suite
npm run typecheck
```
