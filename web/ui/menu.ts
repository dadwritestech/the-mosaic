// DOM overlay for the core-loop menus (pause / party / bag / shop / Center / save).
// Server-driven: the server sends `view.overlay`; this renders it and routes
// button presses back as commands. No game logic lives here.

type Send = (cmd: string, body?: Record<string, unknown>) => void;

const STATUS_LABEL: Record<string, string> = { par: 'PAR', psn: 'PSN', tox: 'TOX', brn: 'BRN', slp: 'SLP', frz: 'FRZ' };
const STATUS_COLOR: Record<string, string> = { par: '#d8a200', psn: '#9a3fb0', tox: '#7a2a8f', brn: '#d8642a', slp: '#7a8694', frz: '#37b0d8' };

function el(tag: string, style: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  e.style.cssText = style;
  if (text !== undefined) e.textContent = text;
  return e;
}

const BTN = 'pointer-events:auto;background:#3a5a8c;color:#fff;border:0;border-radius:8px;padding:10px 16px;cursor:pointer;font-size:15px;font-weight:600;box-shadow:0 2px 5px #0003';
const BTN_ALT = BTN.replace('#3a5a8c', '#4a4a55');

export class Menu {
  root: HTMLDivElement;
  private selected: number | null = null; // party-swap first selection

  constructor(parent: HTMLElement, private send: Send) {
    this.root = document.createElement('div');
    this.root.style.cssText = 'position:absolute;inset:0;pointer-events:none;font-family:system-ui;z-index:20';
    parent.appendChild(this.root);
  }

  private button(label: string, onClick: () => void, style = BTN): HTMLElement {
    const b = el('button', style, label);
    b.addEventListener('click', onClick);
    return b;
  }

  private panel(title: string, body: HTMLElement, footer?: HTMLElement[]): HTMLElement {
    const backdrop = el('div', 'position:absolute;inset:0;background:rgba(8,12,20,.55);display:flex;align-items:center;justify-content:center;pointer-events:auto');
    const card = el('div', 'background:#1f2a3d;color:#fff;border:2px solid #3a5a8c;border-radius:14px;padding:18px 20px;min-width:340px;max-width:560px;max-height:80vh;overflow:auto;box-shadow:0 10px 40px #000a');
    card.appendChild(el('div', 'font-size:18px;font-weight:700;margin-bottom:12px', title));
    card.appendChild(body);
    if (footer && footer.length) {
      const f = el('div', 'display:flex;gap:8px;margin-top:14px;flex-wrap:wrap');
      footer.forEach((x) => f.appendChild(x));
      card.appendChild(f);
    }
    backdrop.appendChild(card);
    return backdrop;
  }

  private statusBadge(status: string): HTMLElement | null {
    if (!status || !STATUS_LABEL[status]) return null;
    return el('span', `margin-left:8px;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:700;color:#fff;background:${STATUS_COLOR[status]}`, STATUS_LABEL[status]);
  }

  private monCard(m: any, onClick: () => void, highlight: boolean): HTMLElement {
    const c = el('button', `pointer-events:auto;text-align:left;display:block;width:100%;margin-bottom:8px;background:${highlight ? '#2c4a6e' : '#27344a'};border:2px solid ${highlight ? '#ffd36b' : '#33405a'};border-radius:10px;padding:10px 12px;cursor:pointer;color:#fff`);
    const top = el('div', 'display:flex;align-items:center;justify-content:space-between');
    const nameWrap = el('span', 'font-weight:600;font-size:15px', `${m.species}  Lv.${m.level}`);
    const badge = this.statusBadge(m.status); if (badge) nameWrap.appendChild(badge);
    top.appendChild(nameWrap);
    top.appendChild(el('span', 'font-size:12px;color:#cbd5e1', `${m.hp}/${m.maxHp} HP`));
    c.appendChild(top);
    const track = el('div', 'height:7px;background:#0f1726;border-radius:4px;margin-top:6px;overflow:hidden');
    track.appendChild(el('div', `height:100%;width:${Math.max(0, m.hpPercent)}%;background:${m.hpPercent > 50 ? '#37c24a' : m.hpPercent > 20 ? '#e0b341' : '#e0533a'}`));
    c.appendChild(track);
    c.addEventListener('click', onClick);
    return c;
  }

