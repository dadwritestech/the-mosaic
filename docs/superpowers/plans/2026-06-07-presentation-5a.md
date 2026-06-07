# Presentation 5a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable, screenshot-verifiable vertical slice — walk Aethel's Rest → Whispering Path → Verdant Hollow in a 2D overworld, trigger a wild battle and Bramble's gym in a 3D battle scene wired to the real Bridge + AI, win → badge.

**Architecture:** A Vite + TS web app in `web/` importing the verified `src/` logic as its model (no new game logic). A screen state machine switches a 2D Canvas overworld and a Three.js 3D battle scene. Creatures load a GLB model if present, else a billboarded Showdown sprite. Verified by running the dev server and screenshotting milestones.

**Tech Stack:** Vite, TypeScript, Three.js, Canvas2D, the existing `src/*` modules, Vitest (for the few unit-testable pieces).

---

## File Structure
- `web/index.html`, `web/main.ts` — entry + bootstrap.
- `web/app/game-app.ts` — screen state machine + live `GameState`.
- `web/overworld/tilemap.ts` + `web/overworld/maps/slice.ts` — tilemap types/loader + slice maps.
- `web/overworld/overworld-screen.ts` — 2D renderer + input + interactions.
- `web/battle/battle-screen.ts` + `web/battle/creature.ts` — Three.js battle + creature loader.
- `web/assets/manifest.ts` — species → sprite/model URLs.
- `web/ui/hud.ts` — DOM HUD overlay (built with DOM APIs, no innerHTML).
- `vite.config.ts`, package scripts. Tests: `web/overworld/tilemap.test.ts`, `web/app/game-app.test.ts`.

> **Verification note:** renderer tasks are verified by **screenshot** (run `npm run dev`,
> drive the browser, capture). Only pure pieces (tilemap loader, screen machine) get unit tests.

---

### Task 1: Vite app shell (renders a canvas)

**Files:** Create `web/index.html`, `web/main.ts`, `vite.config.ts`; Modify `package.json`

- [ ] **Step 1: Install + scripts**

Run:
```bash
cd "D:/New folder"
npm install -D vite three @types/three
```
Add to `package.json` scripts: `"dev": "vite", "build:web": "vite build", "preview": "vite preview"`.

- [ ] **Step 2: `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
export default defineConfig({ root: 'web', server: { port: 5173 }, build: { outDir: '../dist-web' } });
```

- [ ] **Step 3: `web/index.html`**

```html
<!doctype html>
<html><head><meta charset="utf-8"><title>The Mosaic</title>
<style>html,body{margin:0;height:100%;background:#0b0f17;overflow:hidden;font-family:system-ui}
#game{position:relative;width:100vw;height:100vh}#game canvas{display:block}</style></head>
<body><div id="game"></div><script type="module" src="./main.ts"></script></body></html>
```

- [ ] **Step 4: `web/main.ts` (minimal canvas to prove the toolchain)**

```ts
const root = document.getElementById('game')!;
const c = document.createElement('canvas');
c.width = window.innerWidth; c.height = window.innerHeight;
root.appendChild(c);
const ctx = c.getContext('2d')!;
ctx.fillStyle = '#1b2a1b'; ctx.fillRect(0, 0, c.width, c.height);
ctx.fillStyle = '#eaeaea'; ctx.font = '24px system-ui';
ctx.fillText('The Mosaic — booting…', 40, 60);
```

- [ ] **Step 5: Run dev server + screenshot**

Run: `npm run dev` (background). Open `http://localhost:5173`, screenshot.
Expected: dark-green canvas with "The Mosaic — booting…". **Acceptance: screenshot shows the canvas.**

- [ ] **Step 6: Commit**

```bash
git add web vite.config.ts package.json package-lock.json
git commit -m "feat(web): Vite + Three app shell renders a canvas"
```

---

### Task 2: Tilemap data + loader (unit-tested)

