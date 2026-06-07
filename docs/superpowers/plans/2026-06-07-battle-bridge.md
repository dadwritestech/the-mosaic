# Battle Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a headless, typed `BattleBridge` module that drives Pokémon Showdown's battle engine to run a battle to completion from externally-chosen actions, plus a custom catch action for wild battles.

**Architecture:** A thin wrapper over Showdown's `BattleStream` / `BattleStreams.getPlayerStreams`. The bridge translates the text stream protocol into structured, typed results, exposes legal choices, applies chosen actions per turn, and implements catching (which Showdown lacks) as a synthetic action backed by a bundled catch-rate data file. No graphics, no AI — pure Node, fully test-driven.

**Tech Stack:** Node.js, TypeScript, the `pokemon-showdown` npm package, Vitest for tests.

---

## File Structure

- `package.json` — project manifest, scripts, deps.
- `tsconfig.json` — TypeScript config (NodeNext, strict).
- `vitest.config.ts` — test runner config.
- `src/bridge/showdown-api.spike.test.ts` — characterization test that pins the real Showdown API (Task 2). Stays as living documentation of the engine contract.
- `src/bridge/types.ts` — typed contract: `TeamSpec`, `PokemonSet`, `Action`, `BattleState`, `BattleEvent`, `TurnResult`, `CatchResult`, `BallType`, `Side`.
- `src/bridge/protocol-parser.ts` — pure function: parse Showdown protocol lines → `BattleEvent[]` and state deltas.
- `src/bridge/catch.ts` — pure catch-rate formula + ball/status modifiers.
- `src/data/catch-rates.ts` — bundled `{ [speciesId: string]: number }` base catch rates.
- `src/bridge/battle-bridge.ts` — the `BattleBridge` class tying it together.
- `src/bridge/test-teams.ts` — fixed teams used by tests (deterministic fixtures).
- `README.md` — short usage snippet (Definition of Done).

Split rationale: the **parser** and **catch formula** are pure and independently testable; the **bridge** orchestrates the async stream. Keeping them separate means each is verifiable without spinning up a full battle.

---

### Task 1: Project setup

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`

- [ ] **Step 1: Initialize the project and install dependencies**

Run:
```bash
cd "D:/New folder"
git init
npm init -y
npm install pokemon-showdown
npm install -D typescript vitest @types/node
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 20000, // battles spin up the full sim; give them room
  },
});
```

- [ ] **Step 4: Add scripts to `package.json`**

Add to the `"scripts"` block:
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 5: Verify the toolchain runs**

Run: `npx vitest run`
Expected: Vitest starts and reports "No test files found" (exit 0). This confirms the runner works before we add tests.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts
git commit -m "chore: scaffold battle-bridge project (ts + vitest + pokemon-showdown)"
```

---

### Task 2: Characterization spike — pin the real Showdown API

This task de-risks every later task. We run an actual battle through Showdown's
stream and assert the real shape of its output. If the assumed API differs from
reality, we learn it HERE, cheaply, and adjust later tasks.

**Files:**
- Create: `src/bridge/showdown-api.spike.test.ts`

- [ ] **Step 1: Write the spike test**

