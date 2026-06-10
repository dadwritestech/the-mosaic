// web/screens/shop.ts — two-column buy/sell shop UI.

import { select as sfxSelect, confirm as sfxConfirm, cancel as sfxCancel } from '../audio/sfx';

/* ------------------------------------------------------------------ */
/*  DOM helpers                                                        */
/* ------------------------------------------------------------------ */

function el(tag: string, css?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (css) node.style.cssText = css;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ------------------------------------------------------------------ */
/*  ShopScreen                                                         */
/* ------------------------------------------------------------------ */

export class ShopScreen {
  private container: HTMLElement;
  private disposed = false;

  constructor(
    host: HTMLElement,
    private onAction: (cmd: string, body?: Record<string, unknown>) => void,
  ) {
    this.container = el('div', 'position:absolute;inset:0;z-index:50;display:none;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;user-select:none;');
    host.appendChild(this.container);
  }

  show(): void {
    this.container.style.display = '';
  }

  hide(): void {
    this.container.style.display = 'none';
  }

  render(view: any): void {
    this.container.replaceChildren();

    const stock = view.stock ?? [];
    const sellItems = view.sellItems ?? [];
    const money = view.money ?? 0;
    const message = view.message ?? '';

    /* ---- backdrop ---- */
    const backdrop = el('div',
      'position:absolute;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;',
    );
    this.container.appendChild(backdrop);

    /* ---- card ---- */
    const card = el('div',
      'background:rgba(20,28,44,.92);color:#fff;border:1px solid rgba(255,255,255,.15);border-radius:14px;padding:20px 24px;width:520px;max-height:80vh;box-shadow:0 10px 40px rgba(0,0,0,.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;flex-direction:column;',
    );

    /* ---- header ---- */
    const header = el('div', 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;');
    header.appendChild(el('div', 'font-size:18px;font-weight:700;color:#f0b840;letter-spacing:2px;', view.name ?? 'Shop'));
    const moneyDisplay = el('div', 'font-size:14px;font-weight:600;color:#22c55e;', `${money}\u200A\u20BD`);
    header.appendChild(moneyDisplay);

    const closeBtn = el('button', 'background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;padding:2px 6px;', '\u2715');
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.color = '#fff'; try { sfxSelect(); } catch { /* */ } });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.color = '#94a3b8'; });
    closeBtn.addEventListener('click', () => { try { sfxCancel(); } catch { /* */ } this.onAction('closeShop'); });
    header.appendChild(closeBtn);
    card.appendChild(header);

    /* ---- message (if any) ---- */
    if (message) {
      card.appendChild(el('div', 'font-size:13px;color:#94a3b8;padding:6px 10px;border-radius:6px;background:rgba(255,255,255,.04);margin-bottom:8px;', message));
    }

    /* ---- separator ---- */
    card.appendChild(el('div', 'height:1px;background:rgba(255,255,255,.1);margin-bottom:10px;'));

    /* ---- two-column layout ---- */
    const body = el('div', 'flex:1;overflow-y:auto;display:flex;gap:16px;padding-right:4px;');

    /* ---- BUY column ---- */
    const buyCol = el('div', 'flex:1;display:flex;flex-direction:column;gap:4px;');
    buyCol.appendChild(el('div', 'font-size:13px;font-weight:700;color:#22c55e;margin-bottom:4px;', 'Buy'));

    if (!stock.length) {
      buyCol.appendChild(el('div', 'font-size:13px;color:#64748b;', 'No items available.'));
    } else {
      for (const item of stock) {
        const row = el('div',
          'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.04);',
        );

        const info = el('div', 'flex:1;min-width:0;');
        info.appendChild(el('div', 'font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;', item.name ?? item.id));
        info.appendChild(el('div', 'font-size:12px;color:#94a3b8;', `${item.price}\u200A\u20BD`));
        row.appendChild(info);

        /* qty stepper */
        const qtyWrap = el('div', 'display:flex;align-items:center;gap:2px;');
        const qtySpan = el('span', 'font-size:13px;font-weight:600;min-width:16px;text-align:center;', '1');
        const minusBtn = el('button', 'width:22px;height:22px;border-radius:6px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#fff;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;', '\u2212');
        const plusBtn = el('button', 'width:22px;height:22px;border-radius:6px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#fff;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;', '+');

        let qty = 1;
        const updateQty = () => {
          qtySpan.textContent = String(qty);
          buyBtn.style.opacity = (item.price * qty <= money) ? '1' : '0.4';
          buyBtn.style.pointerEvents = (item.price * qty <= money) ? 'auto' : 'none';
        };

        minusBtn.addEventListener('click', () => { if (qty > 1) { qty--; updateQty(); } });
        plusBtn.addEventListener('click', () => { qty++; updateQty(); });
        qtyWrap.appendChild(minusBtn);
        qtyWrap.appendChild(qtySpan);
        qtyWrap.appendChild(plusBtn);
        row.appendChild(qtyWrap);

        /* buy button */
        const buyBtn = el('button',
          'padding:5px 12px;border-radius:6px;border:0;background:#3b82f6;color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;',
          'Buy',
        );
        buyBtn.addEventListener('click', () => {
          try { sfxConfirm(); } catch { /* */ }
          this.onAction('shopBuy', { itemId: item.id, qty });
        });
        updateQty();
        row.appendChild(buyBtn);
        buyCol.appendChild(row);
      }
    }

    body.appendChild(buyCol);

    /* ---- SELL column ---- */
    const sellCol = el('div', 'flex:1;display:flex;flex-direction:column;gap:4px;');
    sellCol.appendChild(el('div', 'font-size:13px;font-weight:700;color:#e5533a;margin-bottom:4px;', 'Sell'));

    if (!sellItems.length) {
      sellCol.appendChild(el('div', 'font-size:13px;color:#64748b;', 'Nothing to sell.'));
    } else {
      for (const item of sellItems) {
        const row = el('div',
          'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.04);',
        );

        const info = el('div', 'flex:1;min-width:0;');
        info.appendChild(el('div', 'font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;', `${item.name ?? item.id} \u00d7${item.count}`));
        info.appendChild(el('div', 'font-size:12px;color:#94a3b8;', `${item.price}\u200A\u20BD ea`));
        row.appendChild(info);

        const sellBtn = el('button',
          'padding:5px 12px;border-radius:6px;border:0;background:#e5533a;color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;',
          'Sell',
        );
        sellBtn.addEventListener('click', () => {
          try { sfxConfirm(); } catch { /* */ }
          this.onAction('shopSell', { itemId: item.id, qty: 1 });
        });
        row.appendChild(sellBtn);
        sellCol.appendChild(row);
      }
    }

    body.appendChild(sellCol);
    card.appendChild(body);
    backdrop.appendChild(card);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.container.remove();
  }
}
