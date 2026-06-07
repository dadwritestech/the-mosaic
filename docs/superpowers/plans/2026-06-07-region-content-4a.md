# Region Content 4a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encode the region as data (content schema + registry + encounter roller) and build the Aethel's Rest → Whispering Path → Verdant Hollow vertical slice, proven playable end-to-end through the whole engine stack.

**Architecture:** Pure data + two small pure modules (`region` registry, `encounters` roller) under `src/content/`. The slice is data conforming to the schema; one integration test walks it through Bridge + AI + Game State.

**Tech Stack:** TypeScript, the existing `src/bridge`/`src/ai`/`src/game` modules, Vitest.

---

## File Structure

- `src/content/types.ts` — schema (`Location`, `EncounterTable`, `TrainerDef`, `GymDef`, `NpcDef`, `Biome`, `TimeBucket`).
- `src/content/encounters.ts` — `rollEncounter`.
- `src/content/slice/data.ts` — slice content (locations, trainers, gym, shop).
- `src/content/region.ts` — registry over the slice data.
- `src/data/*` — extend seed tables for slice wild species.
- Tests alongside + `src/content/slice-integration.test.ts`.

---

### Task 1: Content schema

**Files:** Create `src/content/types.ts`, `src/content/types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import type { Location, GymDef, EncounterTable } from './types';

describe('content schema', () => {
  it('constructs a minimal route location', () => {
    const enc: EncounterTable = { day: [{ species: 'Pidgey', minLevel: 2, maxLevel: 4, weight: 1 }] };
    const route: Location = {
      id: 'r1', name: 'Route', kind: 'route', biome: 'kanto-plains',
      connections: ['town'], isPokemonCenter: false, npcs: [], encounters: enc,
    };
    expect(route.encounters!.day![0].species).toBe('Pidgey');
  });
  it('constructs a gym def', () => {
    const gym: GymDef = {
      id: 'g1', badgeId: 'leaf', type: 'Grass',
      trainer: { id: 't1', name: 'Bramble', gymType: 'Grass', baseTier: 'easy',
        personality: { aggression: 0.6, caution: 0.3 }, teamSize: 2, levelCap: 12, basePayout: 20 },
    };
    expect(gym.type).toBe('Grass');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/content/types.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `types.ts`**

```ts
export type Biome = 'kanto-plains' | 'johto-forests' | 'hoenn-beaches' | 'sinnoh-tundra'
  | 'unova-urban' | 'kalos-gardens' | 'alola-islands' | 'galar-countryside' | 'paldea-wilds';
export type TimeBucket = 'morning' | 'day' | 'night';

export interface EncounterEntry { species: string; minLevel: number; maxLevel: number; weight: number; }
export type EncounterTable = Partial<Record<TimeBucket, EncounterEntry[]>>;

export interface NpcDef { id: string; name: string; lines: string[]; reputationGated?: string; }

export interface TrainerDef {
  id: string; name: string;
  gymType?: string;
  baseTier: 'easy' | 'normal' | 'hard';
  personality: { aggression: number; caution: number };
  teamSize: number; levelCap: number;
  basePayout: number;
  dropTable?: { itemId: string; chance: number }[];
}

export interface GymDef { id: string; trainer: TrainerDef; badgeId: string; type: string; }

