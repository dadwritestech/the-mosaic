// ── tileset lookup ──────────────────────────────────────────────
const GRASS_GROUND: [number, number] = [0, 3];
const TALL_GRASS: [number, number]   = [0, 6];
const PATH: [number, number]         = [13, 3];
const TREE: [number, number]         = [1, 7];

// ── sprite sheet constants ──────────────────────────────────────
const TILE_SRC = 32;   // source tile size in tileset
const CELL     = 48;   // screen cell size

// boy_run.png is 128×192 = 4 cols × 4 rows, each frame 32×48
const BOY_FRAMES_W = 4;
const BOY_FRAMES_H = 4;
const BOY_SRC_W = 32;
const BOY_SRC_H = 48;

// direction → row index  (0=down, 1=left, 2=right, 3=up)
const DIR_ROW: Record<string, number> = { down: 0, left: 1, right: 2, up: 3 };

// grass-rustle particle
interface RustleParticle { x: number; y: number; born: number; life: number; }

// ── class ───────────────────────────────────────────────────────
export class OverworldScreen2D {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rafId = 0;

  private hudBar: HTMLDivElement;
  private hudMsg: HTMLDivElement;

  private onMove: (dir: 'up' | 'down' | 'left' | 'right') => void;

  // images
  private imgTileset!: HTMLImageElement;
  private imgBoy!: HTMLImageElement;
  private imgBuilding!: HTMLImageElement;

  // state
  private view: any = null;

  // smooth player position (interpolated tile coords)
  private pvis = { x: 0, y: 0 };

  // smooth camera (screen px)
  private cam = { x: 0, y: 0 };

  // input / animation
  private facing = 'down';
  private walkUntil = 0;

  // grass rustle particles
  private rustles: RustleParticle[] = [];
  private lastRustleTile = '';

  private keyHandler: ((e: KeyboardEvent) => void) | null;
  private resizeHandler: (() => void) | null;

  // ── constructor ───────────────────────────────────────────────
  constructor(host: HTMLElement, onMove: (dir: 'up' | 'down' | 'left' | 'right') => void) {
    this.onMove = onMove;

    // ── canvas ──────────────────────────────────────────────────
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.inset = '0';
    this.canvas.style.imageRendering = 'pixelated';
    this.canvas.style.display = 'none';
    host.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;

    this.resizeCanvas();
    this.resizeHandler = () => this.resizeCanvas();
    window.addEventListener('resize', this.resizeHandler);

    // ── HUD overlays ────────────────────────────────────────────
    this.hudBar = document.createElement('div');
    this.hudBar.style.position = 'absolute';
    this.hudBar.style.top = '0';
    this.hudBar.style.left = '0';
    this.hudBar.style.right = '0';
    this.hudBar.style.padding = '4px 10px';
    this.hudBar.style.background = 'rgba(0,0,0,.65)';
    this.hudBar.style.color = '#fff';
    this.hudBar.style.font = '13px/1.4 monospace';
    this.hudBar.style.pointerEvents = 'none';
    this.hudBar.style.whiteSpace = 'nowrap';
    this.hudBar.style.overflow = 'hidden';
    this.hudBar.style.textOverflow = 'ellipsis';
    this.hudBar.style.display = 'none';
    host.appendChild(this.hudBar);

    this.hudMsg = document.createElement('div');
    this.hudMsg.style.position = 'absolute';
    this.hudMsg.style.bottom = '18px';
    this.hudMsg.style.left = '50%';
    this.hudMsg.style.transform = 'translateX(-50%)';
    this.hudMsg.style.maxWidth = '80%';
    this.hudMsg.style.padding = '8px 16px';
    this.hudMsg.style.background = 'rgba(0,0,0,.75)';
    this.hudMsg.style.color = '#fff';
    this.hudMsg.style.font = '14px/1.4 monospace';
    this.hudMsg.style.borderRadius = '6px';
    this.hudMsg.style.pointerEvents = 'none';
    this.hudMsg.style.display = 'none';
    host.appendChild(this.hudMsg);

    // ── key handler ─────────────────────────────────────────────
    const dirMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    };
    this.keyHandler = (e: KeyboardEvent) => {
      const dir = dirMap[e.key];
      if (!dir) return;
      e.preventDefault();
      this.facing = dir;
      this.walkUntil = performance.now() + 220;
      onMove(dir);
    };
    window.addEventListener('keydown', this.keyHandler);

    // ── load images ─────────────────────────────────────────────
    this.imgTileset  = this.loadImage('/2d/Outside.png');
    this.imgBoy      = this.loadImage('/2d/boy_run.png');
    this.imgBuilding = this.loadImage('/2d/building.png');

