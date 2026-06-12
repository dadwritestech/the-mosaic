export interface HudMove { index: number; name: string; type?: string; category?: string; pp?: number; maxpp?: number; }
export interface HudSwitch { index: number; species: string; level: number; hpPercent: number; status: string; fainted: boolean; }
export interface HudBall { ballType: string; name: string; count: number; }
export interface HudHandlers { onMove: (serverIndex: number) => void; onSwitch: (index: number) => void; onBall: (ballType: string) => void; }
export interface HudSide { name: string; hp: number; status: string; boosts: Record<string, number>; volatiles: string[]; item?: string; }
export interface HudState { self: HudSide; foe: HudSide; weather: string; terrain: string; moves: HudMove[]; switches: HudSwitch[]; balls: HudBall[]; canCatch: boolean; log: string; }

const STATUS_LABEL: Record<string, string> = { par: 'PAR', psn: 'PSN', tox: 'TOX', brn: 'BRN', slp: 'SLP', frz: 'FRZ' };
const STATUS_COLOR: Record<string, string> = { par: '#d8a200', psn: '#9a3fb0', tox: '#7a2a8f', brn: '#d8642a', slp: '#7a8694', frz: '#37b0d8' };
const TYPE_COLOR: Record<string, string> = { Normal: '#9099a1', Fire: '#ff9d55', Water: '#5090d6', Electric: '#e0c133', Grass: '#63bc5a', Ice: '#73cec0', Fighting: '#ce4069', Poison: '#ab6ac8', Ground: '#d97845', Flying: '#8fa9de', Psychic: '#fa7179', Bug: '#90c12c', Rock: '#c5b78c', Ghost: '#5269ad', Dragon: '#0b6dc3', Dark: '#5a5366', Steel: '#5a8ea1', Fairy: '#ec8fe6' };

// Modern glassy HUD theme. Injected once as a <style> (textContent, no innerHTML).
const HUD_CSS = `
.hud-root{ font-family:'Segoe UI',system-ui,sans-serif; }
.hud-glass{ background:rgba(18,22,36,.55); backdrop-filter:blur(16px) saturate(1.25); -webkit-backdrop-filter:blur(16px) saturate(1.25); border:1px solid rgba(255,255,255,.14); box-shadow:0 10px 34px rgba(0,0,0,.4); }
.hud-plate{ border-radius:16px; padding:10px 14px; min-width:218px; color:#f3f6ff; }
.hud-name{ font-weight:700; font-size:15px; letter-spacing:.2px; text-shadow:0 1px 3px rgba(0,0,0,.45); }
.hud-hp-num{ font-size:12px; font-weight:600; color:rgba(233,240,255,.72); font-variant-numeric:tabular-nums; }
.hud-hptrack{ height:9px; background:rgba(0,0,0,.32); border-radius:99px; margin-top:6px; overflow:hidden; box-shadow:inset 0 1px 2px rgba(0,0,0,.4); }
.hud-hpfill{ height:100%; border-radius:99px; transition:width .45s cubic-bezier(.34,1.2,.5,1); box-shadow:0 0 10px rgba(255,255,255,.18); }
.hud-sub{ font-size:11px; color:rgba(214,225,246,.7); margin-top:5px; }
.hud-panel{ position:absolute; bottom:0; left:0; right:0; padding:14px 16px calc(14px + env(safe-area-inset-bottom)); border-top-left-radius:22px; border-top-right-radius:22px; }
.hud-log{ min-height:22px; margin-bottom:11px; font-size:15px; font-weight:500; color:#eef3ff; letter-spacing:.1px; }
.hud-moves{ display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
.hud-move{ position:relative; border:0; border-radius:14px; padding:11px 13px; cursor:pointer; text-align:left; color:#fff; overflow:hidden; display:flex; flex-direction:column; gap:6px;
  box-shadow:0 5px 16px rgba(0,0,0,.3); transition:transform .13s ease, filter .13s ease, box-shadow .13s ease; }
.hud-move::after{ content:''; position:absolute; inset:0; background:linear-gradient(160deg,rgba(255,255,255,.22),rgba(255,255,255,0) 42%); pointer-events:none; }
.hud-move:hover{ transform:translateY(-3px); filter:brightness(1.09); box-shadow:0 12px 24px rgba(0,0,0,.36); }
.hud-move:active{ transform:translateY(-1px) scale(.98); }
.hud-move-name{ font-size:15px; font-weight:700; text-shadow:0 1px 2px rgba(0,0,0,.3); }
.hud-move-sub{ display:flex; justify-content:space-between; align-items:center; }
.hud-pill{ display:inline-block; padding:2px 9px; border-radius:99px; font-size:10px; font-weight:800; letter-spacing:.5px; background:rgba(0,0,0,.26); }
.hud-pp{ font-size:11px; font-weight:600; opacity:.92; font-variant-numeric:tabular-nums; }
.hud-actions{ display:flex; gap:10px; margin-top:11px; flex-wrap:wrap; }
.hud-btn{ border:0; border-radius:99px; padding:10px 20px; cursor:pointer; font-weight:700; font-size:14px; color:#fff; transition:transform .13s ease, filter .13s ease; box-shadow:0 4px 14px rgba(0,0,0,.26); }
.hud-btn:hover{ filter:brightness(1.12); transform:translateY(-2px); }
.hud-btn:active{ transform:translateY(0) scale(.97); }
.hud-switch-card{ pointer-events:auto; border:0; border-radius:13px; padding:9px 14px; cursor:pointer; color:#fff; display:flex; flex-direction:column; gap:3px; min-width:128px;
  background:rgba(44,74,110,.85); transition:transform .13s ease, filter .13s ease; box-shadow:0 4px 12px rgba(0,0,0,.24); }
.hud-switch-card:hover{ filter:brightness(1.1); transform:translateY(-2px); }
.hud-field{ position:absolute; top:18px; left:50%; transform:translateX(-50%); padding:6px 16px; border-radius:99px; font-size:13px; font-weight:600; color:#eaf1ff; }
.hud-badge{ display:inline-block; margin-left:7px; padding:1px 7px; border-radius:6px; font-size:11px; font-weight:800; color:#fff; vertical-align:middle; }
`;

