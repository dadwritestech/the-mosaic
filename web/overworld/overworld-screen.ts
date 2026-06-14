import type { View } from '../net';

const TS = 48; // tile size px

function tileRand(x: number, y: number, i: number): number {
  let h = (x * 374761393 + y * 668265263 + i * 0x9e3779b1) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// ---- Sprite image cache -------------------------------------------------
const imgCache = new Map<string, HTMLImageElement | null>();

function loadImg(src: string): HTMLImageElement | null {
  if (imgCache.has(src)) return imgCache.get(src)!;
  const img = new Image();
  img.src = src;
  img.onload = () => imgCache.set(src, img);
  img.onerror = () => imgCache.set(src, null);
  imgCache.set(src, img); // optimistic set; will be null if onerror fires
  return img;
}

// Normalize a species name to a dex number src via the local sprites-master
function dexNumSrc(num: number, back = false): string {
  return back ? `/pkmn/back/${num}.gif` : `/pkmn/${num}.gif`;
}

// ---- Particle system ---------------------------------------------------
interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string;
}

export class OverworldScreen {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private view: View | null = null;
  private facing: 'up' | 'down' | 'left' | 'right' = 'down';
  private stepToggle = false;
  private walkUntil = 0;
  private cam = { x: 0, y: 0 };
  private camInit = false;
  private resizeObs: ResizeObserver;
  private particles: Particle[] = [];
  private grassParticleTimer = 0;
  private prevPlayerX = -1;
  private prevPlayerY = -1;
  private timeOfDay = 'day';
  private dayTransition = 1;
  private keyHandler: (e: KeyboardEvent) => void;

  constructor(private host: HTMLElement, private onMove: (dir: string) => void) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:absolute;inset:0;display:none;image-rendering:pixelated';
    host.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d')!;

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(host);
    this.resize();