    // ── start rAF loop ──────────────────────────────────────────
    this.loop();
  }

  // ── render (called by app on every server view update) ────────
  render(view: any): void {
    this.view = view;
    this.updateHUD(view);
  }

  // ── show / hide ───────────────────────────────────────────────
  show(): void {
    this.canvas.style.display = '';
    this.hudBar.style.display = '';
  }

  hide(): void {
    this.canvas.style.display = 'none';
    this.hudBar.style.display = 'none';
    this.hudMsg.style.display = 'none';
  }

  // ── dispose ───────────────────────────────────────────────────
  dispose(): void {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;

    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    this.canvas.remove();
    this.hudBar.remove();
    this.hudMsg.remove();
  }

  // ═══════════════════════════════════════════════════════════════
  //  private helpers
  // ═══════════════════════════════════════════════════════════════

  private loadImage(src: string): HTMLImageElement {
    const img = new Image();
    img.src = src;
    return img;
  }

  private resizeCanvas(): void {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  // ── HUD update ────────────────────────────────────────────────
  private updateHUD(v: any): void {
    const partyText = (v.party || [])
      .map((m: any) => `${m.species} L${m.level} ${m.hpPercent}%`)
      .join('   ');

    this.hudBar.textContent = `${v.locationId}  ·  ${v.time}  ·  badges:${(v.badges || []).length}  ·  ${v.money}₽  ·  ${partyText}`;

    if (v.message && v.message !== '') {
      this.hudMsg.textContent = v.message;
      this.hudMsg.style.display = '';
    } else {
      this.hudMsg.style.display = 'none';
    }
  }

  // ── rAF loop ──────────────────────────────────────────────────
  private loop = (): void => {
    this.rafId = requestAnimationFrame(this.loop);

    if (this.canvas.style.display === 'none') return;
    const v = this.view;
    if (!v) return;

    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // ── smooth player position ──────────────────────────────────
    const targetX = v.player.x;
    const targetY = v.player.y;
    const lerpFactor = 0.18;
    this.pvis.x += (targetX - this.pvis.x) * lerpFactor;
    this.pvis.y += (targetY - this.pvis.y) * lerpFactor;

    const tiles: any = v.tiles;
    if (!tiles || !tiles.length) return;

    // ── grass rustle trigger (when player arrives at a new grass tile) ──
    const rtx = Math.round(this.pvis.x);
    const rty = Math.round(this.pvis.y);
    const tileKey = rtx + ',' + rty;
    if (tileKey !== this.lastRustleTile) {
      const tile = (rty >= 0 && rty < tiles.length && rtx >= 0 && rtx < tiles[0].length) ? tiles[rty][rtx] : null;
      if (tile === 'grass') {
        const cx = rtx * CELL + CELL / 2 - this.cam.x;
        const cy = rty * CELL + CELL / 2 - this.cam.y;
        for (let i = 0; i < 7; i++) {
          this.rustles.push({
            x: cx + ((Math.sin(i * 1.7 + rtx * 3) * 0.5 + 0.5) * CELL * 0.6 - CELL * 0.3),
            y: cy + ((Math.cos(i * 2.3 + rty * 5) * 0.5 + 0.5) * CELL * 0.4),
            born: performance.now(),
            life: 250,
          });
        }
      }
      this.lastRustleTile = tileKey;
    }

    // ── smooth camera (center on player in screen px) ───────────
    const playerScreenX = this.pvis.x * CELL + CELL / 2;
    const playerScreenY = this.pvis.y * CELL + CELL / 2;
    const targetCamX = playerScreenX - W / 2;
    const targetCamY = playerScreenY - H / 2;
    this.cam.x += (targetCamX - this.cam.x) * lerpFactor;
    this.cam.y += (targetCamY - this.cam.y) * lerpFactor;

    // ── clear ───────────────────────────────────────────────────
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);

    // ── visible tile range ──────────────────────────────────────
    const startTX = Math.floor(this.cam.x / CELL) - 1;
    const startTY = Math.floor(this.cam.y / CELL) - 1;
    const endTX   = startTX + Math.ceil(W / CELL) + 2;
    const endTY   = startTY + Math.ceil(H / CELL) + 2;

    // ── pass 1: ground layer ────────────────────────────────────
    for (let ty = startTY; ty < endTY; ty++) {
      for (let tx = startTX; tx < endTX; tx++) {
        const tile = (ty >= 0 && ty < tiles.length && tx >= 0 && tx < tiles[0].length) ? tiles[ty][tx] : 'field';
        const [row, col] = this.groundTileType(tile);
        if (!this.imgTileset.complete) continue;

        const sx = col * TILE_SRC;
        const sy = row * TILE_SRC;
        const dx = tx * CELL - this.cam.x;
        const dy = ty * CELL - this.cam.y;

        ctx.drawImage(this.imgTileset, sx, sy, TILE_SRC, TILE_SRC, dx, dy, CELL, CELL);

        // subtle grass flecks on plain grass cells
        if (tile === 'field') {
          const h = ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
          if (h % 6 === 0) {
            const fleckSize = 2 + (h % 2); // 2 or 3 px
            const fx = dx + ((h * 17) % (CELL - fleckSize));
            const fy = dy + ((h * 31) % (CELL - fleckSize));
            ctx.fillStyle = 'rgba(60,110,60,0.18)';
            ctx.fillRect(fx, fy, fleckSize, fleckSize);
          }
        }
      }
    }

    // ── pass 2: object layer (top-to-bottom for overlap) ────────
    for (let ty = startTY; ty < endTY; ty++) {
      for (let tx = startTX; tx < endTX; tx++) {
        const tile = (ty >= 0 && ty < tiles.length && tx >= 0 && tx < tiles[0].length) ? tiles[ty][tx] : null;
        if (!tile) continue;

        const dx = tx * CELL - this.cam.x;
        const dy = ty * CELL - this.cam.y;

        switch (tile) {
          case 'wall':
            this.drawTree(ctx, dx, dy);
            break;
          case 'center':
          case 'shop':
          case 'gym':
            this.drawBuilding(ctx, dx, dy);
            break;
          case 'npc':
            this.drawNPC(ctx, dx, dy);
            break;
        }
      }
    }

    // ── draw player ─────────────────────────────────────────────
    this.drawPlayer(ctx);

    // ── draw grass rustle particles ─────────────────────────────
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
      const arcY = r.y - t * 12;
      ctx.moveTo(r.x - 4, arcY);
      ctx.quadraticCurveTo(r.x, arcY - 6, r.x + 4, arcY);
      ctx.stroke();
    }

    // ── day/night tint overlay (feature-detect v.time) ──────────
    if (v.time) {
      let tint: string | undefined;
      if (v.time === 'night') {
        tint = 'rgba(20,30,80,0.28)';
      } else if (v.time === 'morning') {
        tint = 'rgba(255,160,80,0.12)';
      }
      if (tint) {
        ctx.fillStyle = tint;
        ctx.fillRect(0, 0, W, H);
      }
    }
  };

  // ── ground tile type → [row, col] in tileset ──────────────────
  private groundTileType(tile: string): [number, number] {
    if (tile === 'floor' || tile === 'exit') return PATH;
    if (tile === 'grass') return TALL_GRASS;
    return GRASS_GROUND;
  }

  // ── draw TREE object ──────────────────────────────────────────
  private drawTree(ctx: CanvasRenderingContext2D, dx: number, dy: number): void {
    const [row, col] = TREE;
    const sx = col * TILE_SRC;
    const sy = row * TILE_SRC;
    const treeH = CELL * 1.3;
    const treeY = dy + CELL - treeH; // bottom-anchored
    ctx.drawImage(this.imgTileset, sx, sy, TILE_SRC, TILE_SRC, dx, treeY, CELL, treeH);
  }

  // ── draw building ─────────────────────────────────────────────
  private drawBuilding(ctx: CanvasRenderingContext2D, dx: number, dy: number): void {
    if (!this.imgBuilding.complete) return;
    const bW = CELL * 2.4;
    const bH = bW * (288 / 230); // keep aspect
    const bx = dx + CELL / 2 - bW / 2; // bottom-center anchored
    const by = dy + CELL - bH;
    ctx.drawImage(this.imgBuilding, bx, by, bW, bH);
  }

  // ── draw NPC (standing player sprite, down-facing, frame 0) ───
  private drawNPC(ctx: CanvasRenderingContext2D, dx: number, dy: number): void {
    if (!this.imgBoy.complete) return;
    const row = DIR_ROW['down']; // 0
    const col = 0; // idle frame
    const srcX = col * BOY_SRC_W;
    const srcY = row * BOY_SRC_H;
    const dW = CELL;
    const dH = CELL * 1.5;
    const dX = dx + CELL / 2 - dW / 2;
    const dY = dy + CELL / 2 - dH / 2 + CELL * 0.1; // feet near bottom
    ctx.drawImage(this.imgBoy, srcX, srcY, BOY_SRC_W, BOY_SRC_H, dX, dY, dW, dH);
  }

  // ── draw player ───────────────────────────────────────────────
  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    if (!this.imgBoy.complete) return;

    const row = DIR_ROW[this.facing];

    // animation column
    let col = 0;
    if (performance.now() < this.walkUntil) {
      col = Math.floor(performance.now() / 90) % BOY_FRAMES_W;
    }

    const srcX = col * BOY_SRC_W;
    const srcY = row * BOY_SRC_H;

    const dW = CELL;
    const dH = CELL * 1.5;

    // screen position from interpolated player
    const screenX = this.pvis.x * CELL + CELL / 2;
    const screenY = this.pvis.y * CELL + CELL / 2;

    const dX = screenX - this.cam.x - dW / 2;
    const dY = screenY - this.cam.y - dH / 2 + CELL * 0.1;

    ctx.drawImage(this.imgBoy, srcX, srcY, BOY_SRC_W, BOY_SRC_H, dX, dY, dW, dH);
  }
}
