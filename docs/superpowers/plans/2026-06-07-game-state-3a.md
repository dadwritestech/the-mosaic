# Game State 3a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the persistent, full-fidelity `GameState` — owned-Pokémon model with real stat/exp math, containers (party/box/bag/etc.), the `ownedToSet` projection into the Battle Bridge, save/load with validation, and the save-policy + Nuzlocke rule hooks.

**Architecture:** Pure TypeScript modules over Showdown's dex (base stats, abilities, natures). Derived values (stats, Hidden Power, level) are computed, never stored. Stat math is validated against `@smogon/calc` as an oracle. Storage is behind a `SaveStore` interface. No graphics.

**Tech Stack:** TypeScript, `pokemon-showdown` (Dex), `@smogon/calc` (test oracle only), the existing Battle Bridge, Vitest.

---

## Verified facts (probed 2026-06-07)

- `Sim.Dex.forGen(9).species.get(name)` → `.baseStats` (hp/atk/def/spa/spd/spe), `.abilities` ({'0','1'?,'H'?,'S'?}), `.genderRatio` ({M,F}).
- `Sim.Dex.natures.get('Adamant')` → `{ plus:'atk', minus:'spa' }` (natures are in Showdown — no bundled nature table needed).
- **Gaps (bundle our own):** `species.growthRate` and `species.evYield` are `undefined`.
- Oracle: `new (require('@smogon/calc').Pokemon)(gen, name, {level,nature,evs,ivs}).stats` gives final stats (e.g. L78 Adamant Garchomp 252Atk/252Spe/4HP → `{hp:281,atk:309,def:177,spa:137,spd:161,spe:237}`).

## File Structure

- `src/game/types.ts` — `Stats6`, `OwnedPokemon`, `GameState`, `GameSettings`, `Box`.
- `src/game/stats.ts` — `computeStats`, `maxHp`, `hiddenPowerType`.
- `src/game/growth-rates.ts` — 6 growth-group exp curves + seeded species→group table.
- `src/game/owned-pokemon.ts` — `createOwned`, `levelFromExp`, `gainExp`, `healFull`, `setHp`, `restorePp`, `addEvs`.
- `src/game/projection.ts` — `ownedToSet`.
- `src/game/game-state.ts` — `createNewGame` + container ops.
- `src/game/save.ts` — `serialize`/`deserialize`/`validateAndRepair`, `SaveStore`, `InMemorySaveStore`.
- `src/game/rules.ts` — `canSaveHere`, `applyFaintConsequences`, encounter markers.
- Tests alongside each + `src/game/projection-integration.test.ts`.

---

### Task 1: Shared types + stat math (validated against @smogon/calc)

**Files:**
- Create: `src/game/types.ts`, `src/game/stats.ts`
- Test: `src/game/stats.test.ts`

- [ ] **Step 1: Write `types.ts`** (no test; consumed by later tests)

```ts
export interface Stats6 { hp: number; atk: number; def: number; spa: number; spd: number; spe: number; }

export interface OwnedMove { id: string; pp: number; ppUps: number; }

export interface OwnedPokemon {
  uid: string; species: string; nickname?: string;
  level: number; exp: number;
  ivs: Stats6; evs: Stats6; nature: string;
  ability: string; abilitySlot: '0' | '1' | 'H' | 'S';
  gender?: 'M' | 'F' | 'N'; shiny: boolean;
  moves: OwnedMove[];
  heldItem?: string;
  currentHp: number; status: string;
  friendship: number; pokerus: 'none' | 'infected' | 'cured';
  caughtInfo: { ball: string; location: string; metLevel: number; day: number; originalTrainer: string };
}

export interface GameSettings { difficultyMode: 'normal' | 'hard' | 'hardest'; nuzlocke: boolean; }
export interface Box { name: string; slots: (OwnedPokemon | null)[]; }

export interface GameState {
  schemaVersion: number;
  settings: GameSettings;
  party: OwnedPokemon[];
  boxes: Box[];
  bag: Record<string, Record<string, number>>;
  money: number;
  badges: string[];
  pokedex: { seen: Set<number>; caught: Set<number> };
  location: { mapId: string; x: number; y: number; atPokemonCenter: boolean };
  flags: Record<string, unknown>;
  graveyard: OwnedPokemon[];
  time: { day: number; minutes: number };
}
```