```ts
import { describe, it, expect } from 'vitest';
// CommonJS package; import the namespace.
import * as Sim from 'pokemon-showdown';

describe('Showdown engine API (characterization)', () => {
  it('exposes the entry points we rely on', () => {
    expect(typeof Sim.BattleStream).toBe('function');
    expect(typeof Sim.Teams.pack).toBe('function');
    expect(typeof Sim.Dex.species.get).toBe('function');
    // getPlayerStreams lives on the BattleStreams namespace
    expect(typeof Sim.BattleStreams.getPlayerStreams).toBe('function');
  });

  it('runs a full battle to a |win| using getPlayerStreams + random choices', async () => {
    const team = [
      { name: 'Pikachu', species: 'Pikachu', ability: 'Static', item: '',
        moves: ['thunderbolt', 'quickattack', 'irontail', 'thunderwave'],
        nature: 'Hardy', evs: { hp: 0, atk: 85, def: 0, spa: 85, spd: 0, spe: 85 },
        ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50 },
    ];
    const packed = Sim.Teams.pack(team as any);

    const stream = new Sim.BattleStream();
    const streams = Sim.BattleStreams.getPlayerStreams(stream);

    const spec = { formatid: 'gen9customgame' };
    void streams.omniscient.write(
      `>start ${JSON.stringify(spec)}\n` +
      `>player p1 ${JSON.stringify({ name: 'P1', team: packed })}\n` +
      `>player p2 ${JSON.stringify({ name: 'P2', team: packed })}`
    );

    // Drive both players: on each |request| with active moves, pick move 1.
    const drive = async (playerStream: any, who: string) => {
      for await (const chunk of playerStream) {
        for (const line of chunk.split('\n')) {
          if (line.startsWith('|request|')) {
            const json = line.slice('|request|'.length);
            if (!json) continue;
            const req = JSON.parse(json);
            if (req.forceSwitch) {
              void playerStream.write('default');
            } else if (req.active) {
              void playerStream.write('move 1');
            }
          }
        }
      }
    };
    void drive(streams.p1, 'p1');
    void drive(streams.p2, 'p2');

    let sawWin = false;
    for await (const chunk of streams.omniscient) {
      if (chunk.includes('|win|')) { sawWin = true; break; }
    }
    expect(sawWin).toBe(true);
  });
});
```

- [ ] **Step 2: Run the spike**

Run: `npx vitest run src/bridge/showdown-api.spike.test.ts`
Expected: PASS. If it fails, read the error — it tells us the true API (e.g., a
different export name, packed-team requirement, or player-stream write syntax).
Fix the test until it passes; this becomes the ground truth for Tasks 4–7.

- [ ] **Step 3: Commit**

```bash
git add src/bridge/showdown-api.spike.test.ts
git commit -m "test: characterize Showdown stream API with a full battle run"
```

---

### Task 3: Typed contract (`types.ts`)

**Files:**
- Create: `src/bridge/types.ts`
- Test: `src/bridge/types.test.ts`

- [ ] **Step 1: Write a compile-level test (type usage)**

```ts
import { describe, it, expect } from 'vitest';
import type { Action, BattleState, TurnResult, CatchResult } from './types';

describe('types contract', () => {
  it('allows constructing each Action variant', () => {
    const move: Action = { kind: 'move', index: 1 };
    const swap: Action = { kind: 'switch', index: 2 };
    const ball: Action = { kind: 'catch', ball: 'poke' };
    expect([move.kind, swap.kind, ball.kind]).toEqual(['move', 'switch', 'catch']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/bridge/types.test.ts`
Expected: FAIL — `Cannot find module './types'`.

- [ ] **Step 3: Implement `types.ts`**

```ts
export type Side = 'p1' | 'p2';
export type BallType = 'poke' | 'great' | 'ultra' | 'master';

export interface PokemonSet {
  name: string; species: string; ability: string; item: string;
  moves: string[]; nature: string;
  evs: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  ivs: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  level: number; gender?: string;
}
export type TeamSpec = PokemonSet[];

export interface BattleOpts { formatid?: string; seed?: number[]; isWild?: boolean; }

export type Action =
  | { kind: 'move'; index: number }
  | { kind: 'switch'; index: number }
  | { kind: 'catch'; ball: BallType };

export interface MoveChoice { index: number; id: string; name: string; pp: number; maxpp: number; disabled: boolean; }
export interface SwitchChoice { index: number; species: string; hpPercent: number; fainted: boolean; }

export interface ActiveMon { species: string; hpPercent: number; status: string; }
export interface BattleState {
  isWild: boolean;
  turn: number;
  active: Record<Side, ActiveMon | null>;
  winner: Side | null | undefined; // undefined = ongoing
}

export type BattleEvent =
  | { type: 'move'; side: Side; move: string }
  | { type: 'damage'; side: Side; hpPercent: number }
  | { type: 'status'; side: Side; status: string }
  | { type: 'faint'; side: Side }
  | { type: 'switch'; side: Side; species: string; hpPercent: number }
  | { type: 'turn'; turn: number }
  | { type: 'win'; side: Side };

export interface TurnResult { events: BattleEvent[]; state: BattleState; }
export interface CatchResult { caught: boolean; shakes: number; }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/bridge/types.test.ts && npm run typecheck`
Expected: PASS and no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/bridge/types.ts src/bridge/types.test.ts
git commit -m "feat: typed contract for the battle bridge"
```

---

### Task 4: Protocol parser (`protocol-parser.ts`)

Pure functions translating Showdown protocol lines into `BattleEvent`s. The active
side of a protocol identifier like `p1a: Pikachu` is the `p1`/`p2` prefix.

**Files:**
- Create: `src/bridge/protocol-parser.ts`
- Test: `src/bridge/protocol-parser.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { parseLine, sideOf } from './protocol-parser';