**Files:** Create `web/overworld/tilemap.ts`, `web/overworld/maps/slice.ts`, `web/overworld/tilemap.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { SLICE_MAPS } from './maps/slice';
import { tileAt, isWalkable } from './tilemap';

describe('tilemap', () => {
  it('every slice map is rectangular and has a spawn', () => {
    for (const m of Object.values(SLICE_MAPS)) {
      const w = m.tiles[0].length;
      for (const row of m.tiles) expect(row.length).toBe(w);
      expect(m.spawn.x).toBeGreaterThanOrEqual(0);
    }
  });
  it('walls block movement; out of bounds is wall', () => {
    const m = SLICE_MAPS['aethels-rest'];
    expect(isWalkable(m, m.spawn.x, m.spawn.y)).toBe(true);
    expect(tileAt(m, -1, 0)).toBe('wall');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run web/overworld/tilemap.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `tilemap.ts`**

```ts
export type Tile = 'floor' | 'grass' | 'wall' | 'exit' | 'gym' | 'npc' | 'center' | 'shop';
export interface TileMeta { exitTo?: string; gymId?: string; npcId?: string; }
export interface TileMap { id: string; tiles: Tile[][]; spawn: { x: number; y: number }; meta: Record<string, TileMeta>; biome: string; }
export function tileAt(m: TileMap, x: number, y: number): Tile {
  if (y < 0 || y >= m.tiles.length || x < 0 || x >= m.tiles[0].length) return 'wall';
  return m.tiles[y][x];
}
export function isWalkable(m: TileMap, x: number, y: number): boolean { return tileAt(m, x, y) !== 'wall'; }
export function metaAt(m: TileMap, x: number, y: number): TileMeta { return m.meta[`${x},${y}`] ?? {}; }
```

- [ ] **Step 4: Implement `maps/slice.ts`**

```ts
import type { TileMap, Tile } from '../tilemap';
const CH: Record<string, Tile> = { '.': 'floor', g: 'grass', '#': 'wall', E: 'exit', Y: 'gym', N: 'npc', C: 'center', S: 'shop' };
function parse(id: string, biome: string, rows: string[], spawn: { x: number; y: number }, meta: Record<string, any>): TileMap {
  return { id, biome, tiles: rows.map((r) => [...r].map((c) => CH[c] ?? 'floor')), spawn, meta };
}
export const SLICE_MAPS: Record<string, TileMap> = {
  'aethels-rest': parse('aethels-rest', 'kanto-plains',
    ['#########', '#..C..S.#', '#..N....#', '#.......#', '#...E...#', '#########'],
    { x: 4, y: 3 }, { '4,4': { exitTo: 'whispering-path' }, '3,2': { npcId: 'aethel' } }),
  'whispering-path': parse('whispering-path', 'kanto-plains',
    ['###########', 'E...ggg...#', '#..ggggg..#', '#...ggg...E', '###########'],
    { x: 1, y: 1 }, { '0,1': { exitTo: 'aethels-rest' }, '10,3': { exitTo: 'verdant-hollow' } }),
  'verdant-hollow': parse('verdant-hollow', 'johto-forests',
    ['#########', '#...Y...#', '#..C.S..#', '#...E...#', '#########'],
    { x: 4, y: 3 }, { '4,3': { exitTo: 'whispering-path' }, '4,1': { gymId: 'verdant-gym' } }),
};
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run web/overworld/tilemap.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/overworld/tilemap.ts web/overworld/maps/slice.ts web/overworld/tilemap.test.ts
git commit -m "feat(web): tilemap schema + slice maps"
```

---

### Task 3: 2D overworld screen (render + move + interact)

**Files:** Create `web/app/game-app.ts`, `web/overworld/overworld-screen.ts`; Modify `web/main.ts`
Test: `web/app/game-app.test.ts`

- [ ] **Step 1: Write the screen-machine test**

```ts
import { describe, it, expect } from 'vitest';
import { GameApp } from './game-app';

