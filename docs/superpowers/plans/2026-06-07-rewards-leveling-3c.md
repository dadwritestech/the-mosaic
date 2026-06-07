# Rewards & Leveling 3c Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a finished battle into growth — EXP gain + level-ups (move-learning, evolution), opponent-scaled money/item rewards, and HP/status persistence into and out of battles.

**Architecture:** Pure TS reward/leveling modules over 3a/3b, plus a Battle Bridge extension that injects/reads current HP & status via the sim's internal `stream.battle.sides[].pokemon[]` (probed working). `applyBattleResult` is the orchestrator that writes back HP, distributes EXP, and adds rewards.

**Tech Stack:** TypeScript, `pokemon-showdown` (learnset + internal battle), 3a/3b `src/game/*`, the Battle Bridge, Vitest.

---

## Verified facts (probed 2026-06-07)

- **HP injection/readout works:** `new BattleStream()` exposes `stream.battle`; after
  start, `stream.battle.sides[sideIdx].pokemon[monIdx]` has `.hp`, `.maxhp`, `.status`
  (string id), `.fainted`, and methods `.sethp(n)` and `.setStatus(id)`. `sethp(half)`
  moved HP 110→55. The Bridge holds the stream as `this.stream`. p1 = side 0, p2 = 1.
- **Learnset level-up tags:** `Dex.species.getLearnsetData(id).learnset` maps moveId →
  tags array; a Gen-9 level-up move is tagged `"9L<level>"` (e.g. Charmander
  `ember:["9L4",...]`, `flamethrower:["9L24"]`).
- EXP check: `expForKO(112, 20, 20, 1) === 449`.

## File Structure

- `src/game/exp-yield.ts` — `baseExpYield(species)` (bundled table; gap).
- `src/game/learnset.ts` — `levelUpMovesAt`, `levelUpMovesBetween`.
- `src/game/leveling.ts` — `expForKO`, `distributeExp`, `applyExpGain`.
- `src/game/rewards.ts` — `moneyMod`, `computeRewards`.
- `src/bridge/battle-bridge.ts` — extend: `initialConditions` inject + `finalConditions()`.
- `src/game/battle-result.ts` — `applyBattleResult`.
- Tests alongside + `src/game/battle-result-integration.test.ts`.

---

### Task 1: Base exp-yield table

**Files:** Create `src/game/exp-yield.ts`, `src/game/exp-yield.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { baseExpYield } from './exp-yield';

describe('baseExpYield', () => {
  it('returns seeded values and a sane default', () => {
    expect(baseExpYield('Pikachu')).toBe(112);
    expect(baseExpYield('Charizard')).toBe(267);
    expect(baseExpYield('SomethingUnknown')).toBe(100); // default
  });
  it('is case-insensitive', () => {
    expect(baseExpYield('pikachu')).toBe(112);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/exp-yield.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `exp-yield.ts`**

```ts
// Base experience yield (Showdown has no baseExp). Seeded core; full table is later bulk.
const EXP_YIELD: Record<string, number> = {
  pikachu: 112, raichu: 218, caterpie: 39, magikarp: 40, gyarados: 189,
  charmander: 62, charmeleon: 142, charizard: 267, snorlax: 189,
  bulbasaur: 64, squirtle: 63, eevee: 65, vaporeon: 184,
};

