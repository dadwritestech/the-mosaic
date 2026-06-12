// DOM overlay for the core-loop menus (pause / party / bag / shop / Center / save).
// Server-driven: the server sends `view.overlay`; this renders it and routes
// button presses back as commands. No game logic lives here.
import { renderSummary, renderBox, renderPokedex, renderVsSeeker } from './menu-screens';
import { select as sfxSelect, confirm as sfxConfirm, cancel as sfxCancel } from '../audio/sfx';
import { ensureTheme, GLASS, BTN_PRIMARY, BTN_NEUTRAL } from './theme';

type Send = (cmd: string, body?: Record<string, unknown>) => void;

const STATUS_LABEL: Record<string, string> = { par: 'PAR', psn: 'PSN', tox: 'TOX', brn: 'BRN', slp: 'SLP', frz: 'FRZ' };
const STATUS_COLOR: Record<string, string> = { par: '#d8a200', psn: '#9a3fb0', tox: '#7a2a8f', brn: '#d8642a', slp: '#7a8694', frz: '#37b0d8' };

function el(tag: string, style: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  e.style.cssText = style;
  if (text !== undefined) e.textContent = text;
  return e;
}

const BTN = BTN_PRIMARY;
const BTN_ALT = BTN_NEUTRAL;

function inferCategory(id: string, name: string): string {
  const lower = (id + ' ' + name).toLowerCase();
  if (lower.includes('ball')) return 'Pok\u00e9 Balls';
  if (lower.match(/potion|heal|revive|antidote|elixir|berry|energy|fresh|max|hyper|full|awake/)) return 'Healing';
  if (lower.match(/xattack|xdefend|xspeed|guard|dire|xspatk|xspdef|xaccuracy|sharp|white.*powder|dire.*powder/)) return 'Battle Items';
  if (lower.match(/key|card|ticket|pass|machine|tm|hm|mail/)) return 'Key Items';
  return 'Other';
}

export class Menu {
  root: HTMLDivElement;
  private selected: number | null = null; // party-swap first selection
  private reorder = false;                 // party reorder mode (vs. open-summary)

  constructor(parent: HTMLElement, private send: Send) {
    ensureTheme();
    this.root = document.createElement('div');
    this.root.style.cssText = "position:absolute;inset:0;pointer-events:none;font-family:'Segoe UI',system-ui,sans-serif;z-index:20";
    parent.appendChild(this.root);
  }

  private button(label: string, onClick: () => void, style = BTN): HTMLElement {
    const b = el('button', style, label);
    b.className = 'ui-press';
    b.addEventListener('mouseenter', () => { try { sfxSelect(); } catch { /* */ } });
    b.addEventListener('click', () => {
      try { sfxConfirm(); } catch { /* */ }
      onClick();
    });
    return b;
  }

  private cancelButton(label: string, onClick: () => void, style = BTN_ALT): HTMLElement {
    const b = el('button', style, label);
    b.className = 'ui-press';
    b.addEventListener('mouseenter', () => { try { sfxSelect(); } catch { /* */ } });
    b.addEventListener('click', () => {
      try { sfxCancel(); } catch { /* */ }
      onClick();
    });
    return b;
  }

