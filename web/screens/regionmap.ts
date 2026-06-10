// web/screens/regionmap.ts — stylized region map with location pins.
// Visited locations bright, unvisited dim, current pulsing gold.

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
/*  RegionMapScreen                                                    */
/* ------------------------------------------------------------------ */

export class RegionMapScreen {
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

    const locations = view.locations ?? [];

    /* ---- backdrop ---- */
    const backdrop = el('div',
      'position:absolute;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;',
    );
    this.container.appendChild(backdrop);

    /* ---- card ---- */
    const card = el('div',
      'background:rgba(20,28,44,.92);color:#fff;border:1px solid rgba(255,255,255,.15);border-radius:14px;padding:20px 24px;width:500px;max-height:80vh;box-shadow:0 10px 40px rgba(0,0,0,.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;flex-direction:column;',
    );

    /* ---- header ---- */
    const header = el('div', 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;');
    header.appendChild(el('div', 'font-size:18px;font-weight:700;color:#f0b840;letter-spacing:2px;', 'Region Map'));
    header.appendChild(el('div', 'font-size:13px;color:#94a3b8;', `${locations.filter((l: any) => l.visited).length} / ${locations.length} visited`));

    const closeBtn = el('button', 'background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;padding:2px 6px;', '\u2715');
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.color = '#fff'; try { sfxSelect(); } catch { /* */ } });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.color = '#94a3b8'; });
    closeBtn.addEventListener('click', () => { try { sfxCancel(); } catch { /* */ } this.onAction('closeRegionMap'); });
    header.appendChild(closeBtn);
    card.appendChild(header);

    /* ---- separator ---- */
    card.appendChild(el('div', 'height:1px;background:rgba(255,255,255,.1);margin-bottom:12px;'));

    /* ---- map area (parchment-style) ---- */
    const mapArea = el('div',
      'position:relative;width:100%;aspect-ratio:4/3;background:linear-gradient(135deg,#1a2332 0%,#1e2d42 50%,#1a2332 100%);border-radius:10px;border:1px solid rgba(255,255,255,.1);overflow:hidden;',
    );

    /* ---- decorative grid lines ---- */
    const gridOverlay = el('div',
      'position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);background-size:40px 40px;pointer-events:none;',
    );
    mapArea.appendChild(gridOverlay);

    /* ---- inject pulse keyframe ---- */
    if (!document.getElementById('regionmap-pulse-style')) {
      const s = document.createElement('style');
      s.id = 'regionmap-pulse-style';
      s.textContent = `@keyframes pinPulse { 0%,100%{box-shadow:0 0 0 0 rgba(240,184,64,.5)} 50%{box-shadow:0 0 0 8px rgba(240,184,64,0)} }`;
      document.head.appendChild(s);
    }

    /* ---- location pins ---- */
    if (!locations.length) {
      mapArea.appendChild(el('div', 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:14px;', 'No location data available.'));
    } else {
      for (const loc of locations) {
        const pin = this.makePin(loc);
        mapArea.appendChild(pin);
      }
    }

    card.appendChild(mapArea);

    /* ---- location list below map ---- */
    if (locations.length) {
      const list = el('div', 'margin-top:12px;display:flex;flex-direction:column;gap:3px;max-height:160px;overflow-y:auto;padding-right:4px;');
      for (const loc of locations) {
        const row = el('div',
          `display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:6px;cursor:default;font-size:13px;${loc.current ? 'background:rgba(240,184,64,.1);' : ''}`,
        );
        const dot = el('div',
          `width:8px;height:8px;border-radius:50%;flex-shrink:0;${loc.current ? 'background:#f0b840;animation:pinPulse 2s infinite;' : loc.visited ? 'background:#3b82f6;' : 'background:#374151;'}`,
        );
        row.appendChild(dot);
        const label = el('span', `flex:1;${loc.current ? 'color:#f0b840;font-weight:600;' : loc.visited ? 'color:#cbd5e1;' : 'color:#475569;'}`, loc.name ?? loc.id);
        row.appendChild(label);
        if (loc.current) {
          row.appendChild(el('span', 'font-size:11px;color:#f0b840;font-weight:600;', 'HERE'));
        }
        list.appendChild(row);
      }
      card.appendChild(list);
    }

    backdrop.appendChild(card);
  }

  private makePin(loc: any): HTMLElement {
    const x = loc.x != null ? loc.x : 0.5;
    const y = loc.y != null ? loc.y : 0.5;

    const pin = el('div',
      `position:absolute;left:${x * 100}%;top:${y * 100}%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:2px;cursor:default;z-index:2;`,
    );

    const dot = el('div',
      `width:12px;height:12px;border-radius:50%;border:2px solid ${loc.current ? '#f0b840' : loc.visited ? '#3b82f6' : '#374151'};background:${loc.current ? '#f0b840' : loc.visited ? '#3b82f6' : '#4b5563'};${loc.current ? 'animation:pinPulse 2s infinite;' : ''}`,
    );
    pin.appendChild(dot);

    const label = el('span',
      `font-size:10px;font-weight:600;color:${loc.visited ? '#e2e8f0' : '#64748b'};white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,.8);pointer-events:none;`,
      loc.name ?? loc.id,
    );
    pin.appendChild(label);

    pin.addEventListener('mouseenter', () => {
      try { sfxSelect(); } catch { /* */ }
      label.style.color = '#fff';
      label.style.fontSize = '12px';
    });
    pin.addEventListener('mouseleave', () => {
      label.style.color = loc.visited ? '#e2e8f0' : '#64748b';
      label.style.fontSize = '10px';
    });

    return pin;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.container.remove();
    const styleEl = document.getElementById('regionmap-pulse-style');
    if (styleEl) styleEl.remove();
  }
}
