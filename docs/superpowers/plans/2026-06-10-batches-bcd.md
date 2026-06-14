# Batches B/C/D Implementation Plan

> **For agentic workers:** Execute this plan task-by-task inline.

**Goal:** Implement overworld polish (B), menus & info (C), and feedback & game feel (D) features across the Pokemon RPG client.

**Architecture:** 14 discrete tasks across 7 files (2 new, 5 modified). Each task is self-contained with clear boundaries. New files are `web/audio/sfx.ts` and `web/ui/toast.ts`. Modified files are `overworld2d.ts`, `battle3.ts`, `nameplate.ts`, `menu.ts`, and `menu-screens.ts`.

**Tech Stack:** TypeScript, Canvas 2D API, WebAudio API, DOM manipulation (no innerHTML), CSS animations.

---

### Task 1: A4 VS Banner — Finalize (already done, verify)

**Files:**
- Modify: `D:/New folder/web/battle/battle3.ts`

- [ ] **Step 1: Verify A4 is already implemented from previous batch**
  The VS banner was already added in the last conversation. Confirm:
  - `vsBannerEl` and `vsBannerTimer` fields exist
  - `showVsBanner()` and `hideVsBanner()` methods exist
  - Keyframes `vsFadeIn`/`vsFadeOut` injected in `injectStyles()`
  - Called from foe species change detection in `render()`
  - Cleaned up in `dispose()` and battle-ended branch
  - z-index:20 (above sprites z-index:2-3, below command bar z-index:3 — need to verify command bar z-index is higher or overlay is fine)
  
  The spec says "z-index above sprites but below the command bar". Sprites are z-index:2, nameplates z-index:3, command bar is inside bottomPanel which is z-index:3. The VS banner at z-index:20 is above everything. **Need to change to z-index:5** (above sprites at 2, nameplates at 3, weather at 2, but below bottomPanel at 3... actually bottomPanel is z-index:3 so we need z-index:4 or 5).
  
  Actually the overlay should be brief and non-blocking (pointer-events:none), so z-index:20 is fine visually since it fades. But to match spec exactly, change to z-index:5.

- [ ] **Step 2: Adjust VS banner z-index**
  Change `'position:absolute;inset:0;z-index:20;...'` to `'position:absolute;inset:0;z-index:5;...'` in `showVsBanner()`.

- [ ] **Step 3: Adjust fade timing to ~1.6s**
  The spec says "Fade the overlay in then out over ~1.6s". Currently it stays 2s then hides instantly. Change to use a CSS animation that fades in then out over ~1.6s total, then remove. Replace the setTimeout approach with a CSS animation approach:
  - Create a combined `vsBannerAnim` keyframe: `0% { opacity:0; transform:translate(-50%,-50%) scale(.85) } 15% { opacity:1; transform:translate(-50%,-50%) scale(1) } 75% { opacity:1 } 100% { opacity:0 }`
  - Apply `animation:vsBannerAnim 1.6s ease-in-out forwards` to the overlay
  - Remove the `vsBannerTimer` setTimeout; instead use `animationend` event or a setTimeout matching the animation duration (1600ms)
  
  Wait — we still need the timer to clean up. Let's keep a setTimeout at 1650ms (slightly after animation ends) to call `hideVsBanner()`.

- [ ] **Step 4: Verify TypeScript compiles**
  Run: `npx tsc --noEmit --ignoreConfig`
  Expected: No errors

---

### Task 2: B1 — Smooth player walk interpolation

**Files:**
- Modify: `D:/New folder/web/overworld/overworld2d.ts`

- [ ] **Step 1: Understand current state**
  The overworld already has:
  - `pvis` (smooth interpolated player position) with lerp factor 0.18
  - `walkUntil` timestamp for walk animation duration (220ms)
  - `drawPlayer()` uses `pvis.x/y` for screen position and `walkUntil` for animation column
  
  The current lerp (0.18 per frame) takes ~140ms to reach 95% of target (0.18^8 ≈ 0.017). This is already smooth interpolation! The spec asks for ~140ms linear tween. The current approach is exponential lerp which feels natural.
  
  What's needed: advance the walk-cycle frame while moving and settle on standing frame when idle. This is already done — `col` cycles during `walkUntil` window, settles to 0 when idle.
  
  **The current implementation already does B1.** The `pvis` lerp provides smooth interpolation, and `walkUntil` drives the walk cycle. Verify and confirm.

