// web/screens/trainercard.ts — trainer summary card.
// Shows player info: name, money, badges, party preview, pokedex counts.

import { select as sfxSelect, confirm as sfxConfirm, cancel as sfxCancel } from '../audio/sfx';

const BADGE_COLORS = ['#e5533a', '#3b82f6', '#22c55e', '#f0b840', '#a855f7', '#ec4899', '#06b6d4', '#f97316'];

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
/*  TrainerCardScreen                                                  */
/* ------------------------------------------------------------------ */

export class TrainerCardScreen {
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
    /* Rebuild on each render so data is fresh */
    this.container.replaceChildren();

    /* ---- backdrop ---- */
    const backdrop = el('div',
      'position:absolute;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;',
    );
    this.container.appendChild(backdrop);

    /* ---- card ---- */
    const card = el('div',
      'background:rgba(20,28,44,.92);color:#fff;border:1px solid rgba(255,255,255,.15);border-radius:14px;padding:24px 28px;min-width:360px;max-width:440px;box-shadow:0 10px 40px rgba(0,0,0,.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;flex-direction:column;gap:14px;',
    );

    /* ---- header ---- */
    const header = el('div', 'display:flex;justify-content:space-between;align-items:center;');
    header.appendChild(el('div', 'font-size:20px;font-weight:700;color:#f0b840;letter-spacing:2px;', 'Trainer Card'));

    const closeBtn = el('button',
      'background:none;border:none;color:#94a3b8;font-size:20px;cursor:pointer;padding:4px 8px;border-radius:6px;',
      '\u2715',
    );
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.color = '#fff'; try { sfxSelect(); } catch { /* */ } });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.color = '#94a3b8'; });
    closeBtn.addEventListener('click', () => { try { sfxCancel(); } catch { /* */ } this.onAction('closeTrainerCard'); });
    header.appendChild(closeBtn);
    card.appendChild(header);

    /* ---- separator ---- */
    card.appendChild(el('div', 'height:1px;background:rgba(255,255,255,.1);'));

    /* ---- info rows ---- */
    const info = el('div', 'display:flex;flex-direction:column;gap:8px;font-size:14px;');

    const money = view.money ?? null;
    const badges = view.badges ?? [];
    const party = view.party ?? [];
    const dexSeen = view.dexSeen ?? null;
    const dexCaught = view.dexCaught ?? null;
    const playTime = view.playTime ?? null;

    /* Money */
    info.appendChild(this.infoRow('Money', money !== null ? `${money}\u200A\u20BD` : '\u2014'));

    /* Badges */
    const badgeRow = el('div', 'display:flex;justify-content:space-between;align-items:center;');
    badgeRow.appendChild(el('span', 'color:#cbd5e1;', 'Badges'));
    const badgeIcons = el('div', 'display:flex;gap:4px;');
    for (let i = 0; i < 8; i++) {
      const circle = el('div',
        `width:18px;height:18px;border-radius:50%;border:2px solid ${i < badges.length ? BADGE_COLORS[i] : '#374151'};background:${i < badges.length ? BADGE_COLORS[i] : 'transparent'};`,
      );
      badgeIcons.appendChild(circle);
    }
    badgeRow.appendChild(badgeIcons);
    info.appendChild(badgeRow);

    /* Pok\u00e9dex */
    if (dexSeen !== null || dexCaught !== null) {
      info.appendChild(this.infoRow('Pok\u00e9dex',
        `${dexSeen ?? '\u2014'} seen / ${dexCaught ?? '\u2014'} caught`,
      ));
    }

    /* Play time */
    if (playTime !== null) {
      info.appendChild(this.infoRow('Play Time', playTime));
    }

    card.appendChild(info);

    /* ---- separator ---- */
    card.appendChild(el('div', 'height:1px;background:rgba(255,255,255,.1);'));

    /* ---- party preview ---- */
    const partyLabel = el('div', 'font-size:13px;font-weight:600;color:#94a3b8;margin-bottom:6px;', 'Party');
    card.appendChild(partyLabel);

    const partyGrid = el('div', 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap;');

    for (let i = 0; i < 6; i++) {
      const mon = party[i];
      const slot = el('div',
        `width:56px;height:56px;border-radius:10px;border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.04);`,
      );
      if (mon) {
        const img = document.createElement('img');
        img.src = `/pkmn/${mon.num ?? 0}.gif`;
        img.style.cssText = 'width:44px;height:44px;image-rendering:pixelated;';
        img.onerror = () => { img.style.display = 'none'; slot.appendChild(el('span', 'font-size:20px;opacity:.3;', '?')); };
        slot.appendChild(img);
      } else {
        slot.appendChild(el('span', 'font-size:20px;opacity:.2;', '\u25CF'));
      }
      partyGrid.appendChild(slot);
    }
    card.appendChild(partyGrid);

    backdrop.appendChild(card);
  }

  private infoRow(label: string, value: string): HTMLElement {
    const row = el('div', 'display:flex;justify-content:space-between;align-items:center;');
    row.appendChild(el('span', 'color:#cbd5e1;', label));
    row.appendChild(el('span', 'font-weight:600;', value));
    return row;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.container.remove();
  }
}