describe('GameApp screen machine', () => {
  it('starts on the overworld and switches screens', () => {
    const app = new GameApp();
    expect(app.screen).toBe('overworld');
    app.setScreen('battle'); expect(app.screen).toBe('battle');
  });
  it('holds a live GameState with a starter party', () => {
    expect(new GameApp().state.party.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run web/app/game-app.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `game-app.ts`**

```ts
import type { GameState } from '../../src/game/types';
import { createNewGame, addToParty } from '../../src/game/game-state';
import { createOwned } from '../../src/game/owned-pokemon';
export type Screen = 'overworld' | 'battle' | 'dialogue';
export class GameApp {
  screen: Screen = 'overworld';
  state: GameState;
  locationId = 'aethels-rest';
  constructor() {
    this.state = addToParty(createNewGame({ difficultyMode: 'normal', nuzlocke: false }),
      createOwned({ species: 'Pikachu', level: 8, moves: ['thunderbolt', 'quickattack', 'irontail', 'thunderwave'], nature: 'Timid' }));
  }
  setScreen(s: Screen) { this.screen = s; }
}
```

- [ ] **Step 4: Implement `overworld-screen.ts`**

```ts
import { SLICE_MAPS } from './maps/slice';
import { tileAt, isWalkable, metaAt, type TileMap } from './tilemap';
import { advanceStep, timeOfDay } from '../../src/game/clock';
import { rollEncounter } from '../../src/content/encounters';
import { getLocation } from '../../src/content/region';
import { makeRng } from '../../src/ai/rng';
import type { GameApp } from '../app/game-app';

const TS = 48;
const COLORS: Record<string, string> = { floor: '#cdebb3', grass: '#4caf38', wall: '#3b4a5a', exit: '#e9d27a', gym: '#b07cd6', npc: '#7ec8ff', center: '#ff7b8a', shop: '#ffd36b' };

export class OverworldScreen {
  px: number; py: number; map: TileMap;
  constructor(private canvas: HTMLCanvasElement, private app: GameApp,
    private onEncounter: (species: string, level: number) => void,
    private onGym: (gymId: string) => void,
    private onNpc: (npcId: string) => void) {
    this.map = SLICE_MAPS[app.locationId];
    this.px = this.map.spawn.x; this.py = this.map.spawn.y;
    window.addEventListener('keydown', this.onKey);
    this.render();
  }
  private onKey = (e: KeyboardEvent) => {
    if (this.app.screen !== 'overworld') return;
    const d: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const mv = d[e.key]; if (!mv) return;
    const nx = this.px + mv[0], ny = this.py + mv[1];
    if (!isWalkable(this.map, nx, ny)) return;
    this.px = nx; this.py = ny;
    this.app.state = advanceStep(this.app.state);
    this.handleTile(nx, ny);
    this.render();
  };
  private handleTile(x: number, y: number) {
    const meta = metaAt(this.map, x, y);
    if (meta.exitTo) { this.app.locationId = meta.exitTo; this.map = SLICE_MAPS[meta.exitTo]; this.px = this.map.spawn.x; this.py = this.map.spawn.y; return; }
    if (meta.gymId) return this.onGym(meta.gymId);
    if (meta.npcId) return this.onNpc(meta.npcId);
    if (tileAt(this.map, x, y) === 'grass') {
      const loc = getLocation(this.map.id);
      if (loc.encounters) { const enc = rollEncounter(loc.encounters, timeOfDay(this.app.state), makeRng(Date.now())); if (enc) this.onEncounter(enc.species, enc.level); }
    }
  }
  render() {
    const ctx = this.canvas.getContext('2d')!;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.fillStyle = '#0b0f17'; ctx.fillRect(0, 0, W, H);
    const camX = this.px * TS - W / 2, camY = this.py * TS - H / 2;
    for (let y = 0; y < this.map.tiles.length; y++) for (let x = 0; x < this.map.tiles[0].length; x++) {
      ctx.fillStyle = COLORS[tileAt(this.map, x, y)] ?? '#cdebb3';
      ctx.fillRect(x * TS - camX, y * TS - camY, TS - 2, TS - 2);
    }
    ctx.fillStyle = '#ff5a4d'; ctx.fillRect(this.px * TS - camX + 8, this.py * TS - camY + 6, TS - 18, TS - 14);
    ctx.fillStyle = '#fff'; ctx.font = '14px system-ui'; ctx.fillText(`${this.map.id} · ${timeOfDay(this.app.state)}`, 12, 22);
  }
}
```

- [ ] **Step 5: Wire `main.ts`** (overworld mount; battle handlers stubbed until Task 4)

```ts
import { GameApp } from './app/game-app';
import { OverworldScreen } from './overworld/overworld-screen';
const root = document.getElementById('game')!;
const canvas = document.createElement('canvas');
canvas.width = window.innerWidth; canvas.height = window.innerHeight;
root.appendChild(canvas);
const app = new GameApp();
const overworld = new OverworldScreen(canvas, app,
  (species, level) => console.log('ENCOUNTER', species, level),
  (gymId) => console.log('GYM', gymId),
  (npcId) => window.alert(`${npcId}: The Core remembers every trainer who walked here.`));
```

- [ ] **Step 6: Tests + dev server + screenshots**

Run: `npx vitest run web/app/game-app.test.ts` (PASS), then `npm run dev` (background).
Screenshot Aethel's Rest; walk to the exit; screenshot Whispering Path with its grass.
**Acceptance: screenshots show a tiled town, a movable player, and travel to the route.**

- [ ] **Step 7: Commit**

```bash
git add web/app web/overworld/overworld-screen.ts web/main.ts
git commit -m "feat(web): 2D overworld — render, tile-step movement, exits/grass/npc"
```

---

### Task 4: 3D battle scene + creature loader + HUD (wired to Bridge + AI)

**Files:** Create `web/assets/manifest.ts`, `web/battle/creature.ts`, `web/ui/hud.ts`, `web/battle/battle-screen.ts`; Modify `web/main.ts`

- [ ] **Step 1: `web/assets/manifest.ts`**

```ts
const id = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
export function spriteUrl(species: string, side: 'front' | 'back'): string {
  return `https://play.pokemonshowdown.com/sprites/${side === 'back' ? 'ani-back' : 'ani'}/${id(species)}.gif`;
}
// Drop a GLB at web/assets/models/<id>.glb to upgrade a species to true 3D; null = sprite billboard.
export function modelUrl(_species: string): string | null { return null; }
```

- [ ] **Step 2: `web/battle/creature.ts`**

```ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { spriteUrl, modelUrl } from '../assets/manifest';
export async function loadCreature(species: string, side: 'front' | 'back'): Promise<THREE.Object3D> {
  const url = modelUrl(species);
  if (url) { try { return (await new GLTFLoader().loadAsync(url)).scene; } catch { /* fall back */ } }
  const tex = await new THREE.TextureLoader().loadAsync(spriteUrl(species, side));
  tex.magFilter = THREE.NearestFilter;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  s.scale.set(2.4, 2.4, 1);
  return s;
}
```

- [ ] **Step 3: `web/ui/hud.ts`** (DOM overlay built with element APIs — no innerHTML)

```ts
import type { MoveOption } from '../../src/ai/types';
export interface HudHandlers { onMove: (index: number) => void; onCatch: () => void; }

function el(tag: string, style: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  e.style.cssText = style;
  if (text !== undefined) e.textContent = text;
  return e;
}

export class Hud {
  root: HTMLDivElement;
  constructor(parent: HTMLElement, private handlers: HudHandlers) {
    this.root = document.createElement('div');
    this.root.style.cssText = 'position:absolute;inset:0;pointer-events:none;font-family:system-ui';
    parent.appendChild(this.root);
  }
  render(o: { selfName: string; selfHp: number; foeName: string; foeHp: number; moves: MoveOption[]; canCatch: boolean; log: string }) {
    const bar = (name: string, hp: number, pos: string) => {
      const box = el('div', `position:absolute;${pos};background:#fff;border:2px solid #222;border-radius:8px;padding:4px 8px;min-width:150px;color:#222;font-size:13px`, name);
      box.appendChild(el('div', `height:6px;background:${hp > 30 ? '#37c24a' : '#e0b341'};width:${Math.max(0, hp)}%;border-radius:3px;margin-top:4px`));
      return box;
    };
    const panel = el('div', 'position:absolute;bottom:0;left:0;right:0;background:#26354a;padding:8px;color:#fff');
    panel.appendChild(el('div', 'min-height:20px;margin-bottom:6px;font-size:13px', o.log));
    const grid = el('div', 'display:grid;grid-template-columns:repeat(4,1fr);gap:6px');
    o.moves.forEach((m, i) => {
      const b = el('button', 'pointer-events:auto;background:#e8554a;color:#fff;border:0;border-radius:6px;padding:10px;font-size:13px', m.name);
      b.addEventListener('click', () => this.handlers.onMove(i));
      grid.appendChild(b);
    });
    panel.appendChild(grid);
    if (o.canCatch) {
      const cb = el('button', 'pointer-events:auto;margin-top:6px;background:#ffd36b;border:0;border-radius:6px;padding:8px 14px', 'Throw Ultra Ball');
      cb.addEventListener('click', () => this.handlers.onCatch());
      panel.appendChild(cb);
    }
    this.root.replaceChildren(bar(o.foeName, o.foeHp, 'top:14px;left:14px'), bar(o.selfName, o.selfHp, 'bottom:130px;right:14px'), panel);
  }
  clear() { this.root.replaceChildren(); }
}
```

- [ ] **Step 4: `web/battle/battle-screen.ts`**

```ts
import * as THREE from 'three';
import { BattleBridge } from '../../src/bridge/battle-bridge';
import { chooseAction } from '../../src/ai/decision-brain';
import { buildView } from '../../src/ai/view-from-bridge';
import { makeRng } from '../../src/ai/rng';
import { ownedToSet } from '../../src/game/projection';
import type { OwnedPokemon } from '../../src/game/types';
import type { PokemonSet, Action } from '../../src/bridge/types';
import { loadCreature } from './creature';
import { Hud } from '../ui/hud';

export class BattleScreen {
  private renderer = new THREE.WebGLRenderer({ antialias: true });
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  private bridge = new BattleBridge();
  private hud: Hud;
  private oppTeam: PokemonSet[] = [];
  private playerMon!: OwnedPokemon;

  constructor(private host: HTMLElement, private onEnd: (winner: 'p1' | 'p2', hpPercent: number, status: string) => void) {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.host.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color('#bfe9ff');
    const ground = new THREE.Mesh(new THREE.CircleGeometry(8, 32), new THREE.MeshStandardMaterial({ color: '#86c45a' }));
    ground.rotation.x = -Math.PI / 2; this.scene.add(ground);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x557755, 1.1));
    this.camera.position.set(0, 4.5, 7); this.camera.lookAt(0, 1, 0);
    this.hud = new Hud(this.host, { onMove: (i) => this.takeTurn({ kind: 'move', index: i + 1 }), onCatch: () => this.tryCatch() });
  }

  async start(playerMon: OwnedPokemon, oppTeam: PokemonSet[], isWild: boolean) {
    this.playerMon = playerMon; this.oppTeam = oppTeam;
    await this.bridge.startBattle([ownedToSet(playerMon)], oppTeam, { formatid: 'gen9customgame', isWild });
    const back = await loadCreature(playerMon.species, 'back'); back.position.set(-2.4, 1, 1); this.scene.add(back);
    const front = await loadCreature(this.bridge.state.active.p2!.species, 'front'); front.position.set(2.4, 1.4, -1.2); this.scene.add(front);
    this.loop(); this.refreshHud('Battle start!');
  }
  private loop = () => { this.renderer.render(this.scene, this.camera); if (this.bridge.state.winner === undefined) requestAnimationFrame(this.loop); };

  private refreshHud(log: string) {
    const c = this.bridge.getChoices('p1'); const s = this.bridge.state;
    this.hud.render({ selfName: `${s.active.p1!.species} L${this.playerMon.level}`, selfHp: s.active.p1!.hpPercent,
      foeName: `${s.active.p2!.species}`, foeHp: s.active.p2!.hpPercent, moves: c.moves, canCatch: c.canCatch, log });
  }
  private async takeTurn(playerAction: Action) {
    const view = buildView('p2', this.bridge.state, this.oppTeam, [ownedToSet(this.playerMon)], this.bridge.getChoices('p2').moves, []);
    const ai = chooseAction(view, { gen: 9, knobs: { randomness: 0.1, lookaheadDepth: 1, switchSmarts: 1 }, personality: { aggression: 1, caution: 0.5 }, rng: makeRng(Date.now()) });
    const res = await this.bridge.submitTurn(playerAction, ai);
    const log = res.events.filter((e) => e.type === 'move' || e.type === 'faint').map((e: any) => e.type === 'move' ? `${e.side} used ${e.move}` : `${e.side} fainted`).join(' · ');
    if (this.bridge.state.winner) return this.finish();
    this.refreshHud(log || '…');
  }
  private tryCatch() { const r = this.bridge.attemptCatch('ultra'); if (r.caught) { this.refreshHud('Caught!'); this.finish(); } else void this.takeTurn({ kind: 'move', index: 1 }); }
  private finish() { const p1 = this.bridge.finalConditions().p1[0]; this.hud.clear(); this.host.removeChild(this.renderer.domElement); this.onEnd(this.bridge.state.winner ?? 'p2', p1?.hpPercent ?? 0, p1?.status ?? ''); }
}
```

- [ ] **Step 5: Wire `main.ts`** — grass encounter opens a wild battle, then returns

```ts
import { BattleScreen } from './battle/battle-screen';
import { createOwned } from '../src/game/owned-pokemon';
import { ownedToSet } from '../src/game/projection';
import { applyBattleResult } from '../src/game/battle-result';
import { makeRng } from '../src/ai/rng';

function startWild(species: string, level: number) {
  app.setScreen('battle');
  const wild = createOwned({ species, level, moves: ['tackle'] });
  new BattleScreen(root, (winner, hp, status) => {
    const out = applyBattleResult(app.state, { won: winner === 'p1', finalConditions: [{ uid: app.state.party[0].uid, hpPercent: hp, status }], defeatedTeam: [{ species, level }], participantUids: [app.state.party[0].uid], isWild: true, rng: makeRng(1) });
    app.state = out.state; app.setScreen('overworld'); overworld.render();
  }).start(app.state.party[0], [ownedToSet(wild)], true);
}
```
Change the `OverworldScreen` construction's `onEncounter` arg to `startWild`.

- [ ] **Step 6: Dev server + screenshots**

Run: `npm run dev` (background). Walk into grass → 3D battle (field, two sprite
creatures, HUD). Click a move; screenshot mid-battle (HP changed); finish; screenshot
return to overworld. **Acceptance: screenshots show the 3D scene, creatures, working HUD,
HP changes, and return to the map.**

- [ ] **Step 7: Commit**

```bash
git add web/assets web/battle web/ui/hud.ts web/main.ts
git commit -m "feat(web): 3D battle scene wired to Bridge + AI (sprite billboards, GLB-ready)"
```

---

### Task 5: Gym battle + badge + slice loop close

**Files:** Modify `web/main.ts`

- [ ] **Step 1: Implement `startGym`**

```ts
import { getGym } from '../src/content/region';
import { composeTeam } from '../src/ai/team-composer';
import { grantBadge } from '../src/game/game-state';
import { recordTrainerDefeat } from '../src/game/rematch';

function startGym(gymId: string) {
  const gym = getGym(gymId);
  const team = composeTeam(gym.trainer, { gen: 9, counterDraftStrength: 0.3, rng: makeRng(7) });
  app.setScreen('battle');
  new BattleScreen(root, (winner, hp, status) => {
    if (winner === 'p1') {
      const out = applyBattleResult(app.state, { won: true, finalConditions: [{ uid: app.state.party[0].uid, hpPercent: hp, status }], defeatedTeam: team.map((s) => ({ species: s.species, level: s.level })), participantUids: [app.state.party[0].uid], isWild: false, trainer: { basePayout: gym.trainer.basePayout, tier: gym.trainer.baseTier }, rng: makeRng(1) });
      app.state = recordTrainerDefeat(grantBadge(out.state, gym.badgeId), gym.trainer.id);
      window.alert(`You won the ${gym.badgeId} badge!`);
    }
    app.setScreen('overworld'); overworld.render();
  }).start(app.state.party[0], team, false);
}
```
Change the `OverworldScreen` `onGym` arg to `startGym`.

- [ ] **Step 2: Dev server + full-slice screenshot run**

Run: `npm run dev` (background). Play: Aethel's Rest → Whispering Path (win a wild
battle) → Verdant Hollow → Bramble's gym (win) → badge alert. Screenshot each milestone.
**Acceptance: a screenshot series of the complete slice, including the badge.**

- [ ] **Step 3: Commit**

```bash
git add web/main.ts
git commit -m "feat(web): gym battle grants badge; vertical slice playable end-to-end"
```

---

### Task 6: Full suite + build + wrap

- [ ] **Step 1: Vitest + typecheck**

Run: `npm test && npm run typecheck`
Expected: all logic + the new web unit tests (tilemap, game-app) pass; `src` typecheck clean.

- [ ] **Step 2: Build the web app**

Run: `npm run build:web`
Expected: Vite builds `dist-web/` with no errors (this type-checks the `web/` app).

- [ ] **Step 3: README — how to run**

Append to `README.md`:
````markdown
## Play the vertical slice (sub-project 5a)

```bash
npm run dev      # http://localhost:5173 — walk Aethel's Rest, fight in 3D, win a badge
```

2D top-down overworld + 3D battles (real Bridge + adaptive AI). Creatures use Showdown's
animated sprites by default; drop a GLB at `web/assets/models/<id>.glb` to upgrade a
species to a true 3D model. Sub-projects 5b (full UI) and 5c (polish) follow.
````

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: how to run the 5a playable slice"
```

---

## Self-Review notes
- **Spec coverage:** app shell + screen machine (T1,T3); 2D overworld w/ tilemaps,
  movement, exits, grass→encounter, npc, clock step (T2,T3); 3D battle wired to
  Bridge+AI+applyBattleResult, HUD + GLB-or-sprite creatures (T4); gym→badge loop (T5);
  build/run (T6). Screenshot-verified per spec.
- **Asset risk settled:** Showdown animated sprites reachable (probed); GLB optional via
  fallback → 5a unblocked.
- **Deferred (5b/5c):** all other menus, switching/bag UI in battle (5a battle = move +
  catch only), full region maps, full-dex 3D models, polish/audio.
- **Pure pieces unit-tested:** tilemap loader, screen machine. Renderers screenshot-verified.
- **Type consistency:** `Screen`/`GameApp`, `TileMap`/`Tile`; reuses `BattleBridge`/
  `chooseAction`/`buildView`/`ownedToSet`/`applyBattleResult`/`composeTeam`/`getGym`/
  `rollEncounter`/`grantBadge`/`recordTrainerDefeat`/`finalConditions` from verified `src`.
```