- [ ] **Step 2: Write the failing test** `stats.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { computeStats, hiddenPowerType, maxHp } from './stats';
import type { OwnedPokemon } from './types';
import * as calc from '@smogon/calc';

const perfectIvs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
const owned = (over: Partial<OwnedPokemon> = {}): OwnedPokemon => ({
  uid: 'x', species: 'Garchomp', level: 78, exp: 0,
  ivs: perfectIvs, evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
  nature: 'Adamant', ability: 'Rough Skin', abilitySlot: 'H', shiny: false,
  moves: [], currentHp: 1, status: '', friendship: 70, pokerus: 'none',
  caughtInfo: { ball: 'poke', location: 'test', metLevel: 1, day: 0, originalTrainer: 'P' },
  ...over,
});

describe('computeStats', () => {
  it('matches @smogon/calc final stats (the authoritative oracle)', () => {
    const mon = owned();
    const gen = calc.Generations.get(9);
    const oracle = new calc.Pokemon(gen, mon.species, {
      level: mon.level, nature: mon.nature, evs: mon.evs as any, ivs: mon.ivs as any,
    }).stats;
    expect(computeStats(mon)).toEqual({
      hp: oracle.hp, atk: oracle.atk, def: oracle.def, spa: oracle.spa, spd: oracle.spd, spe: oracle.spe,
    });
  });

  it('nature raises the plus stat and lowers the minus stat vs neutral', () => {
    const neutral = computeStats(owned({ nature: 'Hardy' }));
    const adamant = computeStats(owned({ nature: 'Adamant' })); // +Atk -SpA
    expect(adamant.atk).toBeGreaterThan(neutral.atk);
    expect(adamant.spa).toBeLessThan(neutral.spa);
  });

  it('maxHp equals computeStats().hp', () => {
    const mon = owned();
    expect(maxHp(mon)).toBe(computeStats(mon).hp);
  });

  it('hiddenPowerType returns a known type for a known IV spread', () => {
    // all-31 IVs -> Dark (the canonical max-IV Hidden Power type)
    expect(hiddenPowerType(perfectIvs)).toBe('Dark');
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/game/stats.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `stats.ts`**

```ts
import * as Sim from 'pokemon-showdown';
import type { OwnedPokemon, Stats6 } from './types';

function baseStats(species: string): Stats6 {
  return (Sim.Dex as any).forGen(9).species.get(species).baseStats;
}

function natureMod(nature: string, stat: keyof Stats6): number {
  const n = (Sim.Dex as any).natures.get(nature);
  if (n.plus === stat) return 1.1;
  if (n.minus === stat) return 0.9;
  return 1.0;
}

/** Gen 3+ stat formula. HP has its own formula; others apply nature. */
export function computeStats(mon: OwnedPokemon): Stats6 {
  const base = baseStats(mon.species);
  const out = {} as Stats6;
  (['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as (keyof Stats6)[]).forEach((k) => {
    const common = Math.floor((2 * base[k] + mon.ivs[k] + Math.floor(mon.evs[k] / 4)) * mon.level / 100);
    if (k === 'hp') {
      out[k] = mon.species.toLowerCase() === 'shedinja' ? 1 : common + mon.level + 10;
    } else {
      out[k] = Math.floor((common + 5) * natureMod(mon.nature, k));
    }
  });
  return out;
}

export function maxHp(mon: OwnedPokemon): number { return computeStats(mon).hp; }

const HP_TYPES = [
  'Fighting', 'Flying', 'Poison', 'Ground', 'Rock', 'Bug', 'Ghost', 'Steel',
  'Fire', 'Water', 'Grass', 'Electric', 'Psychic', 'Ice', 'Dragon', 'Dark',
];

