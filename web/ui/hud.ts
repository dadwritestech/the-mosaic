export interface HudMove { index: number; name: string; }
export interface HudHandlers { onMove: (serverIndex: number) => void; onCatch: () => void; }
export interface HudSide { name: string; hp: number; status: string; boosts: Record<string, number>; volatiles: string[]; item?: string; }
export interface HudState { self: HudSide; foe: HudSide; weather: string; terrain: string; moves: HudMove[]; canCatch: boolean; log: string; }

const STATUS_LABEL: Record<string, string> = { par: 'PAR', psn: 'PSN', tox: 'TOX', brn: 'BRN', slp: 'SLP', frz: 'FRZ' };
const STATUS_COLOR: Record<string, string> = { par: '#d8a200', psn: '#9a3fb0', tox: '#7a2a8f', brn: '#d8642a', slp: '#7a8694', frz: '#37b0d8' };

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

  private statusBadge(status: string): HTMLElement | null {
    if (!status || !STATUS_LABEL[status]) return null;
    return el('span', `display:inline-block;margin-left:6px;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:700;color:#fff;background:${STATUS_COLOR[status]}`, STATUS_LABEL[status]);
  }
  private boostsText(boosts: Record<string, number>): string {
    return Object.entries(boosts).filter(([, v]) => v !== 0)
      .map(([s, v]) => `${s.toUpperCase()}${v > 0 ? '▲' : '▼'}${Math.abs(v)}`).join(' ');
  }

  private bar(side: HudSide, pos: string): HTMLElement {
    const box = el('div', `position:absolute;${pos};background:#fff;border:2px solid #222;border-radius:8px;padding:6px 10px;min-width:175px;color:#222;font-size:14px`);
    const title = el('div', 'display:flex;align-items:center;justify-content:space-between');
    const nameWrap = el('span', '', side.name);
    const badge = this.statusBadge(side.status); if (badge) nameWrap.appendChild(badge);
    title.appendChild(nameWrap);
    box.appendChild(title);
    box.appendChild(el('div', `height:7px;background:${side.hp > 30 ? '#37c24a' : '#e0b341'};width:${Math.max(0, side.hp)}%;border-radius:3px;margin-top:5px`));
    const extras = [this.boostsText(side.boosts), ...side.volatiles].filter(Boolean).join('  ');
    if (extras) box.appendChild(el('div', 'font-size:11px;color:#555;margin-top:4px', extras));
    if (side.item) box.appendChild(el('div', 'font-size:11px;color:#3a6ea5;margin-top:2px', `◈ ${side.item}`));
    return box;
  }

  render(o: HudState) {
    const children: HTMLElement[] = [this.bar(o.foe, 'top:16px;left:16px'), this.bar(o.self, 'bottom:160px;right:16px')];
    const fieldBits = [o.weather, o.terrain].filter(Boolean).join(' · ');
    if (fieldBits) children.push(el('div', 'position:absolute;top:16px;left:50%;transform:translateX(-50%);background:rgba(20,30,46,.85);color:#fff;padding:5px 14px;border-radius:14px;font-size:13px', fieldBits));

    const panel = el('div', 'position:absolute;bottom:0;left:0;right:0;background:#26354a;padding:10px;color:#fff');
    panel.appendChild(el('div', 'min-height:24px;margin-bottom:8px;font-size:14px', o.log));
    const grid = el('div', 'display:grid;grid-template-columns:repeat(4,1fr);gap:8px');
    o.moves.forEach((m) => {
      const b = el('button', 'pointer-events:auto;background:#e8554a;color:#fff;border:0;border-radius:7px;padding:12px;font-size:14px;cursor:pointer', m.name);
      b.addEventListener('click', () => this.handlers.onMove(m.index));
      grid.appendChild(b);
    });
    panel.appendChild(grid);
    if (o.canCatch) {
      const cb = el('button', 'pointer-events:auto;margin-top:8px;background:#ffd36b;border:0;border-radius:7px;padding:9px 16px;cursor:pointer', 'Throw Ultra Ball');
      cb.addEventListener('click', () => this.handlers.onCatch());
      panel.appendChild(cb);
    }
    children.push(panel);
    this.root.replaceChildren(...children);
  }
  clear() { this.root.replaceChildren(); }
}