    this.keyHandler = (e: KeyboardEvent) => {
      const d: Record<string, 'up' | 'down' | 'left' | 'right'> = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right',
      };
      const dir = d[e.key];
      if (dir) {
        e.preventDefault();
        this.facing = dir;
        this.stepToggle = !this.stepToggle;
        this.walkUntil = performance.now() + 280;
        this.onMove(dir);
      }
    };
    window.addEventListener('keydown', this.keyHandler);
    requestAnimationFrame(this.loop);
  }

  private resize() {
    const r = this.host.getBoundingClientRect();
    this.canvas.width = r.width || window.innerWidth;
    this.canvas.height = r.height || window.innerHeight;
    this.camInit = false;
  }

  show() { this.canvas.style.display = ''; }
  hide() { this.canvas.style.display = 'none'; }

  render(view: View) {
    if (this.view && view.time !== this.view.time) this.dayTransition = 0;
    this.view = view;
    this.timeOfDay = view.time ?? 'day';
  }

  dispose() {
    this.resizeObs.disconnect();
    window.removeEventListener('keydown', this.keyHandler);
    this.canvas.remove();
  }

  private loop = () => {
    requestAnimationFrame(this.loop);
    if (this.canvas.style.display === 'none' || !this.view) return;
    const t = performance.now() / 1000;
    if (this.dayTransition < 1) this.dayTransition = Math.min(1, this.dayTransition + 0.016);
    this.paint(t);
  };

  // ---- TILES ---------------------------------------------------------------

  private grass(px: number, py: number, x: number, y: number) {
    const ctx = this.ctx;
    ctx.fillStyle = '#5c9e3a'; ctx.fillRect(px, py, TS, TS);
    // Variation patches
    ctx.fillStyle = '#4f8f30';
    for (let i = 0; i < 4; i++) {
      const bx = px + tileRand(x, y, i) * (TS - 10) + 2;
      const by = py + tileRand(x, y, i + 9) * (TS - 10) + 2;
      ctx.fillRect(bx, by, 4 + tileRand(x, y, i + 5) * 8, 3 + tileRand(x, y, i + 6) * 5);
    }
    // Grass blades
    ctx.fillStyle = '#6db343';
    for (let i = 0; i < 5; i++) {
      const bx = px + tileRand(x, y, i + 20) * (TS - 6) + 2;
      const by = py + tileRand(x, y, i + 27) * (TS - 8) + 2;
      ctx.fillRect(bx, by, 2, 5);
    }
  }

  private tallGrass(px: number, py: number, x: number, y: number, t: number) {
    const ctx = this.ctx;
    this.grass(px, py, x, y);
    const sway = Math.sin(t * 1.8 + x * 0.9 + y * 0.5) * 2.5;
    const sway2 = Math.sin(t * 2.2 + x * 0.5 + y * 0.8 + 1) * 2;
    ctx.fillStyle = '#2d7020';
    for (let i = 0; i < 8; i++) {
      const bx = px + tileRand(x, y, i + 40) * (TS - 10) + 4;
      const by = py + 8 + tileRand(x, y, i + 47) * (TS - 22);
      const sw = i % 2 === 0 ? sway : sway2;
      ctx.beginPath();
      ctx.moveTo(bx, by + 14);
      ctx.quadraticCurveTo(bx + sw * 0.5, by + 7, bx + sw, by);
      ctx.lineTo(bx + 3 + sw, by);
      ctx.quadraticCurveTo(bx + 4 + sw * 0.5, by + 7, bx + 4, by + 14);
      ctx.closePath(); ctx.fill();
    }
    // Dark border at bottom for depth
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(px, py + TS - 6, TS, 6);
  }

  private path(px: number, py: number, x: number, y: number) {
    const ctx = this.ctx;
    ctx.fillStyle = '#c8b07a'; ctx.fillRect(px, py, TS, TS);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = tileRand(x, y, i) > 0.5 ? '#b9a268' : '#d9c48e';
      const bx = px + tileRand(x, y, i + 3) * (TS - 5);
      const by = py + tileRand(x, y, i + 11) * (TS - 5);
      const sz = 2 + tileRand(x, y, i + 17) * 4;
      ctx.fillRect(bx, by, sz, sz);
    }
    // subtle grid line
    ctx.fillStyle = 'rgba(0,0,0,0.04)';
    ctx.fillRect(px, py, TS, 1);
    ctx.fillRect(px, py, 1, TS);
  }

  private water(px: number, py: number, t: number) {
    const ctx = this.ctx;
    // Base water with gradient
    const grad = ctx.createLinearGradient(px, py, px, py + TS);
    grad.addColorStop(0, '#2e78cc');
    grad.addColorStop(1, '#1d5fa8');
    ctx.fillStyle = grad;
    ctx.fillRect(px, py, TS, TS);
    // Shimmer
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let r = 0; r < 3; r++) {
      const wy = py + 8 + r * 14 + Math.sin(t * 2.5 + r * 1.1) * 3;
      const off = Math.sin(t * 1.8 + r * 1.7) * 7;
      ctx.fillRect(px + 6 + off, wy, 14, 2);
      ctx.fillRect(px + 28 - off, wy + 5, 10, 2);
    }
    // Sparkle
    const sp = (Math.sin(t * 4) + 1) / 2;
    ctx.fillStyle = `rgba(255,255,255,${sp * 0.3})`;
    ctx.fillRect(px + 18, py + 6, 3, 3);
  }

  private tree(px: number, py: number, x: number, y: number) {
    const ctx = this.ctx;
    // Ground underlay
    ctx.fillStyle = '#5c9e3a'; ctx.fillRect(px, py, TS, TS);
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(px + TS / 2, py + TS - 5, TS / 2 - 3, 5, 0, 0, Math.PI * 2); ctx.fill();
    // Trunk
    ctx.fillStyle = '#6b4c2a';
    ctx.fillRect(px + TS / 2 - 5, py + TS - 20, 10, 16);
    // Foliage layers for depth
    const cx2 = px + TS / 2;
    ctx.fillStyle = '#256618';
    ctx.beginPath(); ctx.ellipse(cx2, py + TS / 2 + 4, TS / 2 - 1, TS / 2 - 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2e7d20';
    ctx.beginPath(); ctx.ellipse(cx2, py + TS / 2, TS / 2 - 3, TS / 2 - 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a9430';
    ctx.beginPath(); ctx.ellipse(cx2, py + TS / 2 - 4, TS / 2 - 6, TS / 2 - 7, 0, 0, Math.PI * 2); ctx.fill();
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.ellipse(cx2 - 5, py + TS / 2 - 8, 7, 5, -0.4, 0, Math.PI * 2); ctx.fill();
    // Detail dots
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = tileRand(x, y, i + 60) > 0.5 ? '#4ab038' : '#226216';
      const bx = px + 8 + tileRand(x, y, i + 60) * (TS - 18);
      const by = py + 4 + tileRand(x, y, i + 65) * (TS - 20);
      ctx.beginPath(); ctx.arc(bx, by, 4, 0, Math.PI * 2); ctx.fill();
    }
  }

  private building(px: number, py: number, roof: string, sign?: 'center' | 'shop' | 'gym') {
    const ctx = this.ctx;
    this.path(px, py, 0, 0);
    // Shadow under building
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(px + 2, py + TS - 8, TS - 4, 8);
    // Wall
    ctx.fillStyle = '#f0ece0'; ctx.fillRect(px + 3, py + 16, TS - 6, TS - 18);
    // Roof
    ctx.fillStyle = roof; ctx.fillRect(px + 1, py + 4, TS - 2, 15);
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(px + 1, py + 18, TS - 2, 2);
    // Door
    ctx.fillStyle = '#4a3828'; ctx.fillRect(px + TS / 2 - 7, py + TS - 18, 14, 18);
    ctx.fillStyle = '#6b5840'; ctx.fillRect(px + TS / 2 - 5, py + TS - 16, 10, 14);
    // Windows
    ctx.fillStyle = '#b8dbff'; ctx.fillRect(px + 7, py + 22, 8, 8); ctx.fillRect(px + TS - 15, py + 22, 8, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(px + 8, py + 23, 3, 3); ctx.fillRect(px + TS - 14, py + 23, 3, 3);
    // Signs
    if (sign === 'center') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(px + TS / 2 - 6, py + 8, 12, 3);
      ctx.fillRect(px + TS / 2 - 1.5, py + 5, 3, 9);
    }
    if (sign === 'shop') {
      ctx.fillStyle = '#ffe34a'; ctx.fillRect(px + TS / 2 - 5, py + 9, 10, 7);
      ctx.fillStyle = '#4a3200'; ctx.font = 'bold 8px system-ui'; ctx.fillText('$', px + TS / 2 - 3, py + 17);
    }
    if (sign === 'gym') {
      ctx.fillStyle = '#ffd500'; ctx.font = 'bold 14px system-ui'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('★', px + TS / 2 - 6, py + 17);
    }
  }

  private indoorFloor(px: number, py: number, x: number, y: number) {
    const ctx = this.ctx;
    ctx.fillStyle = '#d8cbb5'; ctx.fillRect(px, py, TS, TS);
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(px, py, TS, 1); ctx.fillRect(px, py, 1, TS);
    if ((x + y) % 2 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(px, py, TS, TS); }
  }

  private exitTile(px: number, py: number, x: number, y: number) {
    const ctx = this.ctx;
    this.path(px, py, x, y);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.moveTo(px + TS / 2, py + 10);
    ctx.lineTo(px + TS / 2 - 8, py + 22); ctx.lineTo(px + TS / 2 + 8, py + 22);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b59254'; ctx.fillRect(px + 6, py + TS - 10, TS - 12, 4);
  }

  // ---- CHARACTERS ----------------------------------------------------------

  private drawTrainer(cx: number, cy: number, facing: string, bodyColor: string, hairColor: string, walk: boolean, t: number) {
    const ctx = this.ctx;
    const bob = walk ? Math.abs(Math.sin(t * 10)) * 3 : 0;
    const legSwing = walk ? Math.sin(t * 10) * 4 : 0;
    const yo = -bob;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 14, 10, 3.5, 0, 0, Math.PI * 2); ctx.fill();

    // Legs
    ctx.fillStyle = '#2a3345';
    ctx.fillRect(cx - 7, cy + 5 + yo, 5, 8 + legSwing);
    ctx.fillRect(cx + 2, cy + 5 + yo, 5, 8 - legSwing);
    // Shoes
    ctx.fillStyle = '#111';
    ctx.fillRect(cx - 8, cy + 11 + yo + legSwing, 6, 3);
    ctx.fillRect(cx + 2, cy + 11 + yo - legSwing, 6, 3);

    // Body
    ctx.fillStyle = bodyColor;
    ctx.fillRect(cx - 9, cy - 7 + yo, 18, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(cx - 9, cy - 7 + yo, 18, 3);

    // Arms
    ctx.fillStyle = bodyColor;
    const armSwing = walk ? Math.sin(t * 10 + Math.PI) * 4 : 0;
    ctx.fillRect(cx - 13, cy - 5 + yo + armSwing, 5, 9);
    ctx.fillRect(cx + 8, cy - 5 + yo - armSwing, 5, 9);

    // Neck + Head
    ctx.fillStyle = '#e8be98';
    ctx.beginPath(); ctx.arc(cx, cy - 13 + yo, 8, 0, Math.PI * 2); ctx.fill();

    // Hair / Cap
    ctx.fillStyle = hairColor;
    ctx.beginPath(); ctx.arc(cx, cy - 14 + yo, 8, Math.PI, 0); ctx.fill();
    ctx.fillRect(cx - 9, cy - 15 + yo, 18, 4);
    // Cap brim
    if (facing !== 'up') {
      ctx.fillRect(cx - 11, cy - 14 + yo, 22, 3);
    }

    // Eyes based on direction
    ctx.fillStyle = '#1a1a1a';
    if (facing === 'down') {
      ctx.fillRect(cx - 4, cy - 12 + yo, 2, 2);
      ctx.fillRect(cx + 2, cy - 12 + yo, 2, 2);
    } else if (facing === 'left') {
      ctx.fillRect(cx - 5, cy - 12 + yo, 2, 2);
    } else if (facing === 'right') {
      ctx.fillRect(cx + 3, cy - 12 + yo, 2, 2);
    }
  }

  private drawNpc(cx: number, cy: number, color: string, hairCol: string) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 14, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a3345'; ctx.fillRect(cx - 5, cy + 5, 4, 7); ctx.fillRect(cx + 1, cy + 5, 4, 7);
    ctx.fillStyle = color; ctx.fillRect(cx - 8, cy - 6, 16, 13);
    ctx.fillStyle = '#e8be98'; ctx.beginPath(); ctx.arc(cx, cy - 12, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hairCol; ctx.beginPath(); ctx.arc(cx, cy - 13, 7, Math.PI, 0); ctx.fill();
    ctx.fillRect(cx - 7, cy - 14, 14, 3);
  }

  // ---- LEAD POKEMON sprite on overworld -----------------------------------

  private drawLeadPokemon(x: number, y: number, num: number, t: number) {
    if (!num) return;
    const ctx = this.ctx;
    const img = loadImg(dexNumSrc(num));
    if (!img || !img.complete || img.naturalWidth === 0) return;
    // Walk slightly behind and to the left of the player
    const offX = this.facing === 'right' ? -TS * 1.2 : this.facing === 'left' ? TS * 1.2 : -TS * 0.8;
    const offY = this.facing === 'up' ? TS * 1.2 : TS * 0.8;
    const cx = Math.round(x + offX);
    const cy = Math.round(y + offY);
    // Bounce
    const bob = Math.abs(Math.sin(t * 5)) * 3;
    const size = Math.min(TS * 1.1, 52);
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 14, size / 2 - 2, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(img, cx - size / 2, cy - size + 14 - bob, size, size);
  }

  // ---- PARTICLES -----------------------------------------------------------

  private spawnGrassParticle(wx: number, wy: number) {
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        x: wx + (Math.random() - 0.5) * 20,
        y: wy,
        vx: (Math.random() - 0.5) * 40,
        vy: -30 - Math.random() * 20,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 0.6 + Math.random() * 0.4,
        size: 2 + Math.random() * 3,
        color: Math.random() > 0.5 ? '#3a9030' : '#2a7020',
      });
    }
  }

  private updateParticles(dt: number) {
    const ctx = this.ctx;
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 60 * dt; // gravity
      p.life -= dt;
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  // ---- DAY/NIGHT -----------------------------------------------------------

  private getDayTint(): { overlay: string; ambient: string } {
    const t = this.timeOfDay;
    if (t === 'night') return { overlay: 'rgba(10,20,60,0.35)', ambient: '#8090c0' };
    if (t === 'morning') return { overlay: 'rgba(255,160,60,0.12)', ambient: '#ffe090' };
    if (t === 'evening') return { overlay: 'rgba(200,80,20,0.15)', ambient: '#ffb060' };
    return { overlay: 'rgba(0,0,0,0)', ambient: '#ffffff' };
  }

  // ---- PAINT ---------------------------------------------------------------

  private paint(t: number) {
    const view = this.view!;
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;

    // Use mapV2 if available, otherwise fall back to tiles
    const tiles: string[][] | null = view.tiles ?? null;
    const p = view.player;

    // Camera follow with smooth lerp
    const targetX = (p.x + 0.5) * TS - W / 2;
    const targetY = (p.y + 0.5) * TS - H / 2;
    if (!this.camInit) { this.cam.x = targetX; this.cam.y = targetY; this.camInit = true; }
    const lerpSpeed = 0.15;
    this.cam.x += (targetX - this.cam.x) * lerpSpeed;
    this.cam.y += (targetY - this.cam.y) * lerpSpeed;

    // Background fill (off-map border color matches grass)
    ctx.fillStyle = '#1e3612'; ctx.fillRect(0, 0, W, H);

    // Detect movement for grass particles
    const dt = 1 / 60;
    if (p.x !== this.prevPlayerX || p.y !== this.prevPlayerY) {
      if (tiles) {
        const tileKind = tiles[p.y]?.[p.x];
        if (tileKind === 'grass') {
          this.spawnGrassParticle(Math.round((p.x + 0.5) * TS - this.cam.x), Math.round((p.y + 0.5) * TS - this.cam.y));
        }
      }
      this.prevPlayerX = p.x;
      this.prevPlayerY = p.y;
    }

    // Render tiles
    if (tiles) {
      for (let y = 0; y < tiles.length; y++) {
        for (let x = 0; x < tiles[0].length; x++) {
          const px = Math.round(x * TS - this.cam.x);
          const py = Math.round(y * TS - this.cam.y);
          if (px < -TS || py < -TS || px > W + TS || py > H + TS) continue;
          const kind = tiles[y][x];
          switch (kind) {
            case 'grass': this.tallGrass(px, py, x, y, t); break;
            case 'floor': this.indoorFloor(px, py, x, y); break;
            case 'water': this.water(px, py, t); break;
            case 'wall': this.tree(px, py, x, y); break;
            case 'exit': this.exitTile(px, py, x, y); break;
            case 'center': this.building(px, py, '#d44040', 'center'); break;
            case 'shop': this.building(px, py, '#2e5fbf', 'shop'); break;
            case 'gym': this.building(px, py, '#7f3fbf', 'gym'); break;
            case 'npc': this.path(px, py, x, y); break;
            case 'warden': this.path(px, py, x, y); break;
            case 'rift': this.riftTile(px, py, t); break;
            default: this.grass(px, py, x, y);
          }
        }
      }

      // Draw NPCs on their tiles (second pass to appear on top)
      for (let y = 0; y < tiles.length; y++) {
        for (let x = 0; x < tiles[0].length; x++) {
          const px = Math.round(x * TS - this.cam.x);
          const py = Math.round(y * TS - this.cam.y);
          if (px < -TS || py < -TS || px > W + TS || py > H + TS) continue;
          const kind = tiles[y][x];
          if (kind === 'npc') {
            this.drawNpc(px + TS / 2, py + TS / 2, '#3a6ebf', '#2a3a55');
          } else if (kind === 'warden') {
            this.drawNpc(px + TS / 2, py + TS / 2, '#8b4513', '#3a2010');
          }
        }
      }
    }

    // Lead Pokémon (walks beside player)
    const cx = Math.round((p.x + 0.5) * TS - this.cam.x);
    const cy = Math.round((p.y + 0.5) * TS - this.cam.y);
    const leadNum = view.party?.[0]?.num ?? view.party?.[0]?.dexNum ?? 0;
    if (leadNum) this.drawLeadPokemon(cx, cy, leadNum, t);

    // Player character
    const walking = performance.now() < this.walkUntil;
    this.drawTrainer(cx, cy, this.facing, '#c0392b', '#2c1a0e', walking, t);

    // Particles (drawn over tiles, under UI)
    this.updateParticles(dt);

    // Day/night overlay
    const { overlay } = this.getDayTint();
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, W, H);

    // Night stars
    if (this.timeOfDay === 'night') {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 30; i++) {
        const sx = (tileRand(i, 0, 1) * W + Math.sin(t * 0.3 + i) * 2) % W;
        const sy = tileRand(i, 0, 2) * H * 0.4;
        const blink = (Math.sin(t * 2 + i * 1.7) + 1) / 2;
        ctx.globalAlpha = 0.3 + blink * 0.5;
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;
    }

    // UI overlay
    this.drawUI(view, W, H);
  }

  private riftTile(px: number, py: number, t: number) {
    const ctx = this.ctx;
    ctx.fillStyle = '#0a0820'; ctx.fillRect(px, py, TS, TS);
    const pulse = (Math.sin(t * 3) + 1) / 2;
    ctx.fillStyle = `rgba(120,40,200,${0.3 + pulse * 0.3})`;
    ctx.fillRect(px, py, TS, TS);
    ctx.strokeStyle = `rgba(160,80,255,${0.6 + pulse * 0.3})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const bx = px + 8 + i * 12;
      const by = py + 8 + Math.sin(t * 2 + i) * 6;
      ctx.moveTo(bx, by); ctx.lineTo(bx + 4, by + 28);
    }
    ctx.stroke();
  }

  private drawUI(view: View, W: number, H: number) {
    const ctx = this.ctx;

    // Top HUD bar
    const grad = ctx.createLinearGradient(0, 0, 0, 48);
    grad.addColorStop(0, 'rgba(8,14,28,0.92)');
    grad.addColorStop(1, 'rgba(8,14,28,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, 48);

    // Location name
    ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    const locName = (view.locationId ?? '').replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    ctx.fillStyle = '#ffffff'; ctx.fillText(locName, 14, 26);

    // Time of day icon
    const timeIcon = view.time === 'night' ? '🌙' : view.time === 'morning' ? '🌅' : '☀️';
    ctx.font = '18px system-ui'; ctx.fillText(timeIcon, 14 + ctx.measureText(locName).width + 12, 26);

    // Money top-right
    ctx.font = 'bold 14px "Segoe UI", system-ui';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd86b';
    ctx.fillText(`${view.money ?? 0}₽`, W - 14, 26);
    ctx.textAlign = 'left';

    // Message box
    if (view.message) {
      const msgH = 80;
      const msgGrad = ctx.createLinearGradient(0, H - msgH, 0, H);
      msgGrad.addColorStop(0, 'rgba(10,18,34,0)');
      msgGrad.addColorStop(0.15, 'rgba(10,18,34,0.95)');
      msgGrad.addColorStop(1, 'rgba(10,18,34,0.98)');
      ctx.fillStyle = msgGrad; ctx.fillRect(0, H - msgH, W, msgH);
      ctx.font = '17px "Segoe UI", system-ui';
      ctx.fillStyle = '#eef3ff';
      ctx.fillText(view.message, 20, H - 32);
      // blinking cursor
      if (Math.sin(Date.now() / 400) > 0) {
        ctx.fillStyle = '#7ab3ff';
        ctx.fillText('▼', 20 + ctx.measureText(view.message).width + 8, H - 32);
      }
    }

    // Controls hint (very subtle, bottom-left)
    if (!view.message) {
      ctx.font = '11px system-ui'; ctx.fillStyle = 'rgba(180,200,220,0.5)';
      ctx.fillText('Arrows/WASD · M=Menu · P=Pokédex · C=Card', 12, H - 12);
    }

    // Overlay (shop/NPC dialog etc.) — handled by the Menu class separately
  }
}
