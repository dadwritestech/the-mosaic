// web/screens/pokedex.ts — scrollable Pok\u00e9dex grid.
// Shows entries with sprites (silhouette for unseen), name hidden until seen.
// Clicking a caught entry opens a detail subview.

import { select as sfxSelect, confirm as sfxConfirm, cancel as sfxCancel } from '../audio/sfx';

const TYPE_COLOR: Record<string, string> = {
  Normal: '#9099a1', Fire: '#ff9d55', Water: '#5090d6', Electric: '#e0c133',
  Grass: '#63bc5a', Ice: '#73cec0', Fighting: '#ce4069', Poison: '#ab6ac8',
  Ground: '#d97845', Flying: '#8fa9de', Psychic: '#fa7179', Bug: '#90c12c',
  Rock: '#c5b78c', Ghost: '#5269ad', Dragon: '#0b6dc3', Dark: '#5a5366',
  Steel: '#5a8ea1', Fairy: '#ec8fe6',
};

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
/*  PokedexScreen                                                      */
/* ------------------------------------------------------------------ */

export class PokedexScreen {
  private container: HTMLElement;
  private disposed = false;
  private selectedNum: number | null = null;

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
    this.selectedNum = null;
  }

  render(view: any): void {
    this.container.replaceChildren();
    this.selectedNum = null;

    const entries = view.entries ?? [];
    const seenCount = view.seenCount ?? 0;
    const caughtCount = view.caughtCount ?? 0;

    /* ---- backdrop ---- */
    const backdrop = el('div',
      'position:absolute;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;',
    );
    this.container.appendChild(backdrop);

    /* ---- card ---- */
    const card = el('div',
      'background:rgba(20,28,44,.92);color:#fff;border:1px solid rgba(255,255,255,.15);border-radius:14px;padding:20px 24px;width:480px;max-height:80vh;box-shadow:0 10px 40px rgba(0,0,0,.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;flex-direction:column;',
    );

    /* ---- header ---- */
    const header = el('div', 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;');
    header.appendChild(el('div', 'font-size:18px;font-weight:700;color:#f0b840;letter-spacing:2px;', 'Pok\u00e9dex'));
    const stats = el('div', 'font-size:13px;color:#94a3b8;');
    stats.textContent = `Seen ${seenCount} / Caught ${caughtCount}`;
    header.appendChild(stats);

    const closeBtn = el('button',
      'background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;padding:2px 6px;',
      '\u2715',
    );
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.color = '#fff'; try { sfxSelect(); } catch { /* */ } });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.color = '#94a3b8'; });
    closeBtn.addEventListener('click', () => { try { sfxCancel(); } catch { /* */ } this.onAction('closePokedex'); });
    header.appendChild(closeBtn);
    card.appendChild(header);

    /* ---- separator ---- */
    card.appendChild(el('div', 'height:1px;background:rgba(255,255,255,.1);margin-bottom:10px;'));

    /* ---- scrollable list ---- */
    const list = el('div', 'flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:4px;padding-right:4px;');

    if (!entries.length) {
      list.appendChild(el('div', 'text-align:center;color:#64748b;padding:20px;font-size:14px;', 'No entries yet. Explore to discover Pok\u00e9mon!'));
    } else {
      for (const entry of entries) {
        list.appendChild(this.entryRow(entry));
      }
    }

    card.appendChild(list);
    backdrop.appendChild(card);
  }

  private entryRow(entry: any): HTMLElement {
    const num = entry.num ?? 0;
    const seen = entry.seen === true;
    const caught = entry.caught === true;
    const name = seen ? (entry.name ?? '???') : '-----';

    const row = el('div',
      'display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.04);cursor:default;transition:background .15s;',
    );

    /* number */
    row.appendChild(el('span', 'font-size:12px;color:#64748b;min-width:48px;font-weight:600;', `#${String(num).padStart(3, '0')}`));

    /* sprite */
    const spriteWrap = el('div', 'width:36px;height:36px;display:flex;align-items:center;justify-content:center;flex-shrink:0;');
    if (seen) {
      const img = document.createElement('img');
      img.src = `/pkmn/${num}.gif`;
      img.style.cssText = `width:32px;height:32px;image-rendering:pixelated;${!caught ? 'filter:brightness(0) opacity(.5);' : ''}`;
      img.onerror = () => { img.style.display = 'none'; };
      spriteWrap.appendChild(img);
    } else {
      spriteWrap.appendChild(el('div', 'width:32px;height:32px;border-radius:4px;background:rgba(255,255,255,.08);'));
    }
    row.appendChild(spriteWrap);

    /* name */
    row.appendChild(el('span', `font-size:14px;font-weight:600;flex:1;${!seen ? 'color:#475569;' : ''}`, name));

    /* status dot */
    const dot = el('div',
      `width:8px;height:8px;border-radius:50%;flex-shrink:0;${caught ? 'background:#22c55e;' : seen ? 'background:#f0b840;' : 'background:#374151;'}`,
    );
    row.appendChild(dot);

    /* Click to open detail if caught */
    if (caught) {
      row.style.cursor = 'pointer';
      row.addEventListener('mouseenter', () => { row.style.background = 'rgba(255,255,255,.1)'; try { sfxSelect(); } catch { /* */ } });
      row.addEventListener('mouseleave', () => { row.style.background = 'rgba(255,255,255,.04)'; });
      row.addEventListener('click', () => {
        try { sfxConfirm(); } catch { /* */ }
        this.selectedNum = num;
        this.showDetail(entry);
      });
    }

    return row;
  }

  private showDetail(entry: any): void {
    /* Overlay on top of the existing pokedex card */
    const overlay = el('div',
      'position:absolute;inset:0;z-index:60;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;',
    );
    this.container.appendChild(overlay);

    const detail = el('div',
      'background:rgba(20,28,44,.96);color:#fff;border:1px solid rgba(255,255,255,.15);border-radius:14px;padding:24px;min-width:340px;max-width:400px;box-shadow:0 10px 40px rgba(0,0,0,.5);display:flex;flex-direction:column;gap:12px;',
    );

    /* header */
    const header = el('div', 'display:flex;justify-content:space-between;align-items:center;');
    header.appendChild(el('div', 'font-size:18px;font-weight:700;color:#f0b840;', entry.name ?? `#${entry.num}`));
    const closeBtn = el('button', 'background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;', '\u2715');
    closeBtn.addEventListener('click', () => { overlay.remove(); try { sfxCancel(); } catch { /* */ } });
    header.appendChild(closeBtn);
    detail.appendChild(header);

    /* sprite */
    const spriteWrap = el('div', 'display:flex;justify-content:center;padding:12px 0;background:rgba(255,255,255,.04);border-radius:10px;');
    const img = document.createElement('img');
    img.src = `/pkmn/${entry.num}.gif`;
    img.style.cssText = 'width:96px;height:96px;image-rendering:pixelated;';
    spriteWrap.appendChild(img);
    detail.appendChild(spriteWrap);

    /* types */
    if (entry.types && entry.types.length) {
      const typeRow = el('div', 'display:flex;gap:6px;justify-content:center;');
      for (const t of entry.types) {
        typeRow.appendChild(el('span',
          `padding:3px 10px;border-radius:6px;font-size:12px;font-weight:700;color:#fff;background:${TYPE_COLOR[t] ?? '#6b7280'};`,
          t,
        ));
      }
      detail.appendChild(typeRow);
    }

    /* separator */
    detail.appendChild(el('div', 'height:1px;background:rgba(255,255,255,.1);'));

    /* flavor / category */
    if (entry.flavor) {
      detail.appendChild(el('div', 'font-size:13px;color:#94a3b8;line-height:1.5;font-style:italic;', entry.flavor));
    }

    /* base stats */
    if (entry.baseStats) {
      const stats = el('div', 'display:flex;flex-direction:column;gap:3px;');
      const statKeys = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
      const statLabels: Record<string, string> = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
      for (const key of statKeys) {
        const val = entry.baseStats[key] ?? 0;
        const row = el('div', 'display:flex;align-items:center;gap:6px;');
        row.appendChild(el('span', 'font-size:12px;color:#94a3b8;min-width:28px;', statLabels[key]));
        const bar = el('div', 'flex:1;height:6px;background:#1e293b;border-radius:3px;overflow:hidden;');
        bar.appendChild(el('div', `height:100%;width:${Math.min(100, (val / 255) * 100)}%;background:${val >= 100 ? '#22c55e' : val >= 60 ? '#f0b840' : '#e5533a'};border-radius:3px;`));
        row.appendChild(bar);
        row.appendChild(el('span', 'font-size:12px;font-weight:600;min-width:24px;text-align:right;', String(val)));
        stats.appendChild(row);
      }
      detail.appendChild(stats);
    }

    overlay.appendChild(detail);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.container.remove();
  }
}