function el(tag: string, cls: string, style?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (style) e.style.cssText = style;
  if (text !== undefined) e.textContent = text;
  return e;
}

// mix a hex colour toward black by pct (0..1) — for move-card gradients
function shade(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - pct));
  const g = Math.round(((n >> 8) & 255) * (1 - pct));
  const b = Math.round((n & 255) * (1 - pct));
  return `rgb(${r},${g},${b})`;
}
function hpGradient(hp: number): string {
  if (hp > 50) return 'linear-gradient(90deg,#43e07d,#28c866)';
  if (hp > 20) return 'linear-gradient(90deg,#ffd76a,#f3b13c)';
  return 'linear-gradient(90deg,#ff7a6b,#e04a39)';
}

export class Hud {
  root: HTMLDivElement;
  private showSwitch = false;
  private last?: HudState;
  constructor(parent: HTMLElement, private handlers: HudHandlers) {
    if (!document.getElementById('hud-style')) {
      const s = document.createElement('style');
      s.id = 'hud-style';
      s.textContent = HUD_CSS;
      document.head.appendChild(s);
    }
    this.root = document.createElement('div');
    this.root.className = 'hud-root';
    this.root.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    parent.appendChild(this.root);
  }

  private statusBadge(status: string): HTMLElement | null {
    if (!status || !STATUS_LABEL[status]) return null;
    return el('span', 'hud-badge', `background:${STATUS_COLOR[status]}`, STATUS_LABEL[status]);
  }
  private boostsText(boosts: Record<string, number>): string {
    return Object.entries(boosts).filter(([, v]) => v !== 0)
      .map(([s, v]) => `${s.toUpperCase()}${v > 0 ? '▲' : '▼'}${Math.abs(v)}`).join(' ');
  }

  private bar(side: HudSide, pos: string): HTMLElement {
    const box = el('div', 'hud-glass hud-plate', `position:absolute;${pos}`);
    const title = el('div', '', 'display:flex;align-items:center;justify-content:space-between;gap:10px');
    const nameWrap = el('span', 'hud-name', '', side.name);
    const badge = this.statusBadge(side.status); if (badge) nameWrap.appendChild(badge);
    title.appendChild(nameWrap);
    title.appendChild(el('span', 'hud-hp-num', '', `${Math.max(0, Math.round(side.hp))}%`));
    box.appendChild(title);
    const track = el('div', 'hud-hptrack', '');
    track.appendChild(el('div', 'hud-hpfill', `width:${Math.max(0, side.hp)}%;background:${hpGradient(side.hp)}`));
    box.appendChild(track);
    const extras = [this.boostsText(side.boosts), ...side.volatiles].filter(Boolean).join('  ');
    if (extras) box.appendChild(el('div', 'hud-sub', '', extras));
    if (side.item) box.appendChild(el('div', 'hud-sub', 'color:#9ec9ff', `◈ ${side.item}`));
    return box;
  }