/** Gen 3-7 Hidden Power type from IVs (bit-0 of HP,Atk,Def,Spe,SpA,SpD). */
export function hiddenPowerType(ivs: Stats6): string {
  const b = (v: number) => v & 1;
  const sum = b(ivs.hp) + 2 * b(ivs.atk) + 4 * b(ivs.def) + 8 * b(ivs.spe) + 16 * b(ivs.spa) + 32 * b(ivs.spd);
  return HP_TYPES[Math.floor((sum * 15) / 63)];
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/game/stats.test.ts && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/game/types.ts src/game/stats.ts src/game/stats.test.ts
git commit -m "feat(game): owned-pokemon types + stat math (validated vs @smogon/calc)"
```

---

### Task 2: Growth rates + exp/level curves

**Files:**
- Create: `src/game/growth-rates.ts`
- Test: `src/game/growth-rates.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { expForLevel, growthRateOf } from './growth-rates';

describe('growth rates', () => {
  it('medium-fast curve is level^3', () => {
    expect(expForLevel(1, 'mediumfast')).toBe(0);
    expect(expForLevel(5, 'mediumfast')).toBe(125);
    expect(expForLevel(100, 'mediumfast')).toBe(1000000);
  });
  it('fast curve is 4/5 * level^3', () => {
    expect(expForLevel(100, 'fast')).toBe(800000);
  });
  it('slow curve is 5/4 * level^3', () => {
    expect(expForLevel(100, 'slow')).toBe(1250000);
  });
  it('exp is non-decreasing across levels for every group', () => {
    for (const g of ['fast', 'mediumfast', 'mediumslow', 'slow', 'erratic', 'fluctuating'] as const) {
      for (let l = 2; l <= 100; l++) expect(expForLevel(l, g)).toBeGreaterThanOrEqual(expForLevel(l - 1, g));
    }
  });
  it('maps seeded species to their group, defaulting to mediumfast', () => {
    expect(growthRateOf('Gyarados')).toBe('slow');
    expect(growthRateOf('Bulbasaur')).toBe('mediumslow');
    expect(growthRateOf('Pikachu')).toBe('mediumfast');
    expect(growthRateOf('SomethingUnknown')).toBe('mediumfast');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/growth-rates.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `growth-rates.ts`**

```ts
export type GrowthGroup = 'fast' | 'mediumfast' | 'mediumslow' | 'slow' | 'erratic' | 'fluctuating';

/** Total experience required to BE at `level` (level 1 = 0). Standard mainline curves. */
export function expForLevel(level: number, group: GrowthGroup): number {
  const n = level;
  if (n <= 1) return 0;
  switch (group) {
    case 'fast': return Math.floor((4 * n ** 3) / 5);
    case 'mediumfast': return n ** 3;
    case 'mediumslow': return Math.floor((6 / 5) * n ** 3 - 15 * n ** 2 + 100 * n - 140);
    case 'slow': return Math.floor((5 * n ** 3) / 4);
    case 'erratic':
      if (n < 50) return Math.floor((n ** 3 * (100 - n)) / 50);
      if (n < 68) return Math.floor((n ** 3 * (150 - n)) / 100);
      if (n < 98) return Math.floor((n ** 3 * Math.floor((1911 - 10 * n) / 3)) / 500);
      return Math.floor((n ** 3 * (160 - n)) / 100);
    case 'fluctuating':
      if (n < 15) return Math.floor((n ** 3 * (Math.floor((n + 1) / 3) + 24)) / 50);
      if (n < 36) return Math.floor((n ** 3 * (n + 14)) / 50);
      return Math.floor((n ** 3 * (Math.floor(n / 2) + 32)) / 50);
  }
}

// Seeded species->group table (the gap Showdown omits). Full National-Dex table is
// bundled later (bulk); these cover tests + early use. Default: mediumfast.
const GROUPS: Record<string, GrowthGroup> = {
  bulbasaur: 'mediumslow', charmander: 'mediumslow', squirtle: 'mediumslow',
  pikachu: 'mediumfast', gyarados: 'slow', magikarp: 'slow', garchomp: 'slow',
  caterpie: 'mediumfast', snorlax: 'slow',
};

export function growthRateOf(species: string): GrowthGroup {
  return GROUPS[species.toLowerCase()] ?? 'mediumfast';
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/game/growth-rates.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/growth-rates.ts src/game/growth-rates.test.ts
git commit -m "feat(game): growth-rate exp curves + seeded species table"
```

---

### Task 3: Owned-Pokémon construction & mutation

**Files:**
- Create: `src/game/owned-pokemon.ts`
- Test: `src/game/owned-pokemon.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { createOwned, levelFromExp, gainExp, healFull, setHp, addEvs } from './owned-pokemon';

describe('owned pokemon', () => {
  it('creates a full-HP mon whose exp matches its starting level', () => {
    const mon = createOwned({ species: 'Pikachu', level: 10 });
    expect(mon.level).toBe(10);
    expect(mon.exp).toBe(1000); // mediumfast: 10^3
    expect(mon.currentHp).toBe(require('./stats').maxHp(mon));
    expect(mon.uid).toBeTruthy();
  });

  it('levelFromExp finds the right level and caps at 100', () => {
    expect(levelFromExp(125, 'mediumfast')).toBe(5);
    expect(levelFromExp(124, 'mediumfast')).toBe(4);
    expect(levelFromExp(9_999_999, 'mediumfast')).toBe(100);
  });

  it('gainExp levels the mon up', () => {
    let mon = createOwned({ species: 'Pikachu', level: 5 }); // exp 125
    mon = gainExp(mon, 875); // -> 1000 = level 10
    expect(mon.level).toBe(10);
  });

  it('addEvs respects the 252 per-stat and 510 total caps', () => {
    let mon = createOwned({ species: 'Pikachu', level: 5 });
    mon = addEvs(mon, { spa: 300 }); // clamps to 252
    expect(mon.evs.spa).toBe(252);
    mon = addEvs(mon, { hp: 252, atk: 252 }); // total would be 756 -> clamp to 510 total
    const total = Object.values(mon.evs).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(510);
  });

  it('healFull restores HP and status; setHp clamps to [0,max]', () => {
    let mon = createOwned({ species: 'Snorlax', level: 50 });
    mon = setHp(mon, -5); expect(mon.currentHp).toBe(0);
    mon = healFull(mon); expect(mon.status).toBe(''); expect(mon.currentHp).toBe(require('./stats').maxHp(mon));
    mon = setHp(mon, 999999); expect(mon.currentHp).toBe(require('./stats').maxHp(mon));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/owned-pokemon.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `owned-pokemon.ts`**

```ts
import * as Sim from 'pokemon-showdown';
import type { OwnedPokemon, Stats6 } from './types';
import { maxHp } from './stats';
import { expForLevel, growthRateOf, type GrowthGroup } from './growth-rates';

let uidCounter = 0;
function newUid(): string { return `mon_${Date.now().toString(36)}_${uidCounter++}`; }

export function levelFromExp(exp: number, group: GrowthGroup): number {
  let level = 1;
  for (let l = 2; l <= 100; l++) { if (expForLevel(l, group) <= exp) level = l; else break; }
  return level;
}

interface CreateOpts {
  species: string; level: number; nickname?: string;
  ivs?: Partial<Stats6>; evs?: Partial<Stats6>; nature?: string;
  ability?: string; abilitySlot?: OwnedPokemon['abilitySlot'];
  gender?: OwnedPokemon['gender']; shiny?: boolean;
  moves?: string[]; heldItem?: string;
}

const ZERO: Stats6 = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
const PERFECT: Stats6 = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

export function createOwned(o: CreateOpts): OwnedPokemon {
  const species = (Sim.Dex as any).forGen(9).species.get(o.species);
  const ability = o.ability ?? species.abilities['0'];
  const mon: OwnedPokemon = {
    uid: newUid(), species: species.name, nickname: o.nickname,
    level: o.level, exp: expForLevel(o.level, growthRateOf(species.name)),
    ivs: { ...PERFECT, ...o.ivs }, evs: { ...ZERO, ...o.evs }, nature: o.nature ?? 'Hardy',
    ability, abilitySlot: o.abilitySlot ?? '0', gender: o.gender, shiny: o.shiny ?? false,
    moves: (o.moves ?? []).slice(0, 4).map((id) => {
      const m = (Sim.Dex as any).forGen(9).moves.get(id);
      return { id, pp: m.pp ?? 1, ppUps: 0 };
    }),
    heldItem: o.heldItem,
    currentHp: 0, status: '', friendship: 70, pokerus: 'none',
    caughtInfo: { ball: 'poke', location: 'unknown', metLevel: o.level, day: 0, originalTrainer: 'Player' },
  };
  mon.currentHp = maxHp(mon);
  return mon;
}

export function gainExp(mon: OwnedPokemon, amount: number): OwnedPokemon {
  const group = growthRateOf(mon.species);
  const exp = Math.min(mon.exp + Math.max(0, amount), expForLevel(100, group));
  return { ...mon, exp, level: levelFromExp(exp, group) };
}

export function setHp(mon: OwnedPokemon, hp: number): OwnedPokemon {
  return { ...mon, currentHp: Math.max(0, Math.min(maxHp(mon), Math.round(hp))) };
}

export function healFull(mon: OwnedPokemon): OwnedPokemon {
  return { ...mon, currentHp: maxHp(mon), status: '', moves: mon.moves.map((m) => ({ ...m })) };
}

export function addEvs(mon: OwnedPokemon, add: Partial<Stats6>): OwnedPokemon {
  const evs = { ...mon.evs };
  for (const k of Object.keys(add) as (keyof Stats6)[]) evs[k] = Math.min(252, evs[k] + (add[k] ?? 0));
  let total = Object.values(evs).reduce((a, b) => a + b, 0);
  if (total > 510) {
    // trim overflow off the stats we just raised, deterministically by stat order.
    for (const k of Object.keys(add) as (keyof Stats6)[]) {
      if (total <= 510) break;
      const cut = Math.min(evs[k], total - 510); evs[k] -= cut; total -= cut;
    }
  }
  return { ...mon, evs };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/game/owned-pokemon.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/owned-pokemon.ts src/game/owned-pokemon.test.ts
git commit -m "feat(game): owned-pokemon create/exp/heal/ev helpers"
```

---

### Task 4: Projection to PokemonSet + Bridge integration

**Files:**
- Create: `src/game/projection.ts`, `src/game/projection-integration.test.ts`
- Test: `src/game/projection.test.ts`

- [ ] **Step 1: Write the failing tests** `projection.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { ownedToSet } from './projection';
import { createOwned } from './owned-pokemon';

describe('ownedToSet', () => {
  it('projects an owned mon into a Battle Bridge PokemonSet', () => {
    const mon = createOwned({ species: 'Pikachu', level: 50, nickname: 'Sparky', moves: ['thunderbolt', 'quickattack'], nature: 'Timid' });
    const set = ownedToSet(mon);
    expect(set.species).toBe('Pikachu');
    expect(set.name).toBe('Sparky');         // nickname carries
    expect(set.level).toBe(50);
    expect(set.moves).toEqual(['thunderbolt', 'quickattack']);
    expect(set.nature).toBe('Timid');
    expect(set.ivs.spa).toBe(31);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/projection.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `projection.ts`**

```ts
import type { PokemonSet } from '../bridge/types';
import type { OwnedPokemon } from './types';

export function ownedToSet(mon: OwnedPokemon): PokemonSet {
  return {
    name: mon.nickname || mon.species,
    species: mon.species,
    ability: mon.ability,
    item: mon.heldItem ?? '',
    moves: mon.moves.map((m) => m.id),
    nature: mon.nature,
    evs: { ...mon.evs },
    ivs: { ...mon.ivs },
    level: mon.level,
    gender: mon.gender,
  };
}
```

- [ ] **Step 4: Write the integration test** `projection-integration.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { BattleBridge } from '../bridge/battle-bridge';
import { createOwned } from './owned-pokemon';
import { ownedToSet } from './projection';

describe('projection -> Battle Bridge', () => {
  it('a team of owned mons projects to a legal team that battles to completion', async () => {
    const p1 = [createOwned({ species: 'Pikachu', level: 50, moves: ['thunderbolt', 'quickattack', 'irontail', 'thunderwave'], nature: 'Timid' })];
    const p2 = [createOwned({ species: 'Gyarados', level: 50, moves: ['waterfall', 'crunch', 'icefang', 'dragondance'] })];

    const bridge = new BattleBridge();
    await bridge.startBattle(p1.map(ownedToSet), p2.map(ownedToSet), { formatid: 'gen9customgame' });
    let guard = 0;
    while (bridge.state.winner === undefined && guard++ < 200) {
      await bridge.submitTurn({ kind: 'move', index: 1 }, { kind: 'move', index: 1 });
    }
    expect(['p1', 'p2']).toContain(bridge.state.winner);
  });
});
```

- [ ] **Step 5: Run both projection tests**

Run: `npx vitest run src/game/projection.test.ts src/game/projection-integration.test.ts`
Expected: PASS — projection correct and a projected team completes a real battle.

- [ ] **Step 6: Commit**

```bash
git add src/game/projection.ts src/game/projection.test.ts src/game/projection-integration.test.ts
git commit -m "feat(game): ownedToSet projection (+ battles through the Bridge)"
```

---

### Task 5: GameState container operations

**Files:**
- Create: `src/game/game-state.ts`
- Test: `src/game/game-state.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import {
  createNewGame, addToParty, depositToBox, withdrawFromBox,
  addItem, useItem, addMoney, spendMoney, grantBadge, registerCaught,
} from './game-state';
import { createOwned } from './owned-pokemon';

describe('game state containers', () => {
  it('creates a new game with empty party and starting settings', () => {
    const g = createNewGame({ difficultyMode: 'hardest', nuzlocke: true });
    expect(g.party).toEqual([]);
    expect(g.settings.nuzlocke).toBe(true);
    expect(g.money).toBe(0);
    expect(g.boxes.length).toBeGreaterThan(0);
  });

  it('adds to party up to 6, then overflows to a box', () => {
    let g = createNewGame({ difficultyMode: 'normal', nuzlocke: false });
    for (let i = 0; i < 7; i++) g = addToParty(g, createOwned({ species: 'Pikachu', level: 5 }));
    expect(g.party.length).toBe(6);
    const inBoxes = g.boxes.reduce((a, b) => a + b.slots.filter((s) => s).length, 0);
    expect(inBoxes).toBe(1);
  });

  it('deposits and withdraws from a box by uid', () => {
    let g = createNewGame({ difficultyMode: 'normal', nuzlocke: false });
    const mon = createOwned({ species: 'Snorlax', level: 20 });
    g = addToParty(g, mon);
    g = depositToBox(g, mon.uid);
    expect(g.party.find((m) => m.uid === mon.uid)).toBeUndefined();
    g = withdrawFromBox(g, mon.uid);
    expect(g.party.find((m) => m.uid === mon.uid)).toBeTruthy();
  });

  it('bag add/use and money add/spend respect floors', () => {
    let g = createNewGame({ difficultyMode: 'normal', nuzlocke: false });
    g = addItem(g, 'medicine', 'potion', 3);
    g = useItem(g, 'medicine', 'potion');
    expect(g.bag.medicine.potion).toBe(2);
    g = addMoney(g, 500);
    expect(spendMoney(g, 999)).toBeNull();          // can't overspend
    g = spendMoney(g, 200)!;
    expect(g.money).toBe(300);
  });

  it('grants badges (no duplicates) and registers pokedex caught', () => {
    let g = createNewGame({ difficultyMode: 'normal', nuzlocke: false });
    g = grantBadge(g, 'steel'); g = grantBadge(g, 'steel');
    expect(g.badges).toEqual(['steel']);
    g = registerCaught(g, 25);
    expect(g.pokedex.caught.has(25)).toBe(true);
    expect(g.pokedex.seen.has(25)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/game-state.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `game-state.ts`**

```ts
import type { GameState, GameSettings, OwnedPokemon } from './types';

const BOX_COUNT = 8, BOX_SIZE = 30;

export function createNewGame(settings: GameSettings): GameState {
  return {
    schemaVersion: 1, settings,
    party: [], boxes: Array.from({ length: BOX_COUNT }, (_, i) => ({ name: `Box ${i + 1}`, slots: Array(BOX_SIZE).fill(null) })),
    bag: {}, money: 0, badges: [],
    pokedex: { seen: new Set(), caught: new Set() },
    location: { mapId: 'start', x: 0, y: 0, atPokemonCenter: true },
    flags: {}, graveyard: [], time: { day: 0, minutes: 0 },
  };
}

function firstFreeBoxSlot(g: GameState): { box: number; slot: number } | null {
  for (let b = 0; b < g.boxes.length; b++) {
    const s = g.boxes[b].slots.findIndex((x) => x === null);
    if (s >= 0) return { box: b, slot: s };
  }
  return null;
}

export function addToParty(g: GameState, mon: OwnedPokemon): GameState {
  if (g.party.length < 6) return { ...g, party: [...g.party, mon] };
  const free = firstFreeBoxSlot(g);
  if (!free) return g;
  const boxes = g.boxes.map((b) => ({ ...b, slots: b.slots.slice() }));
  boxes[free.box].slots[free.slot] = mon;
  return { ...g, boxes };
}

export function depositToBox(g: GameState, uid: string): GameState {
  const mon = g.party.find((m) => m.uid === uid);
  if (!mon) return g;
  const free = firstFreeBoxSlot(g);
  if (!free) return g;
  const boxes = g.boxes.map((b) => ({ ...b, slots: b.slots.slice() }));
  boxes[free.box].slots[free.slot] = mon;
  return { ...g, party: g.party.filter((m) => m.uid !== uid), boxes };
}

export function withdrawFromBox(g: GameState, uid: string): GameState {
  if (g.party.length >= 6) return g;
  const boxes = g.boxes.map((b) => ({ ...b, slots: b.slots.slice() }));
  for (const b of boxes) {
    const i = b.slots.findIndex((m) => m?.uid === uid);
    if (i >= 0) { const mon = b.slots[i]!; b.slots[i] = null; return { ...g, party: [...g.party, mon], boxes }; }
  }
  return g;
}

export function addItem(g: GameState, pocket: string, itemId: string, count = 1): GameState {
  const bag = { ...g.bag, [pocket]: { ...(g.bag[pocket] ?? {}) } };
  bag[pocket][itemId] = (bag[pocket][itemId] ?? 0) + count;
  return { ...g, bag };
}

export function useItem(g: GameState, pocket: string, itemId: string): GameState {
  const have = g.bag[pocket]?.[itemId] ?? 0;
  if (have <= 0) return g;
  const bag = { ...g.bag, [pocket]: { ...g.bag[pocket] } };
  if (have - 1 <= 0) delete bag[pocket][itemId]; else bag[pocket][itemId] = have - 1;
  return { ...g, bag };
}

export function addMoney(g: GameState, amount: number): GameState {
  return { ...g, money: g.money + Math.max(0, amount) };
}

/** Returns the new state, or null if the player can't afford it. */
export function spendMoney(g: GameState, amount: number): GameState | null {
  if (amount > g.money) return null;
  return { ...g, money: g.money - amount };
}

export function grantBadge(g: GameState, badge: string): GameState {
  return g.badges.includes(badge) ? g : { ...g, badges: [...g.badges, badge] };
}

export function registerSeen(g: GameState, num: number): GameState {
  const seen = new Set(g.pokedex.seen); seen.add(num);
  return { ...g, pokedex: { ...g.pokedex, seen } };
}

export function registerCaught(g: GameState, num: number): GameState {
  const seen = new Set(g.pokedex.seen); seen.add(num);
  const caught = new Set(g.pokedex.caught); caught.add(num);
  return { ...g, pokedex: { seen, caught } };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/game/game-state.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/game-state.ts src/game/game-state.test.ts
git commit -m "feat(game): GameState container operations"
```

---

### Task 6: Save / load (serialize, validate, store)

**Files:**
- Create: `src/game/save.ts`
- Test: `src/game/save.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { serialize, deserialize, validateAndRepair, InMemorySaveStore } from './save';
import { createNewGame, registerCaught, addToParty } from './game-state';
import { createOwned } from './owned-pokemon';

describe('save/load', () => {
  it('round-trips a game state including pokedex Sets', () => {
    let g = createNewGame({ difficultyMode: 'hard', nuzlocke: true });
    g = registerCaught(g, 6); g = addToParty(g, createOwned({ species: 'Charizard', level: 36 }));
    const back = deserialize(serialize(g));
    expect(back.pokedex.caught.has(6)).toBe(true);
    expect(back.pokedex.caught instanceof Set).toBe(true);
    expect(back.party[0].species).toBe('Charizard');
    expect(back).toEqual(g);
  });

  it('stamps schemaVersion in the serialized payload', () => {
    const g = createNewGame({ difficultyMode: 'normal', nuzlocke: false });
    expect(JSON.parse(serialize(g)).schemaVersion).toBe(1);
  });

  it('validateAndRepair clamps an over-cap save', () => {
    const g = createNewGame({ difficultyMode: 'normal', nuzlocke: false });
    (g.party as any).push(createOwned({ species: 'Pikachu', level: 5 }), createOwned({ species: 'Pikachu', level: 5 }),
      createOwned({ species: 'Pikachu', level: 5 }), createOwned({ species: 'Pikachu', level: 5 }),
      createOwned({ species: 'Pikachu', level: 5 }), createOwned({ species: 'Pikachu', level: 5 }),
      createOwned({ species: 'Pikachu', level: 5 })); // 7 in party
    g.money = -50;
    const fixed = validateAndRepair(g);
    expect(fixed.party.length).toBe(6);
    expect(fixed.money).toBe(0);
  });

  it('SaveStore saves, loads, and deletes a slot', async () => {
    const store = new InMemorySaveStore();
    const g = createNewGame({ difficultyMode: 'normal', nuzlocke: false });
    await store.save('slot1', serialize(g));
    expect(await store.load('slot1')).toBeTruthy();
    await store.delete('slot1');
    expect(await store.load('slot1')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/save.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `save.ts`**

```ts
import type { GameState } from './types';

const SCHEMA_VERSION = 1;

export function serialize(state: GameState): string {
  return JSON.stringify({
    ...state,
    schemaVersion: SCHEMA_VERSION,
    pokedex: { seen: [...state.pokedex.seen], caught: [...state.pokedex.caught] },
  });
}

export function deserialize(json: string): GameState {
  const raw = JSON.parse(json);
  return {
    ...raw,
    pokedex: { seen: new Set<number>(raw.pokedex.seen), caught: new Set<number>(raw.pokedex.caught) },
  } as GameState;
}

/** Clamp/repair an untrusted or evolved save so it can't crash the game. */
export function validateAndRepair(state: GameState): GameState {
  const party = state.party.slice(0, 6);
  for (const mon of party) {
    for (const k of Object.keys(mon.evs) as (keyof typeof mon.evs)[]) mon.evs[k] = Math.max(0, Math.min(252, mon.evs[k]));
    let total = Object.values(mon.evs).reduce((a, b) => a + b, 0);
    for (const k of Object.keys(mon.evs) as (keyof typeof mon.evs)[]) { if (total <= 510) break; const cut = Math.min(mon.evs[k], total - 510); mon.evs[k] -= cut; total -= cut; }
  }
  return { ...state, party, money: Math.max(0, state.money) };
}

export interface SlotInfo { slot: string; }
export interface SaveStore {
  save(slot: string, json: string): Promise<void>;
  load(slot: string): Promise<string | null>;
  list(): Promise<SlotInfo[]>;
  delete(slot: string): Promise<void>;
}

export class InMemorySaveStore implements SaveStore {
  private data = new Map<string, string>();
  async save(slot: string, json: string) { this.data.set(slot, json); }
  async load(slot: string) { return this.data.get(slot) ?? null; }
  async list() { return [...this.data.keys()].map((slot) => ({ slot })); }
  async delete(slot: string) { this.data.delete(slot); }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/game/save.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/save.ts src/game/save.test.ts
git commit -m "feat(game): serialize/deserialize + validateAndRepair + SaveStore"
```

---

### Task 7: Rule hooks (save policy + Nuzlocke)

**Files:**
- Create: `src/game/rules.ts`
- Test: `src/game/rules.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { canSaveHere, applyFaintConsequences, markEncounterUsed, isEncounterUsed } from './rules';
import { createNewGame, addToParty } from './game-state';
import { createOwned, setHp } from './owned-pokemon';

describe('rules', () => {
  it('canSaveHere: anywhere on normal/hard, Centers-only on hardest', () => {
    const base = createNewGame({ difficultyMode: 'normal', nuzlocke: false });
    expect(canSaveHere({ ...base, location: { ...base.location, atPokemonCenter: false } })).toBe(true);
    const hardest = createNewGame({ difficultyMode: 'hardest', nuzlocke: false });
    expect(canSaveHere({ ...hardest, location: { ...hardest.location, atPokemonCenter: false } })).toBe(false);
    expect(canSaveHere({ ...hardest, location: { ...hardest.location, atPokemonCenter: true } })).toBe(true);
  });

  it('applyFaintConsequences sends fainted party mons to the graveyard ONLY when nuzlocke on', () => {
    let g = createNewGame({ difficultyMode: 'normal', nuzlocke: true });
    const alive = createOwned({ species: 'Pikachu', level: 10 });
    let fainted = createOwned({ species: 'Caterpie', level: 8 }); fainted = setHp(fainted, 0);
    g = addToParty(addToParty(g, alive), fainted);
    g = applyFaintConsequences(g);
    expect(g.party.map((m) => m.species)).toEqual(['Pikachu']);
    expect(g.graveyard.map((m) => m.species)).toEqual(['Caterpie']);
  });

  it('applyFaintConsequences is a no-op when nuzlocke off', () => {
    let g = createNewGame({ difficultyMode: 'normal', nuzlocke: false });
    let fainted = createOwned({ species: 'Caterpie', level: 8 }); fainted = setHp(fainted, 0);
    g = addToParty(g, fainted);
    g = applyFaintConsequences(g);
    expect(g.party.length).toBe(1);
    expect(g.graveyard.length).toBe(0);
  });

  it('encounter markers track per-area first encounter', () => {
    let g = createNewGame({ difficultyMode: 'normal', nuzlocke: true });
    expect(isEncounterUsed(g, 'route1')).toBe(false);
    g = markEncounterUsed(g, 'route1');
    expect(isEncounterUsed(g, 'route1')).toBe(true);
    expect(isEncounterUsed(g, 'route2')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/rules.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `rules.ts`**

```ts
import type { GameState } from './types';

export function canSaveHere(state: GameState): boolean {
  if (state.settings.difficultyMode !== 'hardest') return true;
  return state.location.atPokemonCenter;
}

/** Nuzlocke permadeath: move fainted party mons to the graveyard. No-op if off. */
export function applyFaintConsequences(state: GameState): GameState {
  if (!state.settings.nuzlocke) return state;
  const fallen = state.party.filter((m) => m.currentHp <= 0);
  if (fallen.length === 0) return state;
  return {
    ...state,
    party: state.party.filter((m) => m.currentHp > 0),
    graveyard: [...state.graveyard, ...fallen],
  };
}

const key = (areaId: string) => `encounter:${areaId}`;
export function markEncounterUsed(state: GameState, areaId: string): GameState {
  return { ...state, flags: { ...state.flags, [key(areaId)]: true } };
}
export function isEncounterUsed(state: GameState, areaId: string): boolean {
  return state.flags[key(areaId)] === true;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/game/rules.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/rules.ts src/game/rules.test.ts
git commit -m "feat(game): save-policy + Nuzlocke rule hooks"
```

---

### Task 8: Full suite + wrap

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: ALL pass (bridge + ai + game), no type errors.

- [ ] **Step 2: Append to `README.md`**

````markdown
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
````

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: game-state 3a usage"
```

---

## Self-Review notes

- **Spec coverage:** OwnedPokemon full-fidelity fields + derived stats/HP-type
  (Task 1); growth-rate curves + gap table (Task 2); create/exp/heal/ev (Task 3);
  projection + Bridge seam (Task 4); containers party/box/bag/money/badges/pokedex
  (Task 5); serialize/validate/SaveStore + schemaVersion (Task 6); save policy +
  Nuzlocke hooks (Task 7). Persistent HP/status fields exist on the model; injecting
  them INTO a started battle remains the flagged open question (handled in 3c).
- **Verified-API risks settled:** stat math validated against `@smogon/calc.stats`;
  Dex `baseStats`/`abilities`/`natures` confirmed; growth-rate/EV-yield gaps owned.
- **Deferred (not placeholders):** full National-Dex growth-rate table (seeded subset
  now, bulk later — `pi`); EV-yield table (used by 3c rewards); HP-into-battle wiring.
- **Type consistency:** `Stats6`/`OwnedPokemon`/`GameState` from `types.ts` used
  uniformly; `PokemonSet` from `bridge/types`; `GrowthGroup` shared Tasks 2–3.
```