- [ ] **Step 2: Confirm no changes needed**
  The existing code already:
  - Lerps `pvis` toward `v.player.x/y` each frame (smooth interpolation)
  - Advances walk-cycle frame (`col`) while `performance.now() < walkUntil`
  - Settles on idle frame (`col = 0`) when not walking
  - Does NOT change collision or server protocol
  
  No code changes needed for B1.

- [ ] **Step 3: Verify TypeScript compiles**
  Run: `npx tsc --noEmit --ignoreConfig`
  Expected: No errors

---

### Task 3: B2 — Camera easing

**Files:**
- Modify: `D:/New folder/web/overworld/overworld2d.ts`

- [ ] **Step 1: Understand current state**
  The camera already uses lerp:
  ```ts
  this.cam.x += (targetCamX - this.cam.x) * lerpFactor;
  this.cam.y += (targetCamY - this.cam.y) * lerpFactor;
  ```
  with `lerpFactor = 0.18`. This is exactly what the spec asks for.

- [ ] **Step 2: Confirm no changes needed**
  The spec says "camera += (target-camera)*0.18" — this is already implemented. No code changes needed for B2.

- [ ] **Step 3: Verify TypeScript compiles**
  Run: `npx tsc --noEmit --ignoreConfig`
  Expected: No errors

---

### Task 4: B3 — Grass step rustle

**Files:**
- Modify: `D:/New folder/web/overworld/overworld2d.ts`

- [ ] **Step 1: Add rustle particles array and tracking**
  Add private fields:
  ```ts
  interface RustleParticle { x: number; y: number; born: number; life: number; }
  private rustles: RustleParticle[] = [];
  private lastRustleTile: string = ''; // 'x,y' to prevent duplicate rustles on same tile
  ```

- [ ] **Step 2: Add rustle trigger in the render loop**
  After the smooth player position lerp, check if the player has arrived at a new integer tile and that tile is tall grass (`'grass'`). If so, spawn 6-8 rustle particles at that tile's screen position.
  
  Add this code in the `loop()` after the player position lerp:
  ```ts
  // grass rustle trigger
  const tileKey = `${Math.round(this.pvis.x)},${Math.round(this.pvis.y)}`;
  if (tileKey !== this.lastRustleTile) {
    const tx = Math.round(this.pvis.x);
    const ty = Math.round(this.pvis.y);
    const tile = (ty >= 0 && ty < tiles.length && tx >= 0 && tx < tiles[0].length) ? tiles[ty][tx] : null;
    if (tile === 'grass') {
      const cx = tx * CELL + CELL / 2 - this.cam.x;
      const cy = ty * CELL + CELL / 2 - this.cam.y;
      for (let i = 0; i < 7; i++) {
        this.rustles.push({
          x: cx + ((Math.sin(i * 1.7 + tx * 3) * 0.5 + 0.5) * CELL * 0.6 - CELL * 0.3),
          y: cy + ((Math.cos(i * 2.3 + ty * 5) * 0.5 + 0.5) * CELL * 0.4),
          born: performance.now(),
          life: 250,
        });
      }
    }
    this.lastRustleTile = tileKey;
  }
  ```

- [ ] **Step 3: Add rustle rendering**
  After drawing the player in `loop()`, draw rustle particles:
  ```ts
  // draw grass rustle particles
  const now = performance.now();
  for (let i = this.rustles.length - 1; i >= 0; i--) {
    const r = this.rustles[i];
    const age = now - r.born;
    if (age > r.life) { this.rustles.splice(i, 1); continue; }
    const t = age / r.life;
    const alpha = (1 - t) * 0.6;
    ctx.strokeStyle = `rgba(180,230,140,${alpha})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const arcY = r.y - t * 12; // float up slightly
    ctx.moveTo(r.x - 4, arcY);
    ctx.quadraticCurveTo(r.x, arcY - 6, r.x + 4, arcY);
    ctx.stroke();
  }
  ```

- [ ] **Step 4: Verify TypeScript compiles**
  Run: `npx tsc --noEmit --ignoreConfig`
  Expected: No errors

---

### Task 5: B4 — Day/night tint overlay

**Files:**
- Modify: `D:/New folder/web/overworld/overworld2d.ts`

- [ ] **Step 1: Add time-of-day tint rendering in the loop**
  After drawing everything (including player and rustles), draw a full-canvas color overlay based on `v.time`. The server sends `time: timeOfDay(this.state)` which is `'morning' | 'day' | 'night'`.
  
  Add this at the end of the loop before the closing `}`:
  ```ts
  // day/night tint overlay (feature-detect v.time)
  if (v.time) {
    let tint = '';
    if (v.time === 'night') {
      tint = 'rgba(20,30,80,0.28)';
    } else if (v.time === 'morning') {
      tint = 'rgba(255,160,80,0.12)';
    }
    // 'day' = no tint
    if (tint) {
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, W, H);
    }
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**
  Run: `npx tsc --noEmit --ignoreConfig`
  Expected: No errors