  render(view: any) {
    const o = view.overlay;
    if (!o) { this.root.replaceChildren(); this.selected = null; return; }
    let node: HTMLElement;

    switch (o.kind) {
      case 'pause': {
        const body = el('div', 'display:flex;flex-direction:column;gap:8px;min-width:200px');
        body.appendChild(this.button('Party', () => this.send('menu', { which: 'party' })));
        body.appendChild(this.button('Bag', () => this.send('menu', { which: 'bag' })));
        body.appendChild(this.button('Save', () => this.send('menu', { which: 'save' })));
        node = this.panel('Menu', body, [this.button('Close', () => this.send('closeMenu'), BTN_ALT)]);
        break;
      }
      case 'center': {
        const body = el('div', 'font-size:15px;line-height:1.5;max-width:380px', o.message);
        node = this.panel('Pokémon Center', body, [this.button('OK', () => this.send('closeMenu'))]);
        break;
      }
      case 'party': {
        const useMode = o.purpose === 'useItem';
        const body = el('div', '');
        body.appendChild(el('div', 'font-size:13px;color:#9fb3d1;margin-bottom:10px',
          useMode ? 'Choose a Pokémon to use the item on.' : 'Tap two Pokémon to swap their order.'));
        o.mons.forEach((m: any, i: number) => {
          body.appendChild(this.monCard(m, () => {
            if (useMode) { this.send('useItem', { itemId: o.itemId, targetUid: m.uid }); return; }
            if (this.selected === null) { this.selected = i; this.render(view); }
            else { const a = this.selected; this.selected = null; this.send('swapParty', { a, b: i }); }
          }, !useMode && this.selected === i));
        });
        node = this.panel(useMode ? 'Use Item — choose target' : 'Party', body, [this.button('Back', () => this.send('menu', { which: 'pause' }), BTN_ALT)]);
        break;
      }
      case 'bag': {
        const body = el('div', 'min-width:300px');
        if (!o.pockets.length) body.appendChild(el('div', 'color:#9fb3d1', 'Your bag is empty.'));
        o.pockets.forEach((p: any) => {
          body.appendChild(el('div', 'font-size:12px;text-transform:uppercase;color:#7f93b3;margin:8px 0 4px', p.pocket));
          p.items.forEach((it: any) => {
            const row = el('div', 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid #2a364c');
            row.appendChild(el('span', 'font-size:14px', `${it.name} ×${it.count}`));
            if (it.usable) row.appendChild(this.button('Use', () => this.send('useItem', { itemId: it.id }), BTN + ';padding:5px 12px;font-size:13px'));
            else row.appendChild(el('span', 'font-size:12px;color:#6b7a93', 'battle only'));
            body.appendChild(row);
          });
        });
        node = this.panel('Bag', body, [this.button('Back', () => this.send('menu', { which: 'pause' }), BTN_ALT)]);
        break;
      }
      case 'shop': {
        const body = el('div', 'min-width:360px');
        body.appendChild(el('div', 'font-size:14px;color:#ffd36b;margin-bottom:10px', `Money: ${o.money}₽`));
        body.appendChild(el('div', 'font-size:12px;text-transform:uppercase;color:#7f93b3;margin-bottom:4px', 'Buy'));
        o.buy.forEach((it: any) => {
          const row = el('div', 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 0');
          row.appendChild(el('span', 'font-size:14px', `${it.name} — ${it.price}₽`));
          row.appendChild(this.button('Buy', () => this.send('buy', { itemId: it.itemId, qty: 1 }), BTN + ';padding:5px 12px;font-size:13px'));
          body.appendChild(row);
        });
        if (o.sell.length) {
          body.appendChild(el('div', 'font-size:12px;text-transform:uppercase;color:#7f93b3;margin:12px 0 4px', 'Sell'));
          o.sell.forEach((it: any) => {
            const row = el('div', 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 0');
            row.appendChild(el('span', 'font-size:14px', `${it.name} ×${it.count} — ${it.price}₽ ea`));
            row.appendChild(this.button('Sell', () => this.send('sell', { itemId: it.itemId, qty: 1 }), BTN_ALT + ';padding:5px 12px;font-size:13px'));
            body.appendChild(row);
          });
        }
        node = this.panel(o.name ?? 'Shop', body, [this.button('Leave', () => this.send('closeMenu'), BTN_ALT)]);
        break;
      }
      case 'save': {
        const body = el('div', 'display:flex;flex-direction:column;gap:8px;min-width:240px');
        (o.slots as string[]).forEach((slot) => {
          const row = el('div', 'display:flex;align-items:center;justify-content:space-between;gap:10px');
          row.appendChild(el('span', 'font-size:14px', slot));
          const btns = el('div', 'display:flex;gap:6px');
          btns.appendChild(this.button('Save', () => this.send('save', { slot }), BTN + ';padding:5px 12px;font-size:13px'));
          btns.appendChild(this.button('Load', () => this.send('load', { slot }), BTN_ALT + ';padding:5px 12px;font-size:13px'));
          row.appendChild(btns);
          body.appendChild(row);
        });
        node = this.panel('Save / Load', body, [this.button('Back', () => this.send('menu', { which: 'pause' }), BTN_ALT)]);
        break;
      }
      default:
        node = this.panel('Menu', el('div', '', String(o.kind)), [this.button('Close', () => this.send('closeMenu'), BTN_ALT)]);
    }

    this.root.replaceChildren(node);
  }

  clear() { this.root.replaceChildren(); this.selected = null; }
}
