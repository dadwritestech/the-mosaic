import type { View } from '../net';

const TS = 48; // tile size in px

// Deterministic per-tile pseudo-random in [0,1) — stable across frames so
// texture detail (grass blades, speckles) doesn't flicker.
function tileRand(x: number, y: number, i: number): number {
  let h = (x * 374761393 + y * 668265263 + i * 0x9e3779b1) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export class OverworldScreen {
  private view: View | null = null;
  private facing: 'up' | 'down' | 'left' | 'right' = 'down';
  private stepToggle = false;     // alternates each step for the walk cycle
  private walkUntil = 0;          // timestamp until which the walk bob plays
  private cam = { x: 0, y: 0 };   // smoothed camera (world px of top-left)
  private camInit = false;

  constructor(private canvas: HTMLCanvasElement, private onMove: (dir: string) => void) {
    window.addEventListener('keydown', (e) => {
      const d: Record<string, 'up' | 'down' | 'left' | 'right'> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
      const dir = d[e.key];
      if (dir) {
        e.preventDefault();
        this.facing = dir;
        this.stepToggle = !this.stepToggle;
        this.walkUntil = performance.now() + 240;
        this.onMove(dir);
      }
    });
    requestAnimationFrame(this.loop);
  }

  render(view: View) { this.view = view; }

  private loop = () => {
    requestAnimationFrame(this.loop);
    if (this.canvas.style.display === 'none' || !this.view) return;
    this.paint(performance.now() / 1000);
  };

  // ---- tile painters ------------------------------------------------------

  private grass(ctx: CanvasRenderingContext2D, px: number, py: number, x: number, y: number) {
    ctx.fillStyle = '#7cc36a'; ctx.fillRect(px, py, TS, TS);
    ctx.fillStyle = '#6bb35a';
    for (let i = 0; i < 5; i++) {
      const bx = px + tileRand(x, y, i) * (TS - 6) + 2;
      const by = py + tileRand(x, y, i + 9) * (TS - 8) + 4;
      ctx.fillRect(bx, by, 2, 4);
    }
    ctx.fillStyle = '#8ace79';
    for (let i = 0; i < 3; i++) {
      const bx = px + tileRand(x, y, i + 20) * (TS - 4) + 1;
      const by = py + tileRand(x, y, i + 27) * (TS - 4) + 1;
      ctx.fillRect(bx, by, 2, 2);
    }
  }

  private tallGrass(ctx: CanvasRenderingContext2D, px: number, py: number, x: number, y: number, t: number) {
    this.grass(ctx, px, py, x, y);
    const sway = Math.sin(t * 2 + x * 0.7 + y * 0.3) * 2;
    ctx.fillStyle = '#3f8f34';
    for (let i = 0; i < 7; i++) {
      const bx = px + tileRand(x, y, i + 40) * (TS - 6) + 3;
      const by = py + 10 + tileRand(x, y, i + 47) * (TS - 18);
      ctx.beginPath();
      ctx.moveTo(bx, by + 12);
      ctx.lineTo(bx + sway, by);
      ctx.lineTo(bx + 4, by + 12);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#2e7a28'; ctx.fillRect(px, py + TS - 4, TS, 4);
  }

  private path(ctx: CanvasRenderingContext2D, px: number, py: number, x: number, y: number) {
    ctx.fillStyle = '#d9c28c'; ctx.fillRect(px, py, TS, TS);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = tileRand(x, y, i) > 0.5 ? '#cdb47c' : '#e6d2a2';
      const bx = px + tileRand(x, y, i + 3) * (TS - 4);
      const by = py + tileRand(x, y, i + 11) * (TS - 4);
      ctx.fillRect(bx, by, 3, 3);
    }
  }

  private water(ctx: CanvasRenderingContext2D, px: number, py: number, t: number) {
    ctx.fillStyle = '#3f7fd6'; ctx.fillRect(px, py, TS, TS);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
    for (let r = 0; r < 3; r++) {
      const wy = py + 10 + r * 14 + Math.sin(t * 2 + r) * 2;
      const off = Math.sin(t * 1.5 + r * 1.3) * 6;
      ctx.beginPath(); ctx.moveTo(px + 6 + off, wy); ctx.lineTo(px + 20 + off, wy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px + 28 - off, wy + 4); ctx.lineTo(px + 40 - off, wy + 4); ctx.stroke();
    }
  }

  private hedge(ctx: CanvasRenderingContext2D, px: number, py: number, x: number, y: number) {
    // tree/bush border tile — works for both town edges and forest
    ctx.fillStyle = '#5aa54a'; ctx.fillRect(px, py, TS, TS); // grass underlay
    ctx.fillStyle = '#2f7d36';
    ctx.beginPath(); ctx.ellipse(px + TS / 2, py + TS / 2 + 2, TS / 2 - 2, TS / 2 - 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a9444';
    for (let i = 0; i < 5; i++) {
      const bx = px + 8 + tileRand(x, y, i) * (TS - 18);
      const by = py + 6 + tileRand(x, y, i + 5) * (TS - 20);
      ctx.beginPath(); ctx.arc(bx, by, 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(20,60,25,.4)';
    ctx.beginPath(); ctx.ellipse(px + TS / 2, py + TS - 5, TS / 2 - 4, 4, 0, 0, Math.PI * 2); ctx.fill();
  }

  private building(ctx: CanvasRenderingContext2D, px: number, py: number, roof: string, sign?: 'center' | 'shop' | 'gym') {
    this.path(ctx, px, py, 0, 0); // ground under the entrance
    ctx.fillStyle = '#e9e3d6'; ctx.fillRect(px + 4, py + 18, TS - 8, TS - 20); // wall
    ctx.fillStyle = roof; ctx.fillRect(px + 2, py + 6, TS - 4, 16);            // roof
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(px + 2, py + 20, TS - 4, 2);
    ctx.fillStyle = '#5a4633'; ctx.fillRect(px + TS / 2 - 6, py + TS - 16, 12, 16); // door
    ctx.fillStyle = '#cfe8ff'; ctx.fillRect(px + 9, py + 24, 7, 7); ctx.fillRect(px + TS - 16, py + 24, 7, 7); // windows
    if (sign === 'center') { ctx.fillStyle = '#fff'; ctx.fillRect(px + TS / 2 - 5, py + 10, 10, 3); ctx.fillRect(px + TS / 2 - 1.5, py + 7, 3, 9); }
    if (sign === 'shop') { ctx.fillStyle = '#ffd86b'; ctx.fillRect(px + TS / 2 - 4, py + 11, 8, 6); }
    if (sign === 'gym') { ctx.fillStyle = '#ffd86b'; ctx.font = 'bold 11px system-ui'; ctx.fillText('★', px + TS / 2 - 4, py + 18); }
  }

  private exitTile(ctx: CanvasRenderingContext2D, px: number, py: number, x: number, y: number) {
    this.path(ctx, px, py, x, y);
    ctx.fillStyle = '#b59a5e'; ctx.fillRect(px + 6, py + TS - 12, TS - 12, 4);
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.beginPath(); ctx.moveTo(px + TS / 2, py + 10); ctx.lineTo(px + TS / 2 - 7, py + 20); ctx.lineTo(px + TS / 2 + 7, py + 20); ctx.closePath(); ctx.fill();
  }

  // ---- character ----------------------------------------------------------

  private character(ctx: CanvasRenderingContext2D, cx: number, cy: number, facing: string, body: string, hair: string, walk: boolean, bob: number) {
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 15, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
    const yo = -bob;
    // legs (alternate for walk)
    ctx.fillStyle = '#33405a';
    const legShift = walk ? bob * 2 : 0;
    ctx.fillRect(cx - 6, cy + 6 + yo, 4, 9 - legShift);
    ctx.fillRect(cx + 2, cy + 6 + yo, 4, 9 + (walk ? legShift : 0));
    // body
    ctx.fillStyle = body;
    ctx.fillRect(cx - 8, cy - 6 + yo, 16, 14);
    // head
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath(); ctx.arc(cx, cy - 12 + yo, 8, 0, Math.PI * 2); ctx.fill();
    // hair / cap
    ctx.fillStyle = hair;
    ctx.beginPath(); ctx.arc(cx, cy - 13 + yo, 8, Math.PI, 0); ctx.fill();
    ctx.fillRect(cx - 8, cy - 14 + yo, 16, 3);
    // facing cue (eyes / direction)
    ctx.fillStyle = '#222';
    if (facing === 'down') { ctx.fillRect(cx - 4, cy - 11 + yo, 2, 2); ctx.fillRect(cx + 2, cy - 11 + yo, 2, 2); }
    else if (facing === 'up') { /* back of head, no eyes */ }
    else if (facing === 'left') { ctx.fillRect(cx - 5, cy - 11 + yo, 2, 2); }
    else { ctx.fillRect(cx + 3, cy - 11 + yo, 2, 2); }
  }

  // ---- frame --------------------------------------------------------------

  private paint(t: number) {
    const view = this.view!;
    const ctx = this.canvas.getContext('2d')!;
    const W = this.canvas.width, H = this.canvas.height;
    const tiles: string[][] = view.tiles, p = view.player;

    // smooth camera toward player center
    const targetX = (p.x + 0.5) * TS - W / 2;
    const targetY = (p.y + 0.5) * TS - H / 2;
    if (!this.camInit) { this.cam.x = targetX; this.cam.y = targetY; this.camInit = true; }
    this.cam.x += (targetX - this.cam.x) * 0.18;
    this.cam.y += (targetY - this.cam.y) * 0.18;

    ctx.fillStyle = '#1a2a16'; ctx.fillRect(0, 0, W, H);

    for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < tiles[0].length; x++) {
        const px = Math.round(x * TS - this.cam.x), py = Math.round(y * TS - this.cam.y);
        if (px < -TS || py < -TS || px > W || py > H) continue;
        switch (tiles[y][x]) {
          case 'grass': this.tallGrass(ctx, px, py, x, y, t); break; // encounter grass
          case 'floor': this.path(ctx, px, py, x, y); break;
          case 'water': this.water(ctx, px, py, t); break;
          case 'wall': this.hedge(ctx, px, py, x, y); break;
          case 'exit': this.exitTile(ctx, px, py, x, y); break;
          case 'center': this.building(ctx, px, py, '#e0533a', 'center'); break;
          case 'shop': this.building(ctx, px, py, '#3a7bd6', 'shop'); break;
          case 'gym': this.building(ctx, px, py, '#9a55c8', 'gym'); break;
          case 'npc': this.path(ctx, px, py, x, y); this.character(ctx, px + TS / 2, py + TS / 2, 'down', '#5a8fd6', '#2a3a55', false, 0); break;
          default: this.grass(ctx, px, py, x, y);
        }
      }
    }

    // 'grass' in this game's content == tall grass (encounters); render those green
    // tiles with sway too is handled above via 'grass'. Player on top:
    const walking = performance.now() < this.walkUntil;
    const bob = walking ? (Math.sin(t * 18) > 0 ? 2 : 0) + (this.stepToggle ? 1 : 0) : 0;
    const cx = Math.round((p.x + 0.5) * TS - this.cam.x);
    const cy = Math.round((p.y + 0.5) * TS - this.cam.y);
    this.character(ctx, cx, cy, this.facing, '#e0533a', '#7a2d20', walking, bob);

    this.overlayUI(ctx, view, W, H);
  }

  private overlayUI(ctx: CanvasRenderingContext2D, view: View, W: number, H: number) {
    ctx.fillStyle = 'rgba(10,14,22,.82)'; ctx.fillRect(0, 0, W, 36);
    ctx.fillStyle = '#fff'; ctx.font = '15px system-ui'; ctx.textBaseline = 'alphabetic';
    const party = view.party.map((m: any) => `${m.species} L${m.level} ${m.hpPercent}%`).join('   ');
    ctx.fillText(`${view.locationId}  ·  ${view.time}  ·  badges:${view.badges.length}  ·  ${view.money ?? 0}₽  ·  ${party}`, 12, 24);
    if (view.message) {
      ctx.fillStyle = 'rgba(20,30,46,.92)'; ctx.fillRect(0, H - 70, W, 70);
      ctx.fillStyle = '#fff'; ctx.font = '18px system-ui';
      ctx.fillText(view.message, 20, H - 32);
    }
    ctx.fillStyle = '#9fb3c8'; ctx.font = '13px system-ui';
    ctx.fillText('Arrows: walk · green=tall grass (battle) · red roof=Center · blue roof=Shop · purple=Gym · M for menu', 12, H - 88);
  }
}