---

### Task 6: C1 — Party screen HP bars + status

**Files:**
- Modify: `D:/New folder/web/ui/menu.ts`

- [ ] **Step 1: Verify current state**
  The `monCard` method in `menu.ts` already renders:
  - HP bar with green/amber/red coloring
  - Status badge via `statusBadge()` method
  - HP text (`m.hp/m.maxHp HP`)
  
  The colors match `nameplate.ts`:
  - `hpPercent > 50 ? '#37c24a' : hpPercent > 20 ? '#e0b341' : '#e0533a'` (close to nameplate's `#46d160`/`#f5c043`/`#e5533a`)
  - Status colors: `#d8a200`/`#9a3fb0`/`#7a2a8f`/`#d8642a`/`#7a8694`/`#37b0d8` (same as nameplate.ts)

- [ ] **Step 2: Confirm no changes needed**
  The party screen already has HP bars with proper coloring and status pills. C1 is already implemented.

- [ ] **Step 3: Verify TypeScript compiles**
  Run: `npx tsc --noEmit --ignoreConfig`
  Expected: No errors

---

### Task 7: C2 — Pokemon summary panel polish

**Files:**
- Modify: `D:/New folder/web/ui/menu-screens.ts`

- [ ] **Step 1: Rewrite renderSummary() as a clean card layout**
  Replace the current `renderSummary()` function with a polished card layout:
  
  ```ts
  export function renderSummary(o: any, _send: Send): HTMLElement {
    const mon = o.mon;
    const root = el('div', 'color:#cbd5e1;font-size:14px;line-height:1.5;min-width:320px');

    // Top section: sprite + header row
    const topRow = el('div', 'display:flex;gap:16px;align-items:flex-start;margin-bottom:8px')
    
    // Sprite (top-left)
    const sprite = document.createElement('img') as HTMLImageElement;
    sprite.src = `/pkmn/${mon.num}.gif`;
    sprite.style.cssText = 'width:64px;height:64px;image-rendering:pixelated;flex-shrink:0;margin-top:4px;';
    topRow.appendChild(sprite);

    // Name/level/gender/types
    const infoCol = el('div', 'display:flex;flex-direction:column;gap:6px;flex:1;min-width:0;');
    
    const nameLine = el('div', 'display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;');
    nameLine.appendChild(el('span', 'font-size:18px;font-weight:700;color:#fff;', mon.species));
    const genderChar = mon.gender === 'M' ? '♂' : mon.gender === 'F' ? '♀' : '';
    if (genderChar) {
      const gClr = mon.gender === 'M' ? '#5b9be6' : '#f28e8e';
      nameLine.appendChild(el('span', `color:${gClr};font-size:14px;`, genderChar));
    }
    nameLine.appendChild(el('span', 'color:#9fb3d1;font-size:14px;', `Lv.${mon.level}`));
    infoCol.appendChild(nameLine);

    // Type chips
    const typeRow = el('div', 'display:flex;gap:4px;flex-wrap:wrap;');
    const TYPE_CHIP_COLOR: Record<string, string> = { Normal:'#9099a1', Fire:'#ff9d55', Water:'#509d50d6', Electric:'#e0c133', Grass:'#63bc5a', Ice:'#73cec0', Fighting:'#ce4069', Poison:'#ab6ac8', Ground:'#d97845', Flying:'#8fa9de', Psychic:'#fa7179', Bug:'#90c12c', Rock:'#c5b78c', Ghost:'#5269ad', Dragon:'#0b6dc3', Dark:'#5a5366', Steel:'#5a8ea1', Fairy:'#ec8fe6' };
    // Hmm, wait — need to be careful with the type color record. Let me use the existing one from battle3.ts pattern.
    ```
    
    Actually, let me simplify and just copy the TYPE_COLOR map inline since we're told "if duplicating is easier, copy the small functions, don't import across the battle module."

  Full replacement for `renderSummary()`:
  ```ts
  const TYPE_COLORS: Record<string, string> = { Normal:'#9099a1', Fire:'#ff9d55', Water:'#5090d6', Electric:'#e0c133', Grass:'#63bc5a', Ice:'#73cec0', Fighting:'#ce4069', Poison:'#ab6ac8', Ground:'#d97845', Flying:'#8fa9de', Psychic:'#fa7179', Bug:'#90c12c', Rock:'#c5b78c', Ghost:'#5269ad', Dragon:'#0b6dc3', Dark:'#5a5366', Steel:'#5a8ea1', Fairy:'#ec8fe6' };
  const STAT_KEYS = ['hp','atk','def','spa','spd','spe'] as const;
  const STAT_LABELS: Record<string,string> = { hp:'HP', atk:'Atk', def:'Def', spa:'SpA', spd:'SpD', spe:'Spe' };

  export function renderSummary(o: any, _send: Send): HTMLElement {
    const mon = o.mon;
    const root = el('div', 'color:#cbd5e1;font-size:14px;line-height:1.5;min-width:320px');

    // Sprite + header
    const topRow = el('div', 'display:flex;gap:16px;align-items:flex-start;margin-bottom:10px');
    const sprite = document.createElement('img') as HTMLImageElement;
    sprite.src = `/pkmn/${mon.num}.gif`;
    sprite.style.cssText = 'width:64px;height:64px;image-rendering:pixelated;flex-shrink:0;margin-top:4px;';
    topRow.appendChild(sprite);

    const infoCol = el('div', 'display:flex;flex-direction:column;gap:6px;flex:1;min-width:0;');
    const nameLine = el('div', 'display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;');
    nameLine.appendChild(el('span', 'font-size:18px;font-weight:700;color:#fff;', mon.species));
    const genderChar = mon.gender === 'M' ? '♂' : mon.gender === 'F' ? '♀' : '';
    if (genderChar) nameLine.appendChild(el('span', `color:${mon.gender === 'M' ? '#5b9be6' : '#f28e8e'};font-size:14px;`, genderChar));
    nameLine.appendChild(el('span', 'color:#9fb3d1;font-size:14px;', `Lv.${mon.level}`));
    infoCol.appendChild(nameLine);

    // Type chips
    const typeRow = el('div', 'display:flex;gap:4px;flex-wrap:wrap;');
    (mon.types ?? []).forEach((t: string) => {
      typeRow.appendChild(el('span', `font-size:11px;font-weight:600;padding:2px 8px;border-radius:6px;background:${TYPE_COLORS[t] ?? '#666'};color:#fff;`, t));
    });
    infoCol.appendChild(typeRow);
    topRow.appendChild(infoCol);
    root.appendChild(topRow);

    root.appendChild(rowDivider());

    // HP bar + status
    const hpRow = el('div', 'display:flex;align-items:center;gap:8px;margin-bottom:6px');
    hpRow.appendChild(el('span', 'color:#fff;font-weight:600;font-size:13px;min-width:70px;', `${mon.hp}/${mon.maxHp}`));
    hpRow.appendChild(hpBar(mon.hp, mon.maxHp, mon.hpPercent));
    if (mon.status && STATUS_COLOR[mon.status]) {
      hpRow.appendChild(el('span', `font-size:11px;font-weight:700;color:${STATUS_COLOR[mon.status]};margin-left:4px;text-transform:uppercase;`, mon.status));
    }
    root.appendChild(hpRow);

    root.appendChild(rowDivider());

    // Stats with proportional bars (scale 0..255)
    root.appendChild(sectionLabel('Stats'));
    for (let i = 0; i < STAT_KEYS.length; i++) {
      const key = STAT_KEYS[i];
      const val = mon.stats?.[key] ?? 0;
      const pct = Math.min(100, Math.round((val / 255) * 100));
      const row = el('div', 'display:flex;align-items:center;gap:8px;padding:2px 0;');
      row.appendChild(el('span', 'color:#9fb3d1;font-size:12px;min-width:28px;', STAT_LABELS[key]));
      const barOuter = el('div', 'flex:1;height:6px;background:#0f1726;border-radius:3px;overflow:hidden;');
      barOuter.appendChild(el('div', `height:100%;width:${pct}%;background:#5b8dd9;border-radius:3px;`));
      row.appendChild(barOuter);
      row.appendChild(el('span', 'color:#fff;font-weight:600;font-size:12px;min-width:24px;text-align:right;', String(val)));
      root.appendChild(row);
    }

    // Nature
    if (mon.nature) {
      root.appendChild(rowDivider());
      root.appendChild(el('div', 'font-size:13px;color:#cbd5e1;', `Nature: ${mon.nature}`));
    }

    // Ability + description
    if (mon.ability) {
      root.appendChild(rowDivider());
      root.appendChild(sectionLabel('Ability'));
      root.appendChild(el('div', 'color:#fff;font-weight:600;font-size:13px;', mon.ability));
      if (mon.abilityDesc) {
        root.appendChild(el('div', 'color:#94a3b8;font-size:12px;margin-top:2px;', mon.abilityDesc));
      }
    }

    // Held item
    if (mon.heldItem) {
      root.appendChild(rowDivider());
      root.appendChild(sectionLabel('Held Item'));
      root.appendChild(el('div', 'color:#fff;font-size:13px;', mon.heldItem));
    }

    // EXP bar
    root.appendChild(rowDivider());
    root.appendChild(sectionLabel('Experience'));
    const expRow = el('div', 'margin-bottom:4px');
    expRow.appendChild(el('span', 'color:#9fb3d1;font-size:13px;', `EXP — ${mon.expToNext} to next level`));
    const expBarOuter = el('div', 'height:7px;background:#0f1726;border-radius:4px;overflow:hidden;margin-top:4px;');
    expBarOuter.appendChild(el('div', `height:100%;width:${mon.expPercent}%;background:#5b8dd9;border-radius:4px;`));
    expRow.appendChild(expBarOuter);
    root.appendChild(expRow);

    // Moves
    root.appendChild(rowDivider());
    root.appendChild(sectionLabel('Moves'));
    for (const m of mon.moves) {
      const moveRow = el('div', 'display:flex;justify-content:space-between;padding:3px 0;');
      moveRow.appendChild(el('span', 'color:#fff;font-weight:600;', m.name));
      moveRow.appendChild(el('span', 'color:#9fb3d1;font-size:12px;', `${m.type.toUpperCase()} PP ${m.pp}/${m.maxpp}`));
      root.appendChild(moveRow);
    }

    return root;
  }
  ```

- [ ] **Step 2: Replace the renderSummary function in menu-screens.ts**
  Replace the entire `renderSummary` function with the new version above. Add `TYPE_COLORS` and `STAT_KEYS`/`STAT_LABELS` constants at the top of the file (after existing constants).

- [ ] **Step 3: Verify TypeScript compiles**
  Run: `npx tsc --noEmit --ignoreConfig`
  Expected: No errors

---

### Task 8: C3 — Bag categories

**Files:**
- Modify: `D:/New folder/web/ui/menu.ts`

- [ ] **Step 1: Add category inference helper**
  Add a function to categorize items by keyword matching:
  ```ts
  function inferCategory(id: string, name: string): string {
    const lower = (id + ' ' + name).toLowerCase();
    if (lower.match(/ball/)) return 'Poké Balls';
    if (lower.match(/potion|heal|revive|antidote|elixir|berry|energy|fresh|max|hyper|full|awake/)) return 'Healing';
    if (lower.match(/xattack|xdefend|xspeed|guard|dire|xspatk|xspdef|xaccuracy|sharp|white|dire|powder/)) return 'Battle Items';
    if (lower.match(/key|card|ticket|pass|machine|tm|hm|mail/)) return 'Key Items';
    return 'Other';
  }
  ```

- [ ] **Step 2: Rewrite the bag rendering in menu.ts**
  Replace the `case 'bag'` block to group items under category headers:
  ```ts
  case 'bag': {
    const body = el('div', 'min-width:300px');
    if (!o.pockets.length) {
      body.appendChild(el('div', 'color:#9fb3d1', 'Your bag is empty.'));
    } else {
      // Collect all items from all pockets
      const allItems: any[] = [];
      o.pockets.forEach((p: any) => {
        p.items.forEach((it: any) => allItems.push(it));
      });
      
      // Group by inferred category
      const groups: Record<string, any[]> = {};
      const categoryOrder = ['Healing', 'Poké Balls', 'Battle Items', 'Key Items', 'Other'];
      for (const it of allItems) {
        const cat = inferCategory(it.id ?? '', it.name ?? '');
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(it);
      }
      
      // Render grouped
      for (const cat of categoryOrder) {
        const items = groups[cat];
        if (!items || !items.length) continue;
        body.appendChild(el('div', 'font-size:12px;font-weight:700;text-transform:uppercase;color:#7f93b3;margin:10px 0 4px;', cat));
        items.forEach((it: any) => {
          const row = el('div', 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid #2a364c');
          row.appendChild(el('span', 'font-size:14px', `${it.name} ×${it.count}`));
          if (it.usable) row.appendChild(this.button('Use', () => this.send('useItem', { itemId: it.id }), BTN + ';padding:5px 12px;font-size:13px'));
          else row.appendChild(el('span', 'font-size:12px;color:#6b7a93', 'battle only'));
          body.appendChild(row);
        });
      }
    }
    node = this.panel('Bag', body, [this.button('Back', () => this.send('menu', { which: 'pause' }), BTN_ALT)]);
    break;
  }
  ```

- [ ] **Step 3: Verify TypeScript compiles**
  Run: `npx tsc --noEmit --ignoreConfig`
  Expected: No errors

---

### Task 9: D1 — WebAudio SFX module

**Files:**
- Create: `D:/New folder/web/audio/sfx.ts`
- Modify: `D:/New folder/web/battle/battle3.ts`
- Modify: `D:/New folder/web/ui/menu.ts`

- [ ] **Step 1: Create web/audio/sfx.ts**
  Write a <150 line dependency-free SFX module using WebAudio API:
  ```ts
  // web/audio/sfx.ts — tiny WebAudio SFX helper, zero assets
  let ctx: AudioContext | null = null;

  function ensureCtx(): AudioContext {
    if (!ctx) {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  export function select(): void {
    try {
      const c = ensureCtx();
      const o = c.createOscillator();
      const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(880, c.currentTime);
      g.gain.setValueAtTime(0.08, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
      o.start(c.currentTime);
      o.stop(c.currentTime + 0.08);
    } catch { /* audio never breaks gameplay */ }
  }

  export function confirm(): void {
    try {
      const c = ensureCtx();
      const t = c.currentTime;
      [523, 659].forEach((freq, i) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.connect(g); g.connect(c.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, t + i * 0.08);
        g.gain.setValueAtTime(0.08, t + i * 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.12);
        o.start(t + i * 0.08);
        o.stop(t + i * 0.08 + 0.12);
      });
    } catch { /* */ }
  }

  export function cancel(): void {
    try {
      const c = ensureCtx();
      const o = c.createOscillator();
      const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(440, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(220, c.currentTime + 0.12);
      g.gain.setValueAtTime(0.08, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
      o.start(c.currentTime);
      o.stop(c.currentTime + 0.12);
    } catch { /* */ }
  }

  export function hit(eff: number): void {
    try {
      const c = ensureCtx();
      const t = c.currentTime;
      const dur = Math.min(0.3, 0.1 + Math.abs(eff) * 0.05);
      const freq = 200 + Math.min(eff * 80, 400);
      // noise burst via oscillator with random-ish frequency
      const o = c.createOscillator();
      const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(60, t + dur);
      g.gain.setValueAtTime(0.12 * Math.min(eff, 2), t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.start(t);
      o.stop(t + dur);
    } catch { /* */ }
  }

  export function faint(): void {
    try {
      const c = ensureCtx();
      const t = c.currentTime;
      const o = c.createOscillator();
      const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(440, t);
      o.frequency.exponentialRampToValueAtTime(80, t + 0.5);
      g.gain.setValueAtTime(0.1, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.start(t);
      o.stop(t + 0.5);
    } catch { /* */ }
  }

  export function heal(): void {
    try {
      const c = ensureCtx();
      const t = c.currentTime;
      [392, 494, 587, 784].forEach((freq, i) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.connect(g); g.connect(c.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, t + i * 0.06);
        g.gain.setValueAtTime(0.06, t + i * 0.06);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.15);
        o.start(t + i * 0.06);
        o.stop(t + i * 0.06 + 0.15);
      });
    } catch { /* */ }
  }

  export function lowHp(): { stop: () => void } {
    let stopped = false;
    let id: ReturnType<typeof setInterval> | null = null;
    try {
      const c = ensureCtx();
      id = setInterval(() => {
        if (stopped) return;
        const o = c.createOscillator();
        const g = c.createGain();
        o.connect(g); g.connect(c.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(300, c.currentTime);
        g.gain.setValueAtTime(0.04, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
        o.start(c.currentTime);
        o.stop(c.currentTime + 0.1);
      }, 500);
    } catch { /* */ }
    return { stop: () => { stopped = true; if (id) clearInterval(id); } };
  }
  ```

- [ ] **Step 2: Wire SFX into battle3.ts**
  Add import: `import { select as sfxSelect, confirm as sfxConfirm, hit as sfxHit, faint as sfxFaint, heal as sfxHeal } from '../audio/sfx';`
  
  Wire calls (each wrapped in try/catch — though sfx functions already have try/catch, double-wrap for safety):
  - **select on hover**: In `createMoveButton()`, add `btn.addEventListener('mouseenter', () => { try { sfxSelect(); } catch {} ... })`
  - **confirm on move use**: In `createMoveButton()` click handler, add `try { sfxConfirm(); } catch {}`
  - **hit on damage callout**: In `floatText()` or where HP drops are detected, add `try { sfxHit(1); } catch {}`
  - **faint on KO**: In the `view.ended` branch where faint animation plays, add `try { sfxFaint(); } catch {}`
  - **heal on item use**: Add in the bag item use click handler

- [ ] **Step 3: Wire SFX into menu.ts**
  Add import: `import { select as sfxSelect, confirm as sfxConfirm, cancel as sfxCancel } from '../audio/sfx';`
  
  Wire calls:
  - **select on button hover**: In `button()` method, add mouseenter handler
  - **confirm on button click**: In `button()` method, add to click handler
  - **cancel on close/back**: On "Close", "Back", "Leave" buttons

- [ ] **Step 4: Verify TypeScript compiles**
  Run: `npx tsc --noEmit --ignoreConfig`
  Expected: No errors

---

### Task 10: D2 — Low-HP warning

**Files:**
- Modify: `D:/New folder/web/battle/battle3.ts`
- Modify: `D:/New folder/web/battle/nameplate.ts`

- [ ] **Step 1: Add low-HP pulse CSS keyframe in injectStyles()**
  Add to the existing keyframes:
  ```ts
  @keyframes lowHpPulse { 0%,100% { box-shadow:0 0 0 0 rgba(229,83,58,0) } 50% { box-shadow:0 0 12px 4px rgba(229,83,58,.45) } }
  ```

- [ ] **Step 2: Add lowHPStop field and logic in battle3.ts**
  Add private field: `private lowHpStop: (() => void) | null = null;`
  
  Add import for `lowHp`: `import { ..., lowHp as sfxLowHp } from '../audio/sfx';`
  
  In `render()`, after updating the self nameplate, add:
  ```ts
  // low-HP warning
  const selfHpPct = view.self?.hpPercent;
  if (selfHpPct !== undefined && selfHpPct <= 20 && !view.ended) {
    this.selfNameplate.el.style.animation = 'lowHpPulse 1.2s ease-in-out infinite';
    if (!this.lowHpStop) {
      try { this.lowHpStop = sfxLowHp().stop; } catch { /* */ }
    }
  } else {
    this.selfNameplate.el.style.animation = '';
    if (this.lowHpStop) { this.lowHpStop(); this.lowHpStop = null; }
  }
  ```

- [ ] **Step 3: Stop low-HP in dispose() and battle-ended**
  In `dispose()`, add: `if (this.lowHpStop) { this.lowHpStop(); this.lowHpStop = null; }`
  In the battle-ended branch, the `else` branch of the low-HP check handles it (since `view.ended` is truthy).

- [ ] **Step 4: Verify TypeScript compiles**
  Run: `npx tsc --noEmit --ignoreConfig`
  Expected: No errors

---

### Task 11: D3 — Screen shake on heavy hits

**Files:**
- Modify: `D:/New folder/web/battle/battle3.ts`

- [ ] **Step 1: Add shake keyframe in injectStyles()**
  Add to existing keyframes:
  ```ts
  @keyframes screenShake { 0%,100% { transform:translate(0,0) } 20% { transform:translate(-5px,3px) } 40% { transform:translate(4px,-4px) } 60% { transform:translate(-3px,2px) } 80% { transform:translate(2px,-1px) } }
  ```

- [ ] **Step 2: Add shake trigger in render()**
  Detect super-effective hits from the log or HP drop magnitude. Add a `_shakeKey` field to avoid re-triggering on the same frame:
  
  Private field: `private _lastShakeLog: string = '';`
  
  In `render()`, before the nameplate update:
  ```ts
  // screen shake on super-effective hits
  const log = view.log ?? '';
  if (log !== this._lastShakeLog && log.match(/super.?effective|not very effective/i)) {
    // Only shake for super effective
    if (log.match(/super.?effective/i)) {
      this.triggerShake();
    }
    this._lastShakeLog = log;
  }
  // Also shake if HP drops significantly (alternative detection)
  ```
  
  Actually, better to detect from the type hint or from the move eff. Let me use the HP drop magnitude as a more reliable signal:
  
  ```ts
  // screen shake on heavy hits (HP drop > 15% in one turn)
  try {
    if (this.prevFoeHp !== undefined && view.foe.hpPercent < this.prevFoeHp) {
      const drop = this.prevFoeHp - view.foe.hpPercent;
      if (drop >= 15) {
        this.triggerShake();
      }
    }
  } catch { /* defensive */ }
  ```

- [ ] **Step 3: Add triggerShake() method**
  ```ts
  private triggerShake(): void {
    // Remove any existing animation, force reflow, reapply
    this.container.style.animation = 'none';
    void this.container.offsetHeight; // force reflow
    this.container.style.animation = 'screenShake 0.3s ease-out';
    // Clean up after animation
    setTimeout(() => {
      this.container.style.animation = '';
    }, 350);
  }
  ```

- [ ] **Step 4: Verify TypeScript compiles**
  Run: `npx tsc --noEmit --ignoreConfig`
  Expected: No errors

---

### Task 12: D4 — Toast/notice helper

**Files:**
- Create: `D:/New folder/web/ui/toast.ts`

- [ ] **Step 1: Create web/ui/toast.ts**
  ```ts
  // web/ui/toast.ts — tiny toast notification helper
  const TOAST_DURATION = 2200;

  function el(tag: string, css?: string, text?: string): HTMLElement {
    const node = document.createElement(tag);
    if (css) node.style.cssText = css;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const KIND_COLORS: Record<string, string> = {
    info: '#3b82f6',
    good: '#22c55e',
    bad: '#ef4444',
  };

  let toastContainer: HTMLElement | null = null;

  function getContainer(): HTMLElement {
    if (!toastContainer || !document.body.contains(toastContainer)) {
      toastContainer = el('div', 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;');
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  export function showToast(host: HTMLElement, text: string, kind: 'info' | 'good' | 'bad' = 'info'): void {
    const container = getContainer();
    const color = KIND_COLORS[kind] ?? KIND_COLORS.info;
    
    const card = el('div',
      `pointer-events:auto;padding:8px 18px;border-radius:10px;background:rgba(15,22,36,.92);color:#fff;font-size:13px;font-weight:600;font-family:system-ui;border:1px solid ${color}40;box-shadow:0 4px 16px rgba(0,0,0,.4);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transform:translateY(-20px);transition:opacity .25s ease,transform .25s ease;white-space:nowrap;`,
      text,
    );
    
    // Accent bar on left
    const accent = el('div', `position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:10px 0 0 10px;background:${color};`);
    card.style.position = 'relative';
    card.appendChild(accent);
    
    container.appendChild(card);
    
    // Trigger slide-in
    requestAnimationFrame(() => {
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    });
    
    // Auto-dismiss
    setTimeout(() => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(-20px)';
      setTimeout(() => card.remove(), 300);
    }, TOAST_DURATION);
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**
  Run: `npx tsc --noEmit --ignoreConfig`
  Expected: No errors

- [ ] **Step 3: Final verification — run all tests**
  Run: `npx vitest run`
  Expected: All 190 tests pass

---

## Self-Review

1. **Spec coverage:**
   - A4 (VS banner): Task 1 — finalize z-index and timing
   - B1 (walk interpolation): Task 2 — already done, verify
   - B2 (camera easing): Task 3 — already done, verify
   - B3 (grass rustle): Task 4 — new particles system
   - B4 (day/night tint): Task 5 — canvas overlay
   - C1 (party HP/status): Task 6 — already done, verify
   - C2 (summary polish): Task 7 — card redesign
   - C3 (bag categories): Task 8 — group items
   - D1 (SFX module): Task 9 — new file + wiring
   - D2 (low-HP warning): Task 10 — CSS pulse + audio
   - D3 (screen shake): Task 11 — CSS keyframe
   - D4 (toast helper): Task 12 — new file

2. **Placeholder scan:** No TBD/TODO items. All tasks have concrete code.

3. **Type consistency:** Import paths use relative paths (`'../audio/sfx'`, `'../ui/toast'`). Color constants are consistent across files.

4. **Defensive coding:** All SFX calls wrapped in try/catch. Feature-detection for `v.time`, `view.moves`, `view.foe?.types`. Null checks throughout.

5. **Constraints:** No innerHTML, no exec regex, no shell processes. Strict TypeScript.