export function baseExpYield(species: string): number {
  return EXP_YIELD[species.toLowerCase()] ?? 100;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/game/exp-yield.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/exp-yield.ts src/game/exp-yield.test.ts
git commit -m "feat(game): base exp-yield table (seeded)"
```

---

### Task 2: Learnset level-up moves

**Files:** Create `src/game/learnset.ts`, `src/game/learnset.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { levelUpMovesAt, levelUpMovesBetween } from './learnset';

describe('learnset', () => {
  it('finds the moves a species learns at a given level', () => {
    expect(levelUpMovesAt('Charmander', 4)).toContain('ember');
    expect(levelUpMovesAt('Charmander', 24)).toContain('flamethrower');
    expect(levelUpMovesAt('Charmander', 999)).toEqual([]);
  });
  it('collects moves across a level range (from, to]', () => {
    const moves = levelUpMovesBetween('Charmander', 3, 24);
    expect(moves.some((m) => m.moveId === 'ember' && m.level === 4)).toBe(true);
    expect(moves.some((m) => m.moveId === 'flamethrower' && m.level === 24)).toBe(true);
    // a move learned at exactly `from` is excluded:
    expect(levelUpMovesBetween('Charmander', 4, 24).some((m) => m.moveId === 'ember')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/learnset.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `learnset.ts`**

```ts
import * as Sim from 'pokemon-showdown';

function rawLearnset(species: string): Record<string, string[]> {
  const dex = (Sim.Dex as any).forGen(9);
  const id = dex.species.get(species).id;
  return dex.species.getLearnsetData(id)?.learnset ?? {};
}

/** Moves a species learns by level-up at exactly `level` (Gen 9 `9L<level>` tags). */
export function levelUpMovesAt(species: string, level: number): string[] {
  const ls = rawLearnset(species);
  const out: string[] = [];
  for (const [moveId, tags] of Object.entries(ls)) {
    if (tags.some((t) => t === `9L${level}`)) out.push(moveId);
  }
  return out;
}

export function levelUpMovesBetween(species: string, from: number, to: number): { level: number; moveId: string }[] {
  const out: { level: number; moveId: string }[] = [];
  for (let l = from + 1; l <= to; l++) for (const moveId of levelUpMovesAt(species, l)) out.push({ level: l, moveId });
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/game/learnset.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/learnset.ts src/game/learnset.test.ts
git commit -m "feat(game): level-up move lookup from Showdown learnsets"
```

---

### Task 3: EXP formula, distribution, and level-up application

**Files:** Create `src/game/leveling.ts`, `src/game/leveling.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { expForKO, distributeExp, applyExpGain } from './leveling';
import { createOwned } from './owned-pokemon';

describe('leveling', () => {
  it('expForKO matches the Gen-5 scaled formula', () => {
    expect(expForKO(112, 20, 20, 1)).toBe(449);
  });
  it('an over-leveled winner earns less from the same KO', () => {
    expect(expForKO(112, 20, 40, 1)).toBeLessThan(expForKO(112, 20, 20, 1));
  });

  it('distributeExp: bench gets a partial share on normal, zero on hard', () => {
    const a = createOwned({ species: 'Pikachu', level: 20 });
    const b = createOwned({ species: 'Bulbasaur', level: 20 });
    const defeated = [{ species: 'Pikachu', level: 20 }];
    const normal = distributeExp([a, b], { defeatedTeam: defeated, participantUids: [a.uid], mode: 'normal' });
    expect(normal.get(a.uid)!).toBeGreaterThan(0);
    expect(normal.get(b.uid)!).toBeGreaterThan(0);
    expect(normal.get(b.uid)!).toBeLessThan(normal.get(a.uid)!); // bench gets less
    const hard = distributeExp([a, b], { defeatedTeam: defeated, participantUids: [a.uid], mode: 'hard' });
    expect(hard.get(b.uid)!).toBe(0); // bench gets nothing on hard
  });

  it('applyExpGain levels up and surfaces evolution at the evo level', () => {
    const charm = createOwned({ species: 'Charmander', level: 15, moves: ['scratch', 'growl', 'ember', 'smokescreen'] });
    // enough exp to reach level 16 (mediumslow)
    const res = applyExpGain(charm, 100000);
    expect(res.levelsGained).toBeGreaterThan(0);
    expect(res.evolutionInto).toBe('Charmeleon');
  });

  it('applyExpGain auto-learns into a free slot but queues when the moveset is full', () => {
    const free = createOwned({ species: 'Charmander', level: 3, moves: ['scratch'] });
    const r1 = applyExpGain(free, 1000); // crosses L4 -> learns ember into a free slot
    expect(r1.mon.moves.some((m) => m.id === 'ember')).toBe(true);
    const full = createOwned({ species: 'Charmander', level: 3, moves: ['scratch', 'growl', 'tackle', 'leer'] });
    const r2 = applyExpGain(full, 1000);
    expect(r2.movesToLearn.some((m) => m.moveId === 'ember')).toBe(true); // queued, not forced
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/leveling.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `leveling.ts`**

```ts
import * as Sim from 'pokemon-showdown';
import type { OwnedPokemon } from './types';
import { gainExp } from './owned-pokemon';
import { baseExpYield } from './exp-yield';
import { levelUpMovesBetween } from './learnset';
import { evolutionFor } from './evolution';

/** Gen-5 scaled experience for one KO. */
export function expForKO(baseExp: number, defeatedLevel: number, winnerLevel: number, participants: number): number {
  const Lo = defeatedLevel, Lp = winnerLevel, s = Math.max(1, participants);
  const ratio = Math.pow((2 * Lo + 10) / (Lo + Lp + 10), 2.5);
  return Math.floor(((baseExp * Lo) / 5) * (1 / s) * ratio + 1);
}

export interface DistributeContext {
  defeatedTeam: { species: string; level: number }[];
  participantUids: string[];
  mode: 'normal' | 'hard' | 'hardest';
}

/** EXP each party member earns. Bench: 50% on normal, 0 on hard/hardest. */
export function distributeExp(party: OwnedPokemon[], ctx: DistributeContext): Map<string, number> {
  const s = ctx.participantUids.length || 1;
  const out = new Map<string, number>();
  for (const mon of party) {
    const isPart = ctx.participantUids.includes(mon.uid);
    const factor = isPart ? 1 : ctx.mode === 'normal' ? 0.5 : 0;
    let total = 0;
    if (factor > 0) {
      for (const d of ctx.defeatedTeam) {
        total += Math.floor(expForKO(baseExpYield(d.species), d.level, mon.level, s) * factor);
      }
    }
    out.set(mon.uid, total);
  }
  return out;
}

export interface LevelUpResult {
  mon: OwnedPokemon;
  levelsGained: number;
  movesToLearn: { level: number; moveId: string }[];
  evolutionInto: string | null;
}

export function applyExpGain(mon: OwnedPokemon, amount: number): LevelUpResult {
  const beforeLevel = mon.level;
  let after = gainExp(mon, amount);
  const levelsGained = after.level - beforeLevel;

  const candidates = levelsGained > 0 ? levelUpMovesBetween(after.species, beforeLevel, after.level) : [];
  const movesToLearn: { level: number; moveId: string }[] = [];
  let moves = after.moves.slice();
  for (const cand of candidates) {
    if (moves.some((m) => m.id === cand.moveId)) continue;
    if (moves.length < 4) {
      const base = (Sim.Dex as any).forGen(9).moves.get(cand.moveId);
      moves.push({ id: cand.moveId, pp: base.pp ?? 5, ppUps: 0 }); // auto-learn
    } else {
      movesToLearn.push(cand); // queue the decision
    }
  }
  after = { ...after, moves };

  const evolutionInto = levelsGained > 0 ? evolutionFor(after, { kind: 'level' }) : null;
  return { mon: after, levelsGained, movesToLearn, evolutionInto };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/game/leveling.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/leveling.ts src/game/leveling.test.ts
git commit -m "feat(game): exp formula, distribution, level-up application"
```

---

### Task 4: Battle rewards

**Files:** Create `src/game/rewards.ts`, `src/game/rewards.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { computeRewards, moneyMod } from './rewards';
import { makeRng } from '../ai/rng';

describe('rewards', () => {
  it('trainer money = basePayout * highestLevel * moneyMod', () => {
    const r = computeRewards({ isWild: false, trainer: { basePayout: 50, tier: 'hard' }, opponentLevels: [10, 20], mode: 'normal', rng: makeRng(1) });
    expect(r.money).toBe(1000); // 50 * 20 * 1.0
  });
  it('harder modes pay less', () => {
    const hard = computeRewards({ isWild: false, trainer: { basePayout: 50, tier: 'hard' }, opponentLevels: [20], mode: 'hard', rng: makeRng(1) });
    expect(hard.money).toBe(900); // 50*20*0.9
  });
  it('wild battles pay no money', () => {
    expect(computeRewards({ isWild: true, opponentLevels: [20], mode: 'normal', rng: makeRng(1) }).money).toBe(0);
  });
  it('rolls drops from a trainer drop table deterministically', () => {
    const ctx = { isWild: false, trainer: { basePayout: 10, tier: 'hard', dropTable: [{ itemId: 'potion', chance: 1 }, { itemId: 'ultraball', chance: 0 }] }, opponentLevels: [20], mode: 'normal' as const, rng: makeRng(1) };
    const r = computeRewards(ctx);
    expect(r.items).toContain('potion');     // chance 1 always drops
    expect(r.items).not.toContain('ultraball'); // chance 0 never
  });
  it('moneyMod ordering', () => {
    expect(moneyMod('normal')).toBeGreaterThan(moneyMod('hardest'));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/rewards.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `rewards.ts`**

```ts
export type DifficultyMode = 'normal' | 'hard' | 'hardest';

export function moneyMod(mode: DifficultyMode): number {
  if (mode === 'hard') return 0.9;
  if (mode === 'hardest') return 0.8;
  return 1.0;
}

export interface TrainerReward {
  basePayout: number; tier: string;
  dropTable?: { itemId: string; chance: number }[];
}
export interface RewardContext {
  isWild: boolean;
  trainer?: TrainerReward;
  opponentLevels: number[];
  mode: DifficultyMode;
  rng: () => number;
}

export function computeRewards(ctx: RewardContext): { money: number; items: string[] } {
  let money = 0;
  if (!ctx.isWild && ctx.trainer) {
    const highest = Math.max(...ctx.opponentLevels);
    money = Math.floor(ctx.trainer.basePayout * highest * moneyMod(ctx.mode));
  }
  const items: string[] = [];
  for (const drop of ctx.trainer?.dropTable ?? []) {
    if (ctx.rng() < drop.chance) items.push(drop.itemId);
  }
  return { money, items };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/game/rewards.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/rewards.ts src/game/rewards.test.ts
git commit -m "feat(game): battle rewards (opponent-scaled money + drop roller)"
```

---

### Task 5: Battle Bridge HP injection + readout

**Files:** Modify `src/bridge/battle-bridge.ts`; Test `src/bridge/battle-conditions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { BattleBridge } from './battle-bridge';
import { PIKACHU_TEAM, GYARADOS_TEAM } from './test-teams';

describe('BattleBridge HP conditions', () => {
  it('injects starting HP/status and reads final conditions', async () => {
    const bridge = new BattleBridge();
    await bridge.startBattle(PIKACHU_TEAM, GYARADOS_TEAM, {
      formatid: 'gen9customgame',
      initialConditions: { p1: [{ hpPercent: 50, status: 'par' }], p2: [{ hpPercent: 100, status: '' }] },
    });
    const fc = bridge.finalConditions();
    expect(fc.p1[0].hpPercent).toBeLessThanOrEqual(55); // injected ~50%
    expect(fc.p1[0].hpPercent).toBeGreaterThanOrEqual(45);
    expect(fc.p1[0].status).toBe('par');
    expect(fc.p2[0].hpPercent).toBe(100);
  });

  it('finalConditions reports a fainted mon after a battle ends', async () => {
    const bridge = new BattleBridge();
    await bridge.startBattle(PIKACHU_TEAM, GYARADOS_TEAM, { formatid: 'gen9customgame' });
    let guard = 0;
    while (bridge.state.winner === undefined && guard++ < 200) await bridge.submitTurn({ kind: 'move', index: 1 }, { kind: 'move', index: 1 });
    const fc = bridge.finalConditions();
    const someoneFainted = [...fc.p1, ...fc.p2].some((m) => m.fainted);
    expect(someoneFainted).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/bridge/battle-conditions.test.ts`
Expected: FAIL — `initialConditions`/`finalConditions` not implemented.

- [ ] **Step 3: Extend `battle-bridge.ts`**

In `src/bridge/types.ts`, add to `BattleOpts`:
```ts
  initialConditions?: { p1?: MonCondition[]; p2?: MonCondition[] };
```
and add these exported types to `src/bridge/types.ts`:
```ts
export interface MonCondition { hpPercent: number; status: string; }
export interface MonReadout { species: string; hpPercent: number; status: string; fainted: boolean; }
```

In `battle-bridge.ts`, at the END of `startBattle` (after `await this.waitForTurnBoundary();` and before `return this._state;`), inject conditions:
```ts
    this.injectConditions(opts.initialConditions);
```
Add these methods to the class:
```ts
  private injectConditions(conds?: { p1?: import('./types').MonCondition[]; p2?: import('./types').MonCondition[] }): void {
    if (!conds) return;
    const battle = (this.stream as any).battle;
    if (!battle) return;
    const apply = (sideIdx: number, list?: import('./types').MonCondition[]) => {
      if (!list) return;
      const mons = battle.sides[sideIdx].pokemon;
      list.forEach((c, i) => {
        const p = mons[i]; if (!p) return;
        if (typeof c.hpPercent === 'number') p.sethp(Math.max(1, Math.round((c.hpPercent / 100) * p.maxhp)));
        if (c.status) p.setStatus(c.status);
      });
    };
    apply(0, conds.p1); apply(1, conds.p2);
  }

  finalConditions(): { p1: import('./types').MonReadout[]; p2: import('./types').MonReadout[] } {
    const battle = (this.stream as any).battle;
    const read = (sideIdx: number): import('./types').MonReadout[] => {
      if (!battle) return [];
      return battle.sides[sideIdx].pokemon.map((p: any) => ({
        species: p.species?.name ?? p.name,
        hpPercent: p.maxhp ? Math.round((p.hp / p.maxhp) * 100) : 0,
        status: p.status ?? '',
        fainted: !!p.fainted,
      }));
    };
    return { p1: read(0), p2: read(1) };
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/bridge/battle-conditions.test.ts`
Expected: PASS. If `setStatus` rejects an already-asleep/typed-immune case, the
injected status simply won't stick for that mon — keep the test species (Pikachu can
be paralyzed) as written.

- [ ] **Step 5: Commit**

```bash
git add src/bridge/battle-bridge.ts src/bridge/types.ts src/bridge/battle-conditions.test.ts
git commit -m "feat(bridge): inject starting HP/status + read final conditions"
```

---

### Task 6: applyBattleResult orchestrator

**Files:** Create `src/game/battle-result.ts`, `src/game/battle-result.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { applyBattleResult } from './battle-result';
import { createNewGame, addToParty } from './game-state';
import { createOwned } from './owned-pokemon';
import { makeRng } from '../ai/rng';

describe('applyBattleResult', () => {
  it('persists final HP/status onto party mons', () => {
    const mon = createOwned({ species: 'Pikachu', level: 20 });
    let g = addToParty(createNewGame({ difficultyMode: 'normal', nuzlocke: false }), mon);
    const out = applyBattleResult(g, {
      won: true,
      finalConditions: [{ uid: mon.uid, hpPercent: 30, status: 'brn' }],
      defeatedTeam: [{ species: 'Caterpie', level: 18 }],
      participantUids: [mon.uid],
      isWild: true,
      rng: makeRng(1),
    });
    expect(out.state.party[0].status).toBe('brn');
    expect(out.state.party[0].currentHp).toBeLessThan(require('./stats').maxHp(out.state.party[0]));
    expect(out.summary.expGained.get(mon.uid)!).toBeGreaterThan(0);
  });

  it('awards trainer money and respects no-reward on loss', () => {
    const mon = createOwned({ species: 'Pikachu', level: 20 });
    let g = addToParty(createNewGame({ difficultyMode: 'normal', nuzlocke: false }), mon);
    const won = applyBattleResult(g, {
      won: true, finalConditions: [{ uid: mon.uid, hpPercent: 100, status: '' }],
      defeatedTeam: [{ species: 'Caterpie', level: 18 }], participantUids: [mon.uid],
      isWild: false, trainer: { basePayout: 50, tier: 'normal' }, rng: makeRng(1),
    });
    expect(won.state.money).toBe(50 * 18); // basePayout * highest level * 1.0
    const lost = applyBattleResult(g, {
      won: false, finalConditions: [{ uid: mon.uid, hpPercent: 0, status: '' }],
      defeatedTeam: [], participantUids: [mon.uid], isWild: false,
      trainer: { basePayout: 50, tier: 'normal' }, rng: makeRng(1),
    });
    expect(lost.state.money).toBe(0); // no reward on loss
  });

  it('routes a Nuzlocke faint to the graveyard', () => {
    const mon = createOwned({ species: 'Caterpie', level: 10 });
    let g = addToParty(createNewGame({ difficultyMode: 'normal', nuzlocke: true }), mon);
    const out = applyBattleResult(g, {
      won: false, finalConditions: [{ uid: mon.uid, hpPercent: 0, status: '' }],
      defeatedTeam: [], participantUids: [mon.uid], isWild: true, rng: makeRng(1),
    });
    expect(out.state.party.length).toBe(0);
    expect(out.state.graveyard.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/battle-result.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `battle-result.ts`**

```ts
import type { GameState } from './types';
import { setHp } from './owned-pokemon';
import { maxHp } from './stats';
import { applyFaintConsequences } from './rules';
import { distributeExp, applyExpGain, type LevelUpResult } from './leveling';
import { computeRewards } from './rewards';
import { addMoney, addItem } from './game-state';
import { getItem } from './items/catalog';

export interface BattleOutcome {
  won: boolean;
  finalConditions: { uid: string; hpPercent: number; status: string }[];
  defeatedTeam: { species: string; level: number }[];
  participantUids: string[];
  isWild: boolean;
  trainer?: { basePayout: number; tier: string; dropTable?: { itemId: string; chance: number }[] };
  rng: () => number;
}

export interface BattleSummary {
  expGained: Map<string, number>;
  levelUps: { uid: string; levelsGained: number; movesToLearn: LevelUpResult['movesToLearn']; evolutionInto: string | null }[];
  money: number;
  items: string[];
}

export function applyBattleResult(state: GameState, outcome: BattleOutcome): { state: GameState; summary: BattleSummary } {
  // 1. Write back HP/status onto party mons.
  let party = state.party.map((mon) => {
    const fc = outcome.finalConditions.find((c) => c.uid === mon.uid);
    if (!fc) return mon;
    const healed = setHp({ ...mon, status: fc.status }, Math.round((fc.hpPercent / 100) * maxHp(mon)));
    return healed;
  });
  let s: GameState = { ...state, party };

  // 2. EXP + level-ups (only on a win).
  const expGained = new Map<string, number>();
  const levelUps: BattleSummary['levelUps'] = [];
  if (outcome.won) {
    const dist = distributeExp(s.party, { defeatedTeam: outcome.defeatedTeam, participantUids: outcome.participantUids, mode: s.settings.difficultyMode });
    party = s.party.map((mon) => {
      const amt = dist.get(mon.uid) ?? 0;
      expGained.set(mon.uid, amt);
      if (amt <= 0) return mon;
      const r = applyExpGain(mon, amt);
      if (r.levelsGained > 0 || r.evolutionInto) levelUps.push({ uid: mon.uid, levelsGained: r.levelsGained, movesToLearn: r.movesToLearn, evolutionInto: r.evolutionInto });
      return r.mon;
    });
    s = { ...s, party };
  }

  // 3. Nuzlocke permadeath on fainted party mons.
  s = applyFaintConsequences(s);

  // 4. Rewards (only on a win).
  let money = 0, items: string[] = [];
  if (outcome.won) {
    const rewards = computeRewards({ isWild: outcome.isWild, trainer: outcome.trainer, opponentLevels: outcome.defeatedTeam.map((d) => d.level), mode: s.settings.difficultyMode, rng: outcome.rng });
    money = rewards.money; items = rewards.items;
    s = addMoney(s, money);
    for (const itemId of items) s = addItem(s, getItem(itemId).pocket, itemId, 1);
  }

  return { state: s, summary: { expGained, levelUps, money, items } };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/game/battle-result.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/battle-result.ts src/game/battle-result.test.ts
git commit -m "feat(game): applyBattleResult — writeback + exp + rewards orchestrator"
```

---

### Task 7: Integration + full suite + wrap

**Files:** Create `src/game/battle-result-integration.test.ts`; Modify `README.md`

- [ ] **Step 1: Write the integration test**

```ts
import { describe, it, expect } from 'vitest';
import { BattleBridge } from '../bridge/battle-bridge';
import { createOwned } from './owned-pokemon';
import { ownedToSet } from './projection';
import { applyBattleResult } from './battle-result';
import { createNewGame, addToParty } from './game-state';
import { makeRng } from '../ai/rng';

describe('full battle -> result loop', () => {
  it('owned teams battle, then result writeback grants EXP to the winner', async () => {
    const mine = createOwned({ species: 'Pikachu', level: 30, moves: ['thunderbolt', 'quickattack', 'irontail', 'thunderwave'], nature: 'Timid' });
    const foe = createOwned({ species: 'Magikarp', level: 12, moves: ['splash', 'tackle'] });
    let g = addToParty(createNewGame({ difficultyMode: 'normal', nuzlocke: false }), mine);

    const bridge = new BattleBridge();
    await bridge.startBattle([ownedToSet(mine)], [ownedToSet(foe)], { formatid: 'gen9customgame' });
    let guard = 0;
    while (bridge.state.winner === undefined && guard++ < 200) await bridge.submitTurn({ kind: 'move', index: 1 }, { kind: 'move', index: 1 });

    const fc = bridge.finalConditions();
    const out = applyBattleResult(g, {
      won: bridge.state.winner === 'p1',
      finalConditions: [{ uid: mine.uid, hpPercent: fc.p1[0].hpPercent, status: fc.p1[0].status }],
      defeatedTeam: [{ species: 'Magikarp', level: 12 }],
      participantUids: [mine.uid], isWild: true, rng: makeRng(1),
    });
    // Pikachu should beat a L12 Magikarp; winner gains exp.
    expect(out.summary.expGained.get(mine.uid)!).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the integration test**

Run: `npx vitest run src/game/battle-result-integration.test.ts`
Expected: PASS.

- [ ] **Step 3: Full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: ALL pass; no type errors.

- [ ] **Step 4: Append to `README.md`**

````markdown
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
````

- [ ] **Step 5: Commit**

```bash
git add src/game/battle-result-integration.test.ts README.md
git commit -m "test(game): full battle->result loop; docs for 3c"
```

---

## Self-Review notes

- **Spec coverage:** exp-yield table (T1); learnset level moves (T2); EXP formula +
  difficulty distribution + level-up surfacing (T3); opponent-scaled money + drop
  roller (T4); HP inject/readout Bridge extension (T5); writeback + Nuzlocke + rewards
  orchestrator (T6); full-loop integration (T7). Persisted-HP resolved as option A
  (injection works) — fallback unneeded.
- **Verified-API risks settled:** `stream.battle.sides[].pokemon[].sethp/setStatus/hp/
  maxhp/status/fainted`; learnset `9L<level>` tags; `expForKO(112,20,20,1)===449`.
- **Deferred (not placeholders):** trainer `basePayout`/`dropTable` *content* (Region
  Content, 4); full exp-yield tail (bulk); UI resolution of `summary.levelUps`.
- **Type consistency:** `LevelUpResult`/`DistributeContext` from `leveling.ts`;
  `MonCondition`/`MonReadout` added to `bridge/types.ts`; `BattleOutcome`/`BattleSummary`
  from `battle-result.ts`; reuses 3a `setHp`/`maxHp`/`addMoney`/`addItem`, 3b `getItem`/
  `evolutionFor`.
```
