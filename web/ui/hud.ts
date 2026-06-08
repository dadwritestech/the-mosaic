export interface HudMove { index: number; name: string; }
export interface HudHandlers { onMove: (serverIndex: number) => void; onCatch: () => void; }
export interface HudState { selfName: string; selfHp: number; foeName: string; foeHp: number; moves: HudMove[]; canCatch: boolean; log: string; }

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
  render(o: HudState) {
    const bar = (name: string, hp: number, pos: string) => {
      const box = el('div', `position:absolute;${pos};background:#fff;border:2px solid #222;border-radius:8px;padding:5px 9px;min-width:160px;color:#222;font-size:14px`, name);
      box.appendChild(el('div', `height:7px;background:${hp > 30 ? '#37c24a' : '#e0b341'};width:${Math.max(0, hp)}%;border-radius:3px;margin-top:5px`));
      return box;
    };
    const panel = el('div', 'position:absolute;bottom:0;left:0;right:0;background:#26354a;padding:10px;color:#fff');
    panel.appendChild(el('div', 'min-height:22px;margin-bottom:8px;font-size:14px', o.log));
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
    this.root.replaceChildren(bar(o.foeName, o.foeHp, 'top:16px;left:16px'), bar(o.selfName, o.selfHp, 'bottom:150px;right:16px'), panel);
  }
  clear() { this.root.replaceChildren(); }
}
