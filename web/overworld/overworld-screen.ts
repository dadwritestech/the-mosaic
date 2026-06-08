import type { View } from '../net';

const TS = 48;
const COLORS: Record<string, string> = { floor: '#cdebb3', grass: '#4caf38', wall: '#3b4a5a', exit: '#e9d27a', gym: '#b07cd6', npc: '#7ec8ff', center: '#ff7b8a', shop: '#ffd36b' };

export class OverworldScreen {
  constructor(private canvas: HTMLCanvasElement, private onMove: (dir: string) => void) {
    window.addEventListener('keydown', (e) => {
      const d: Record<string, string> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
      const dir = d[e.key];
      if (dir) { e.preventDefault(); this.onMove(dir); }
    });
  }
  render(view: View) {
    const ctx = this.canvas.getContext('2d')!;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.fillStyle = '#0b0f17'; ctx.fillRect(0, 0, W, H);
    const tiles: string[][] = view.tiles, p = view.player;
    const camX = p.x * TS - W / 2, camY = p.y * TS - H / 2;
    for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < tiles[0].length; x++) {
        ctx.fillStyle = COLORS[tiles[y][x]] ?? '#cdebb3';
        ctx.fillRect(x * TS - camX, y * TS - camY, TS - 2, TS - 2);
      }
    }
    ctx.fillStyle = '#ff5a4d';
    ctx.fillRect(p.x * TS - camX + 8, p.y * TS - camY + 6, TS - 18, TS - 14);
    // HUD bar
    ctx.fillStyle = 'rgba(10,14,22,.78)'; ctx.fillRect(0, 0, W, 36);
    ctx.fillStyle = '#fff'; ctx.font = '15px system-ui';
    const party = view.party.map((m: any) => `${m.species} L${m.level} ${m.hpPercent}%`).join('   ');
    ctx.fillText(`${view.locationId}  ·  ${view.time}  ·  badges:${view.badges.length}  ·  ${party}`, 12, 24);
    if (view.message) {
      ctx.fillStyle = 'rgba(20,30,46,.92)'; ctx.fillRect(0, H - 70, W, 70);
      ctx.fillStyle = '#fff'; ctx.font = '18px system-ui';
      ctx.fillText(view.message, 20, H - 32);
    }
    ctx.fillStyle = '#9fb3c8'; ctx.font = '13px system-ui';
    ctx.fillText('Arrow keys to walk · step into tall grass (green) to battle · purple tile = gym', 12, H - 88);
  }
}