  private panel(title: string, body: HTMLElement, footer?: HTMLElement[]): HTMLElement {
    const backdrop = el('div', 'position:absolute;inset:0;background:rgba(8,11,20,.5);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;pointer-events:auto');
    const card = el('div', `${GLASS};color:#eef3ff;border-radius:20px;padding:20px 22px;min-width:340px;max-width:560px;max-height:82vh;overflow:auto`);
    card.className = 'ui-scroll';
    card.appendChild(el('div', 'font-size:19px;font-weight:800;letter-spacing:.3px;margin-bottom:14px;color:#fff', title));
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
    const c = el('button', `pointer-events:auto;text-align:left;display:block;width:100%;margin-bottom:9px;background:${highlight ? 'rgba(255,211,107,.14)' : 'rgba(255,255,255,.06)'};border:1px solid ${highlight ? '#ffd36b' : 'rgba(255,255,255,.12)'};border-radius:13px;padding:11px 13px;cursor:pointer;color:#fff`);
    c.className = 'ui-cardh';
    const top = el('div', 'display:flex;align-items:center;justify-content:space-between');
    const nameWrap = el('span', 'font-weight:700;font-size:15px', `${m.species}  Lv.${m.level}`);
    const badge = this.statusBadge(m.status); if (badge) nameWrap.appendChild(badge);
    top.appendChild(nameWrap);
    top.appendChild(el('span', 'font-size:12px;color:#cbd5e1', `${m.hp}/${m.maxHp} HP`));
    c.appendChild(top);
    const track = el('div', 'height:7px;background:rgba(0,0,0,.34);border-radius:99px;margin-top:7px;overflow:hidden');
    track.appendChild(el('div', `height:100%;border-radius:99px;width:${Math.max(0, m.hpPercent)}%;background:${m.hpPercent > 50 ? 'linear-gradient(90deg,#43e07d,#28c866)' : m.hpPercent > 20 ? 'linear-gradient(90deg,#ffd76a,#f3b13c)' : 'linear-gradient(90deg,#ff7a6b,#e04a39)'}`));
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
        body.appendChild(this.button('Pokédex', () => this.send('menu', { which: 'pokedex' })));
        body.appendChild(this.button('PC Box', () => this.send('menu', { which: 'box' })));
        body.appendChild(this.button('Vs-Seeker', () => this.send('menu', { which: 'vsseeker' })));
        body.appendChild(this.button('Save', () => this.send('menu', { which: 'save' })));
        node = this.panel('Menu', body, [this.cancelButton('Close', () => this.send('closeMenu'))]);
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
          useMode ? 'Choose a Pokémon to use the item on.'
            : this.reorder ? 'Reorder: tap two Pokémon to swap them.' : 'Tap a Pokémon to see its summary.'));
        o.mons.forEach((m: any, i: number) => {
          body.appendChild(this.monCard(m, () => {
            if (useMode) { this.send('useItem', { itemId: o.itemId, targetUid: m.uid }); return; }
            if (!this.reorder) { this.send('summary', { uid: m.uid }); return; }
            if (this.selected === null) { this.selected = i; this.render(view); }
            else { const a = this.selected; this.selected = null; this.send('swapParty', { a, b: i }); }
          }, !useMode && this.reorder && this.selected === i));
        });
        const footer = [this.cancelButton('Back', () => this.send('menu', { which: 'pause' }))];
        if (!useMode) footer.unshift(this.button(this.reorder ? 'Done' : 'Reorder', () => { this.reorder = !this.reorder; this.selected = null; this.render(view); }));
        node = this.panel(useMode ? 'Use Item — choose target' : 'Party', body, footer);
        break;
      }
      case 'summary': node = this.panel(`${o.mon.species} — Summary`, renderSummary(o, this.send), [this.cancelButton('Back', () => this.send('menu', { which: 'party' }))]); break;
      case 'box': node = this.panel('PC Box', renderBox(o, this.send), [this.cancelButton('Back', () => this.send('menu', { which: 'pause' }))]); break;
      case 'pokedex': node = this.panel('Pokédex', renderPokedex(o, this.send), [this.cancelButton('Back', () => this.send('menu', { which: 'pause' }))]); break;
      case 'vsseeker': node = this.panel('Vs-Seeker', renderVsSeeker(o, this.send), [this.cancelButton('Back', () => this.send('menu', { which: 'pause' }))]); break;
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
          for (const it of allItems) {
            const cat = inferCategory(it.id ?? '', it.name ?? '');
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(it);
          }

          // Render grouped in defined order
          const categoryOrder = ['Healing', 'Poké Balls', 'Battle Items', 'Key Items', 'Other'];
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
        node = this.panel('Bag', body, [this.cancelButton('Back', () => this.send('menu', { which: 'pause' }))]);
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
        node = this.panel(o.name ?? 'Shop', body, [this.cancelButton('Leave', () => this.send('closeMenu'))]);
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
        node = this.panel('Save / Load', body, [this.cancelButton('Back', () => this.send('menu', { which: 'pause' }))]);
        break;
      }
      default:
        node = this.panel('Menu', el('div', '', String(o.kind)), [this.cancelButton('Close', () => this.send('closeMenu'))]);
    }

    this.root.replaceChildren(node);
  }

  clear() { this.root.replaceChildren(); this.selected = null; }
}