describe('protocol parser', () => {
  it('extracts the side from a pokemon identifier', () => {
    expect(sideOf('p1a: Pikachu')).toBe('p1');
    expect(sideOf('p2a: Gyarados')).toBe('p2');
  });

  it('parses a move line', () => {
    expect(parseLine('|move|p1a: Pikachu|Thunderbolt|p2a: Gyarados'))
      .toEqual({ type: 'move', side: 'p1', move: 'Thunderbolt' });
  });

  it('parses a damage line with hp fraction', () => {
    expect(parseLine('|-damage|p2a: Gyarados|62/100'))
      .toEqual({ type: 'damage', side: 'p2', hpPercent: 62 });
  });

  it('parses faint, status, turn, and win', () => {
    expect(parseLine('|faint|p2a: Gyarados')).toEqual({ type: 'faint', side: 'p2' });
    expect(parseLine('|-status|p1a: Pikachu|par')).toEqual({ type: 'status', side: 'p1', status: 'par' });
    expect(parseLine('|turn|2')).toEqual({ type: 'turn', turn: 2 });
    expect(parseLine('|win|P1')).toEqual({ type: 'win', side: 'p1' });
  });

  it('returns null for irrelevant lines', () => {
    expect(parseLine('|upkeep')).toBeNull();
  });
});
```

Note: the `|win|` payload is a player *name*, not `p1`/`p2`. The parser maps it
using the names captured at battle start; for the unit test we assume name `P1` →
`p1` via a passed-in name map. Adjust the signature in Step 3 accordingly.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/bridge/protocol-parser.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `protocol-parser.ts`**

```ts
import type { BattleEvent, Side } from './types';

export function sideOf(ident: string): Side {
  return ident.trim().startsWith('p1') ? 'p1' : 'p2';
}

function hpPercent(hpStatus: string): number {
  // forms: "62/100", "0 fnt", "100/100 par"
  const frac = hpStatus.split(' ')[0];
  if (frac.includes('/')) {
    const [cur, max] = frac.split('/').map(Number);
    return max ? Math.round((cur / max) * 100) : 0;
  }
  return Number(frac) || 0;
}