export interface Location {
  id: string; name: string; kind: 'town' | 'route'; biome: Biome;
  connections: string[];
  isPokemonCenter: boolean;
  npcs: NpcDef[];
  encounters?: EncounterTable;
  shopId?: string;
  gymId?: string;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/content/types.test.ts && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/content/types.ts src/content/types.test.ts
git commit -m "feat(content): region content schema"
```

---

### Task 2: Encounter roller

**Files:** Create `src/content/encounters.ts`, `src/content/encounters.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { rollEncounter } from './encounters';
import { makeRng } from '../ai/rng';
import type { EncounterTable } from './types';

const table: EncounterTable = {
  day: [
    { species: 'Pidgey', minLevel: 2, maxLevel: 4, weight: 9 },
    { species: 'Rattata', minLevel: 3, maxLevel: 3, weight: 1 },
  ],
  night: [],
};

describe('rollEncounter', () => {
  it('returns a species from the requested time bucket within its level range', () => {
    const r = rollEncounter(table, 'day', makeRng(1))!;
    expect(['Pidgey', 'Rattata']).toContain(r.species);
    const entry = table.day!.find((e) => e.species === r.species)!;
    expect(r.level).toBeGreaterThanOrEqual(entry.minLevel);
    expect(r.level).toBeLessThanOrEqual(entry.maxLevel);
  });
  it('returns null for an empty or missing bucket', () => {
    expect(rollEncounter(table, 'night', makeRng(1))).toBeNull();
    expect(rollEncounter(table, 'morning', makeRng(1))).toBeNull();
  });
  it('respects weights (the 9:1 favorite dominates over many rolls)', () => {
    let pidgey = 0;
    for (let s = 0; s < 200; s++) if (rollEncounter(table, 'day', makeRng(s))!.species === 'Pidgey') pidgey++;
    expect(pidgey).toBeGreaterThan(140); // ~90% expected
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/content/encounters.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `encounters.ts`**

```ts
import type { EncounterTable, TimeBucket } from './types';

export function rollEncounter(table: EncounterTable, bucket: TimeBucket, rng: () => number): { species: string; level: number } | null {
  const entries = table[bucket];
  if (!entries || entries.length === 0) return null;
  const total = entries.reduce((a, e) => a + e.weight, 0);
  let r = rng() * total;
  for (const e of entries) {
    r -= e.weight;
    if (r <= 0) {
      const level = e.minLevel + Math.floor(rng() * (e.maxLevel - e.minLevel + 1));
      return { species: e.species, level };
    }
  }
  const last = entries[entries.length - 1];
  return { species: last.species, level: last.minLevel };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/content/encounters.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/content/encounters.ts src/content/encounters.test.ts
git commit -m "feat(content): weighted encounter roller (Convergence Tide)"
```

---

### Task 3: Extend seed tables for slice wild species

The slice uses Pidgey, Rattata, Hoothoot (plus Caterpie, already seeded). Add them to
the three data tables so wild encounters have correct catch/exp/growth values.

**Files:** Modify `src/data/catch-rates.ts`, `src/game/exp-yield.ts`, `src/game/growth-rates.ts`
Test: `src/content/slice-species.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { baseCatchRate } from '../data/catch-rates';
import { baseExpYield } from '../game/exp-yield';
import { growthRateOf } from '../game/growth-rates';

describe('slice species seeds', () => {
  it('Pidgey/Rattata/Hoothoot are seeded in all three tables', () => {
    for (const s of ['pidgey', 'rattata', 'hoothoot']) {
      expect(baseCatchRate(s)).toBe(255);
      expect(baseExpYield(s)).toBeGreaterThan(0);
    }
    expect(growthRateOf('Pidgey')).toBe('mediumslow');
    expect(growthRateOf('Rattata')).toBe('mediumfast');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/content/slice-species.test.ts`
Expected: FAIL — these species return defaults (45 catch rate), not 255.

- [ ] **Step 3: Add the seeds**

In `src/data/catch-rates.ts`, add to the `CATCH_RATES` object:
```ts
  pidgey: 255, rattata: 255, hoothoot: 255,
```
In `src/game/exp-yield.ts`, add to the `EXP_YIELD` object:
```ts
  pidgey: 50, rattata: 51, hoothoot: 52,
```
In `src/game/growth-rates.ts`, add to the `GROUPS` object:
```ts
  pidgey: 'mediumslow', rattata: 'mediumfast', hoothoot: 'mediumfast',
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/content/slice-species.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/catch-rates.ts src/game/exp-yield.ts src/game/growth-rates.ts src/content/slice-species.test.ts
git commit -m "feat(content): seed slice wild species (Pidgey/Rattata/Hoothoot)"
```

---

### Task 4: Slice data + region registry

**Files:** Create `src/content/slice/data.ts`, `src/content/region.ts`
Test: `src/content/region.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { getLocation, getTrainer, getGym, getShop, neighbors } from './region';

describe('region registry', () => {
  it('resolves slice locations and the slice is connected', () => {
    expect(getLocation('aethels-rest').name).toBe("Aethel's Rest");
    expect(neighbors('aethels-rest')).toContain('whispering-path');
    expect(neighbors('whispering-path').sort()).toEqual(['aethels-rest', 'verdant-hollow']);
  });
  it('resolves the Grass gym and its leader', () => {
    const gym = getGym('verdant-gym');
    expect(gym.type).toBe('Grass');
    expect(gym.badgeId).toBe('mosaic-leaf');
    expect(getTrainer(gym.trainer.id).name).toBe('Bramble');
  });
  it('resolves the starter-town shop', () => {
    expect(getShop('aethel-mart').stock.some((e) => e.itemId === 'pokeball')).toBe(true);
  });
  it('throws on unknown ids', () => {
    expect(() => getLocation('nowhere')).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/content/region.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `slice/data.ts`**

```ts
import type { Location, TrainerDef, GymDef } from '../types';
import type { ShopDef } from '../../game/shop';

export const BRAMBLE: TrainerDef = {
  id: 'bramble', name: 'Bramble', gymType: 'Grass', baseTier: 'easy',
  personality: { aggression: 0.6, caution: 0.4 }, teamSize: 2, levelCap: 12,
  basePayout: 20, dropTable: [{ itemId: 'superpotion', chance: 1 }],
};

export const ROUTE_YOUNGSTER: TrainerDef = {
  id: 'youngster-tim', name: 'Youngster Tim', baseTier: 'easy',
  personality: { aggression: 0.8, caution: 0.1 }, teamSize: 1, levelCap: 5, basePayout: 10,
};

export const VERDANT_GYM: GymDef = { id: 'verdant-gym', trainer: BRAMBLE, badgeId: 'mosaic-leaf', type: 'Grass' };

export const AETHEL_MART: ShopDef = {
  id: 'aethel-mart', name: 'Aethel Mart',
  stock: [{ itemId: 'pokeball', badgeGate: 0 }, { itemId: 'potion', badgeGate: 0 }],
};

export const LOCATIONS: Location[] = [
  {
    id: 'aethels-rest', name: "Aethel's Rest", kind: 'town', biome: 'kanto-plains',
    connections: ['whispering-path'], isPokemonCenter: true, shopId: 'aethel-mart',
    npcs: [{ id: 'aethel', name: 'Aethel', lines: ['The Core remembers every trainer who walked here.'] }],
  },
  {
    id: 'whispering-path', name: 'Whispering Path', kind: 'route', biome: 'kanto-plains',
    connections: ['aethels-rest', 'verdant-hollow'], isPokemonCenter: false, npcs: [],
    encounters: {
      morning: [{ species: 'Pidgey', minLevel: 2, maxLevel: 4, weight: 6 }, { species: 'Rattata', minLevel: 2, maxLevel: 4, weight: 4 }],
      day: [{ species: 'Pidgey', minLevel: 3, maxLevel: 5, weight: 5 }, { species: 'Caterpie', minLevel: 2, maxLevel: 4, weight: 5 }],
      night: [{ species: 'Rattata', minLevel: 3, maxLevel: 5, weight: 5 }, { species: 'Hoothoot', minLevel: 3, maxLevel: 5, weight: 5 }],
    },
  },
  {
    id: 'verdant-hollow', name: 'Verdant Hollow', kind: 'town', biome: 'johto-forests',
    connections: ['whispering-path'], isPokemonCenter: true, gymId: 'verdant-gym', npcs: [],
  },
];

export const TRAINERS: TrainerDef[] = [BRAMBLE, ROUTE_YOUNGSTER];
export const GYMS: GymDef[] = [VERDANT_GYM];
export const SHOPS: ShopDef[] = [AETHEL_MART];
```

- [ ] **Step 4: Implement `region.ts`**

```ts
import type { Location, TrainerDef, GymDef } from './types';
import type { ShopDef } from '../game/shop';
import { LOCATIONS, TRAINERS, GYMS, SHOPS } from './slice/data';

const locById = new Map(LOCATIONS.map((l) => [l.id, l]));
const trainerById = new Map(TRAINERS.map((t) => [t.id, t]));
const gymById = new Map(GYMS.map((g) => [g.id, g]));
const shopById = new Map(SHOPS.map((s) => [s.id, s]));

export function getLocation(id: string): Location { const v = locById.get(id); if (!v) throw new Error(`Unknown location: ${id}`); return v; }
export function getTrainer(id: string): TrainerDef { const v = trainerById.get(id); if (!v) throw new Error(`Unknown trainer: ${id}`); return v; }
export function getGym(id: string): GymDef { const v = gymById.get(id); if (!v) throw new Error(`Unknown gym: ${id}`); return v; }
export function getShop(id: string): ShopDef { const v = shopById.get(id); if (!v) throw new Error(`Unknown shop: ${id}`); return v; }
export function neighbors(id: string): string[] { return getLocation(id).connections.slice(); }
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/content/region.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/content/slice/data.ts src/content/region.ts src/content/region.test.ts
git commit -m "feat(content): vertical-slice data + region registry"
```

---

### Task 5: End-to-end wiring test (the proof) + wrap

**Files:** Create `src/content/slice-integration.test.ts`; Modify `README.md`

- [ ] **Step 1: Write the integration test**

```ts
import { describe, it, expect } from 'vitest';
import { getLocation, getGym } from './region';
import { rollEncounter } from './encounters';
import { makeRng } from '../ai/rng';
import { BattleBridge } from '../bridge/battle-bridge';
import { createOwned, setHp } from '../game/owned-pokemon';
import { ownedToSet } from '../game/projection';
import { composeTeam } from '../ai/team-composer';
import { createNewGame, addToParty, grantBadge } from '../game/game-state';
import { applyBattleResult } from '../game/battle-result';
import { recordTrainerDefeat } from '../game/rematch';
import * as Sim from 'pokemon-showdown';

describe('vertical slice — end to end through the whole stack', () => {
  it('wild encounter on Whispering Path runs a catchable battle', async () => {
    const path = getLocation('whispering-path');
    const enc = rollEncounter(path.encounters!, 'day', makeRng(3))!;
    expect(enc.species).toBeTruthy();

    const player = createOwned({ species: 'Pikachu', level: 12, moves: ['thunderbolt', 'quickattack'] });
    const wild = createOwned({ species: enc.species, level: enc.level, moves: ['tackle'] });
    const bridge = new BattleBridge();
    await bridge.startBattle([ownedToSet(player)], [ownedToSet(wild)], { formatid: 'gen9customgame', isWild: true });
    (bridge as any)._state.active.p2 = { species: enc.species, hpPercent: 3, status: 'slp' };
    expect(bridge.attemptCatch('ultra').caught).toBe(true);
  });

  it('Bramble gym: composed Grass team battles and a win grants the badge + progression', async () => {
    const gym = getGym('verdant-gym');
    const gymTeam = composeTeam(gym.trainer, { gen: 9, counterDraftStrength: 0.3, rng: makeRng(7) });
    // every drafted mon includes the gym type
    for (const set of gymTeam) {
      expect((Sim.Dex as any).forGen(9).species.get(set.species).types).toContain('Grass');
    }

    const player = createOwned({ species: 'Charizard', level: 14, moves: ['flamethrower', 'airslash', 'dragonpulse', 'roost'] });
    const bridge = new BattleBridge();
    await bridge.startBattle([ownedToSet(player)], gymTeam, { formatid: 'gen9customgame' });
    let guard = 0;
    while (bridge.state.winner === undefined && guard++ < 300) {
      await bridge.submitTurn({ kind: 'move', index: 1 }, { kind: 'move', index: 1 });
    }
    expect(['p1', 'p2']).toContain(bridge.state.winner);

    // Simulate a player win and run the progression chain.
    let g = addToParty(createNewGame({ difficultyMode: 'normal', nuzlocke: false }), player);
    const out = applyBattleResult(g, {
      won: true,
      finalConditions: [{ uid: player.uid, hpPercent: 60, status: '' }],
      defeatedTeam: gymTeam.map((s) => ({ species: s.species, level: s.level })),
      participantUids: [player.uid], isWild: false,
      trainer: { basePayout: gym.trainer.basePayout, tier: gym.trainer.baseTier, dropTable: gym.trainer.dropTable },
      rng: makeRng(1),
    });
    let state = grantBadge(out.state, gym.badgeId);
    state = recordTrainerDefeat(state, gym.trainer.id);

    expect(state.badges).toContain('mosaic-leaf');
    expect(state.money).toBeGreaterThan(0);
    expect(state.trainerLog[gym.trainer.id].defeats).toBe(1);
  });
});
```

- [ ] **Step 2: Run the integration test**

Run: `npx vitest run src/content/slice-integration.test.ts`
Expected: PASS. (If the gym battle stalls, the Bridge's `forceSwitch` auto-resolve and
multi-mon support from earlier sub-projects handle 2-mon teams; the guard caps turns.)

- [ ] **Step 3: Full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: ALL pass; no type errors.

- [ ] **Step 4: Append to `README.md`**

````markdown
## Region Content (sub-project 4a — schema + vertical slice)

```ts
import { getLocation, getGym } from './src/content/region';
import { rollEncounter } from './src/content/encounters';

const path = getLocation('whispering-path');
const wild = rollEncounter(path.encounters!, 'day', rng);   // Convergence Tide
const gym = getGym('verdant-gym');                          // Bramble (Grass) -> Composer
```

The Mosaic region as data: `Location`/`EncounterTable`/`TrainerDef`/`GymDef` schema,
a registry, and a time-keyed encounter roller. The vertical slice (Aethel's Rest →
Whispering Path → Verdant Hollow) is proven playable end-to-end through the Battle
Bridge, AI Brain, and Game State. Bulk region content (other gyms, all biomes, full
National-Dex data tables) is sub-project 4b.
````

- [ ] **Step 5: Commit**

```bash
git add src/content/slice-integration.test.ts README.md
git commit -m "test(content): vertical slice plays end-to-end; docs for 4a"
```

---

## Self-Review notes

- **Spec coverage:** schema (T1); encounter roller / Tide (T2); slice species seeds
  (T3); slice data + registry (T4); end-to-end wiring through Bridge+AI+GameState (T5).
- **Reuse verified:** `composeTeam` (2c) gym-type lock, `BattleBridge` + `attemptCatch`
  (1), `applyBattleResult` (3c), `grantBadge`/`recordTrainerDefeat` (3a/3d).
- **Deferred (not placeholders):** other 7 gyms, full map, all biome tables, full
  data-table tails (4b); the Tide day-rotation driver + stabilize meter content; NPC
  dialogue bulk; rendering (5).
- **Type consistency:** content `TrainerDef` is structurally compatible with the
  Composer's `TrainerDef` input (has `baseTier`/`teamSize`/`levelCap`/`gymType`);
  `ShopDef` reused from `src/game/shop.ts`; `GymDef.id` referenced by `getGym`.
```