  private switchPanel(o: HudState): HTMLElement {
    const box = el('div', 'hud-glass', 'border-radius:14px;margin-bottom:11px;padding:11px;display:flex;gap:10px;flex-wrap:wrap');
    box.appendChild(el('div', '', 'width:100%;font-size:12px;font-weight:600;color:#9fb3d1;letter-spacing:.3px', 'SWITCH TO'));
    o.switches.forEach((s) => {
      const b = el('button', 'hud-switch-card', s.fainted ? 'background:rgba(58,58,68,.8);cursor:not-allowed;opacity:.5' : '');
      const top = el('div', '', 'display:flex;justify-content:space-between;gap:10px;font-size:13px;font-weight:700');
      top.appendChild(el('span', '', '', `${s.species} L${s.level}`));
      const badge = this.statusBadge(s.status); if (badge) top.appendChild(badge);
      b.appendChild(top);
      b.appendChild(el('div', '', 'font-size:11px;color:#cbd5e1', s.fainted ? 'fainted' : `HP ${s.hpPercent}%`));
      if (!s.fainted) b.addEventListener('click', () => { this.showSwitch = false; this.handlers.onSwitch(s.index); });
      box.appendChild(b);
    });
    return box;
  }

  render(o: HudState) {
    this.last = o;
    const children: HTMLElement[] = [this.bar(o.foe, 'top:18px;left:18px'), this.bar(o.self, 'bottom:182px;right:18px')];
    const fieldBits = [o.weather, o.terrain].filter(Boolean).join(' · ');
    if (fieldBits) children.push(el('div', 'hud-glass hud-field', '', fieldBits));

    const panel = el('div', 'hud-glass hud-panel', '');
    panel.appendChild(el('div', 'hud-log', '', o.log));

    if (this.showSwitch && o.switches.length) panel.appendChild(this.switchPanel(o));

    const grid = el('div', 'hud-moves', '');
    o.moves.forEach((m) => {
      const color = TYPE_COLOR[m.type ?? ''] ?? '#6b7280';
      const b = el('button', 'hud-move', `pointer-events:auto;background:linear-gradient(150deg,${color},${shade(color, 0.32)})`);
      b.appendChild(el('span', 'hud-move-name', '', m.name));
      const sub = el('div', 'hud-move-sub', '');
      sub.appendChild(el('span', 'hud-pill', '', (m.type ?? '').toUpperCase()));
      if (m.pp !== undefined) sub.appendChild(el('span', 'hud-pp', '', `${m.pp}/${m.maxpp}`));
      b.appendChild(sub);
      b.addEventListener('click', () => this.handlers.onMove(m.index));
      grid.appendChild(b);
    });
    panel.appendChild(grid);

    const actions = el('div', 'hud-actions', '');
    if (o.switches.length) {
      const sw = el('button', 'hud-btn', `pointer-events:auto;background:${this.showSwitch ? 'linear-gradient(135deg,#6aa0e8,#4f86d8)' : 'linear-gradient(135deg,#3a5a8c,#314f86)'}`, this.showSwitch ? 'Cancel' : 'Switch ⮂');
      sw.addEventListener('click', () => { this.showSwitch = !this.showSwitch; this.render(this.last!); });
      actions.appendChild(sw);
    }
    if (o.canCatch) {
      o.balls.forEach((ball) => {
        const cb = el('button', 'hud-btn', 'pointer-events:auto;background:linear-gradient(135deg,#ffe08a,#f5c04a);color:#3a2c00', `Throw ${ball.name} (${ball.count})`);
        cb.addEventListener('click', () => this.handlers.onBall(ball.ballType));
        actions.appendChild(cb);
      });
      if (!o.balls.length) actions.appendChild(el('div', '', 'align-self:center;font-size:12px;color:#b9c4d6', 'No Poké Balls'));
    }
    if (actions.childElementCount) panel.appendChild(actions);

    children.push(panel);
    this.root.replaceChildren(...children);
  }
  clear() { this.root.replaceChildren(); this.showSwitch = false; }
}