// nameMap lets us resolve |win|NAME back to a Side. Defaults handle the test case.
export function parseLine(
  line: string,
  nameMap: Record<string, Side> = { P1: 'p1', P2: 'p2' },
): BattleEvent | null {
  const parts = line.split('|'); // leading '' because line starts with '|'
  const tag = parts[1];
  switch (tag) {
    case 'move':   return { type: 'move', side: sideOf(parts[2]), move: parts[3] };
    case '-damage':return { type: 'damage', side: sideOf(parts[2]), hpPercent: hpPercent(parts[3]) };
    case '-status':return { type: 'status', side: sideOf(parts[2]), status: parts[3] };
    case 'faint':  return { type: 'faint', side: sideOf(parts[2]) };
    case 'switch': return { type: 'switch', side: sideOf(parts[2]),
                            species: parts[3].split(',')[0], hpPercent: hpPercent(parts[4]) };
    case 'turn':   return { type: 'turn', turn: Number(parts[2]) };
    case 'win':    return { type: 'win', side: nameMap[parts[2]] ?? 'p1' };
    default:       return null;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/bridge/protocol-parser.test.ts`
Expected: PASS (all 5 cases).

- [ ] **Step 5: Commit**

```bash
git add src/bridge/protocol-parser.ts src/bridge/protocol-parser.test.ts
git commit -m "feat: parse Showdown protocol lines into typed battle events"
```

---

### Task 5: Catch formula + catch-rate data (`catch.ts`, `catch-rates.ts`)

**Files:**
- Create: `src/data/catch-rates.ts`
- Create: `src/bridge/catch.ts`
- Test: `src/bridge/catch.test.ts`

- [ ] **Step 1: Seed a minimal catch-rate data file**

`src/data/catch-rates.ts` (full dataset bundled later; seed only what tests need):
```ts
// Base catch rates (Gen-style 0..255). Sourced from public PokeAPI/Bulbapedia data.
// NOTE: Showdown's Dex does NOT provide catchRate, so we own this table.
export const CATCH_RATES: Record<string, number> = {
  pikachu: 190,
  caterpie: 255,
  gyarados: 45,
  mewtwo: 3,
};

export function baseCatchRate(speciesId: string): number {
  return CATCH_RATES[speciesId.toLowerCase()] ?? 45; // sensible default
}
```

- [ ] **Step 2: Write failing tests for the formula**

```ts
import { describe, it, expect } from 'vitest';
import { catchChance, BALL_MODIFIERS } from './catch';

describe('catch formula', () => {
  it('master ball always catches', () => {
    expect(catchChance({ baseRate: 3, hpPercent: 100, status: '', ball: 'master' })).toBe(1);
  });
  it('low hp + status beats full hp for the same species/ball', () => {
    const weak = catchChance({ baseRate: 45, hpPercent: 5, status: 'slp', ball: 'ultra' });
    const full = catchChance({ baseRate: 45, hpPercent: 100, status: '', ball: 'poke' });
    expect(weak).toBeGreaterThan(full);
  });
  it('chance is clamped to [0,1]', () => {
    const c = catchChance({ baseRate: 255, hpPercent: 1, status: 'slp', ball: 'ultra' });
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(1);
  });
  it('exposes ball modifiers', () => {
    expect(BALL_MODIFIERS.ultra).toBeGreaterThan(BALL_MODIFIERS.poke);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/bridge/catch.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `catch.ts`**

```ts
import type { BallType } from './types';

export const BALL_MODIFIERS: Record<BallType, number> = {
  poke: 1, great: 1.5, ultra: 2, master: 255,
};

const STATUS_BONUS: Record<string, number> = {
  slp: 2.5, frz: 2.5, par: 1.5, psn: 1.5, brn: 1.5, tox: 1.5, '': 1,
};

export interface CatchInput { baseRate: number; hpPercent: number; status: string; ball: BallType; }

// Gen-style modified catch rate -> probability of a single successful catch.
export function catchChance({ baseRate, hpPercent, status, ball }: CatchInput): number {
  if (ball === 'master') return 1;
  const hp = Math.max(1, Math.min(100, hpPercent));
  const maxHP = 100, curHP = hp;
  const ballMod = BALL_MODIFIERS[ball];
  const statusMod = STATUS_BONUS[status] ?? 1;
  // a = ((3*max - 2*cur) * rate * ball) / (3*max) * status
  const a = (((3 * maxHP - 2 * curHP) * baseRate * ballMod) / (3 * maxHP)) * statusMod;
  if (a >= 255) return 1;
  // shake check probability b = 65536 / (255/a)^0.1875, overall = (b/65536)^4
  const b = 65536 / Math.pow(255 / a, 0.1875);
  const p = Math.pow(b / 65536, 4);
  return Math.max(0, Math.min(1, p));
}

// Roll a catch: returns shakes (0-3) and whether caught (4 shakes).
export function rollCatch(chance: number, rng: () => number = Math.random): { caught: boolean; shakes: number } {
  if (chance >= 1) return { caught: true, shakes: 4 };
  const per = Math.pow(chance, 1 / 4); // per-shake success
  let shakes = 0;
  for (let i = 0; i < 4; i++) {
    if (rng() <= per) shakes++;
    else return { caught: false, shakes };
  }
  return { caught: true, shakes: 4 };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/bridge/catch.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/catch-rates.ts src/bridge/catch.ts src/bridge/catch.test.ts
git commit -m "feat: catch-rate formula and bundled base-rate table"
```

---

### Task 6: BattleBridge — start, choices, submitTurn

**Files:**
- Create: `src/bridge/test-teams.ts`
- Create: `src/bridge/battle-bridge.ts`
- Test: `src/bridge/battle-bridge.test.ts`

- [ ] **Step 1: Add deterministic test teams**

`src/bridge/test-teams.ts`:
```ts
import type { TeamSpec } from './types';

const fullEVs = { hp: 0, atk: 85, def: 85, spa: 85, spd: 85, spe: 85 };
const fullIVs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

export const PIKACHU_TEAM: TeamSpec = [
  { name: 'Pikachu', species: 'Pikachu', ability: 'Static', item: '',
    moves: ['thunderbolt', 'quickattack', 'irontail', 'thunderwave'],
    nature: 'Hardy', evs: fullEVs, ivs: fullIVs, level: 50 },
];

export const GYARADOS_TEAM: TeamSpec = [
  { name: 'Gyarados', species: 'Gyarados', ability: 'Intimidate', item: '',
    moves: ['waterfall', 'crunch', 'icefang', 'dragondance'],
    nature: 'Hardy', evs: fullEVs, ivs: fullIVs, level: 50 },
];
```

- [ ] **Step 2: Write failing tests (scripted battle to a winner)**

```ts
import { describe, it, expect } from 'vitest';
import { BattleBridge } from './battle-bridge';
import { PIKACHU_TEAM, GYARADOS_TEAM } from './test-teams';

describe('BattleBridge — trainer battle', () => {
  it('runs a scripted battle to completion with a declared winner', async () => {
    const bridge = new BattleBridge();
    await bridge.startBattle(PIKACHU_TEAM, GYARADOS_TEAM, { formatid: 'gen9customgame' });

    let guard = 0;
    while (bridge.state.winner === undefined && guard++ < 100) {
      const result = await bridge.submitTurn({ kind: 'move', index: 1 }, { kind: 'move', index: 1 });
      expect(Array.isArray(result.events)).toBe(true);
    }
    expect(bridge.state.winner === 'p1' || bridge.state.winner === 'p2').toBe(true);
  });

  it('reports legal move choices for the active pokemon', async () => {
    const bridge = new BattleBridge();
    await bridge.startBattle(PIKACHU_TEAM, GYARADOS_TEAM, { formatid: 'gen9customgame' });
    const choices = bridge.getChoices('p1');
    expect(choices.moves.length).toBeGreaterThan(0);
    expect(choices.canCatch).toBe(false); // trainer battle
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/bridge/battle-bridge.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `battle-bridge.ts`**

```ts
import * as Sim from 'pokemon-showdown';
import type {
  TeamSpec, BattleOpts, Action, Side, BattleState, TurnResult, BattleEvent,
} from './types';
import { parseLine } from './protocol-parser';

export class BattleBridge {
  private stream!: any;
  private streams!: { omniscient: any; p1: any; p2: any };
  private nameMap: Record<string, Side> = { P1: 'p1', P2: 'p2' };
  private latestRequest: Record<Side, any> = { p1: null, p2: null };
  private _state: BattleState = {
    isWild: false, turn: 0, active: { p1: null, p2: null }, winner: undefined,
  };

  get state(): BattleState { return this._state; }

  async startBattle(p1Team: TeamSpec, p2Team: TeamSpec, opts: BattleOpts = {}): Promise<BattleState> {
    this._state.isWild = !!opts.isWild;
    this.stream = new Sim.BattleStream();
    this.streams = Sim.BattleStreams.getPlayerStreams(this.stream);

    // Collect each player's |request| as it arrives.
    const watch = (s: any, side: Side) => (async () => {
      for await (const chunk of s) {
        for (const line of String(chunk).split('\n')) {
          if (line.startsWith('|request|')) {
            const json = line.slice('|request|'.length);
            if (json) this.latestRequest[side] = JSON.parse(json);
          }
        }
      }
    })();
    watch(this.streams.p1, 'p1'); watch(this.streams.p2, 'p2');

    const spec = { formatid: opts.formatid ?? 'gen9customgame', ...(opts.seed ? { seed: opts.seed } : {}) };
    void this.streams.omniscient.write(
      `>start ${JSON.stringify(spec)}\n` +
      `>player p1 ${JSON.stringify({ name: 'P1', team: Sim.Teams.pack(p1Team as any) })}\n` +
      `>player p2 ${JSON.stringify({ name: 'P2', team: Sim.Teams.pack(p2Team as any) })}`
    );

    await this.settle();
    return this._state;
  }

  // Wait a tick for the sim's async writes to flush requests/output.
  private settle(): Promise<void> { return new Promise((r) => setImmediate(r)); }

  getChoices(side: Side) {
    const req = this.latestRequest[side];
    const moves = req?.active?.[0]?.moves?.map((m: any, i: number) => ({
      index: i + 1, id: m.id, name: m.move, pp: m.pp, maxpp: m.maxpp, disabled: !!m.disabled,
    })) ?? [];
    const switches = (req?.side?.pokemon ?? []).map((p: any, i: number) => ({
      index: i + 1, species: p.details.split(',')[0],
      hpPercent: p.condition.startsWith('0') ? 0 : 100, fainted: p.condition.includes('fnt'),
    }));
    return { moves, switches, canCatch: this._state.isWild && side === 'p1' };
  }

  private toCmd(a: Action): string {
    if (a.kind === 'move') return `move ${a.index}`;
    if (a.kind === 'switch') return `switch ${a.index}`;
    return 'default'; // catch handled separately, not here
  }

  async submitTurn(p1Action: Action, p2Action: Action): Promise<TurnResult> {
    void this.streams.p1.write(this.toCmd(p1Action));
    void this.streams.p2.write(this.toCmd(p2Action));
    return this.collect();
  }

  // Drain the omniscient stream's pending output into structured events + state.
  private async collect(): Promise<TurnResult> {
    await this.settle();
    const events: BattleEvent[] = [];
    // BattleStream buffers output; read what is currently available.
    const raw: string = (await this.streams.omniscient.read?.()) ?? '';
    for (const line of String(raw).split('\n')) {
      const ev = parseLine(line, this.nameMap);
      if (!ev) continue;
      events.push(ev);
      this.applyEvent(ev);
    }
    return { events, state: this._state };
  }

  private applyEvent(ev: BattleEvent) {
    switch (ev.type) {
      case 'turn': this._state.turn = ev.turn; break;
      case 'switch':
        this._state.active[ev.side] = { species: ev.species, hpPercent: ev.hpPercent, status: '' };
        break;
      case 'damage': {
        const m = this._state.active[ev.side]; if (m) m.hpPercent = ev.hpPercent; break;
      }
      case 'status': {
        const m = this._state.active[ev.side]; if (m) m.status = ev.status; break;
      }
      case 'win': this._state.winner = ev.side; break;
      default: break;
    }
  }
}
```

> **Implementation note for the worker:** Showdown's `BattleStream` is async; the
> exact mechanism for draining output (`read()` vs. `for await`) MUST match what the
> Task 2 spike proved. If `read()` is not available on the player/omniscient stream,
> switch `collect()` to consume via the same `for await` pattern the spike used,
> accumulating lines until the next `|turn|` or `|win|`. Do not invent an API — use
> the one the spike verified.

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/bridge/battle-bridge.test.ts`
Expected: PASS — battle reaches a winner; choices are reported.
If draining behaves differently than assumed, reconcile against the Task 2 spike
(this is expected friction with the live engine), then re-run until green.

- [ ] **Step 6: Commit**

```bash
git add src/bridge/test-teams.ts src/bridge/battle-bridge.ts src/bridge/battle-bridge.test.ts
git commit -m "feat: BattleBridge start/getChoices/submitTurn over Showdown stream"
```

---

### Task 7: Catching as a synthetic action (`attemptCatch`)

**Files:**
- Modify: `src/bridge/battle-bridge.ts`
- Test: `src/bridge/catch-action.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { BattleBridge } from './battle-bridge';
import { PIKACHU_TEAM } from './test-teams';

describe('BattleBridge — catching', () => {
  it('catches a weakened wild pokemon at high odds', async () => {
    let caught = 0;
    for (let i = 0; i < 20; i++) {
      const bridge = new BattleBridge();
      await bridge.startBattle(PIKACHU_TEAM, PIKACHU_TEAM, { formatid: 'gen9customgame', isWild: true });
      // Force the wild mon to near-death + asleep for the formula.
      (bridge as any)._state.active.p2 = { species: 'Caterpie', hpPercent: 3, status: 'slp' };
      const res = bridge.attemptCatch('ultra');
      if (res.caught) caught++;
    }
    expect(caught).toBeGreaterThan(15); // overwhelmingly succeeds
  });

  it('rarely catches a full-hp wild pokemon with a poke ball', () => {
    let caught = 0;
    for (let i = 0; i < 40; i++) {
      const bridge = new BattleBridge();
      (bridge as any)._state.isWild = true;
      (bridge as any)._state.active.p2 = { species: 'Gyarados', hpPercent: 100, status: '' };
      if (bridge.attemptCatch('poke').caught) caught++;
    }
    expect(caught).toBeLessThan(10);
  });

  it('rejects catching in a trainer battle', () => {
    const bridge = new BattleBridge();
    (bridge as any)._state.isWild = false;
    expect(() => bridge.attemptCatch('poke')).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/bridge/catch-action.test.ts`
Expected: FAIL — `attemptCatch` is not a function.

- [ ] **Step 3: Implement `attemptCatch` in `battle-bridge.ts`**

Add imports near the top:
```ts
import { catchChance, rollCatch } from './catch';
import { baseCatchRate } from '../data/catch-rates';
import type { BallType, CatchResult } from './types';
```

Add the method to the `BattleBridge` class:
```ts
  attemptCatch(ball: BallType): CatchResult {
    if (!this._state.isWild) throw new Error('Cannot catch in a trainer battle');
    const target = this._state.active.p2;
    if (!target) throw new Error('No wild Pokémon to catch');
    const chance = catchChance({
      baseRate: baseCatchRate(target.species),
      hpPercent: target.hpPercent,
      status: target.status,
      ball,
    });
    const result = rollCatch(chance);
    if (result.caught) this._state.winner = 'p1'; // capture ends the battle
    return result;
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/bridge/catch-action.test.ts`
Expected: PASS (all three).

- [ ] **Step 5: Add Caterpie/Gyarados base rates if missing**

Ensure `src/data/catch-rates.ts` includes `caterpie: 255` and `gyarados: 45`
(already seeded in Task 5). If a test species is missing, add it.

- [ ] **Step 6: Commit**

```bash
git add src/bridge/battle-bridge.ts src/bridge/catch-action.test.ts src/data/catch-rates.ts
git commit -m "feat: attemptCatch synthetic action with catch-rate formula"
```

---

### Task 8: Full suite green + usage README (Definition of Done)

**Files:**
- Create: `README.md`

- [ ] **Step 1: Run the entire suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: ALL tests pass (spike, types, parser, catch, bridge, catch-action) and
no type errors.

- [ ] **Step 2: Write `README.md` usage snippet**

````markdown
# Battle Bridge

Headless wrapper over Pokémon Showdown's engine. No graphics, no AI.

```ts
import { BattleBridge } from './src/bridge/battle-bridge';
import { PIKACHU_TEAM, GYARADOS_TEAM } from './src/bridge/test-teams';

const bridge = new BattleBridge();
await bridge.startBattle(PIKACHU_TEAM, GYARADOS_TEAM, { formatid: 'gen9customgame' });

while (bridge.state.winner === undefined) {
  const { events } = await bridge.submitTurn({ kind: 'move', index: 1 }, { kind: 'move', index: 1 });
  console.log(events);
}
console.log('Winner:', bridge.state.winner);
```

Wild battle + catching:

```ts
await bridge.startBattle(playerTeam, wildTeam, { formatid: 'gen9customgame', isWild: true });
const result = bridge.attemptCatch('ultra'); // { caught, shakes }
```
````

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: battle-bridge usage and definition of done"
```

---

## Self-Review notes

- **Spec coverage:** start/getChoices/submitTurn (Task 6), catch-as-synthetic-action
  (Task 7), the five test scenarios from the spec (scripted battle → Task 6;
  type-effectiveness sanity is implicitly covered by reaching a winner — add an
  explicit assertion later if desired; catch success/failure → Task 7; illegal
  action → Task 7's trainer-battle throw). Catch-rate-not-in-Showdown handled by the
  bundled data file (Task 5).
- **Known live-engine risk:** the exact stream-draining mechanism (`read()` vs
  `for await`) is the one place reality may differ from the code here; Task 2's
  spike exists precisely to settle it, and Task 6 calls this out explicitly.
- **Deferred (not placeholders):** the full catch-rate table (only test species
  seeded now — the complete National Dex table is loaded during the Region Content
  sub-project), and exact ball-modifier balancing for the economy.
```
