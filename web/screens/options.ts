// web/screens/options.ts — client-side settings panel.
// Toggles / sliders persisted to localStorage via web/settings.ts.

import { getSettings, setSetting, type GameSettings } from '../settings';
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
/*  OptionsScreen                                                      */
/* ------------------------------------------------------------------ */

export class OptionsScreen {
  private container: HTMLElement;
  private disposed = false;

  constructor(
    host: HTMLElement,
    private onAction: (cmd: string, body?: Record<string, unknown>) => void,
  ) {
    this.container = el('div', 'position:absolute;inset:0;z-index:50;display:none;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;user-select:none;');
    host.appendChild(this.container);
    this.build();
  }

  private build(): void {
    /* ---- backdrop ---- */
    const backdrop = el('div',
      'position:absolute;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;',
    );
    this.container.appendChild(backdrop);

    /* ---- card ---- */
    const card = el('div',
      'background:rgba(20,28,44,.92);color:#fff;border:1px solid rgba(255,255,255,.15);border-radius:14px;padding:24px 28px;min-width:380px;max-width:480px;box-shadow:0 10px 40px rgba(0,0,0,.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;flex-direction:column;gap:16px;',
    );

    /* title */
    card.appendChild(el('div', 'font-size:20px;font-weight:700;color:#f0b840;letter-spacing:2px;', 'Options'));

    /* ---- rows container ---- */
    const rows = el('div', 'display:flex;flex-direction:column;gap:14px;');
    card.appendChild(rows);

    const settings = getSettings();

    /* ---- Text Speed ---- */
    rows.appendChild(this.buildSelectRow('Text Speed', ['slow', 'normal', 'fast'], settings.textSpeed, (v) => {
      setSetting('textSpeed', v as 'slow' | 'normal' | 'fast');
      try { sfxConfirm(); } catch { /* */ }
    }));

    /* ---- Battle Animations toggle ---- */
    rows.appendChild(this.buildToggleRow('Battle Animations', settings.battleAnimations, (v) => {
      setSetting('battleAnimations', v);
      try { sfxConfirm(); } catch { /* */ }
    }));

    /* ---- SFX Volume slider ---- */
    rows.appendChild(this.buildSliderRow('SFX Volume', settings.sfxVolume, (v) => {
      setSetting('sfxVolume', v);
    }));

    /* ---- Master Volume slider ---- */
    rows.appendChild(this.buildSliderRow('Master Volume', settings.masterVolume, (v) => {
      setSetting('masterVolume', v);
    }));

    /* ---- Day/Night Tint toggle ---- */
    rows.appendChild(this.buildToggleRow('Day/Night Tint', settings.dayNightTint, (v) => {
      setSetting('dayNightTint', v);
      try { sfxConfirm(); } catch { /* */ }
    }));

    /* ---- footer buttons ---- */
    const footer = el('div', 'display:flex;gap:10px;justify-content:flex-end;margin-top:4px;');

    const closeBtn = el('button',
      'padding:10px 24px;border-radius:10px;border:0;background:#3b82f6;color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;',
      'Done',
    );
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = '#2563eb'; try { sfxSelect(); } catch { /* */ } });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = '#3b82f6'; });
    closeBtn.addEventListener('click', () => {
      try { sfxConfirm(); } catch { /* */ }
      this.onAction('closeOptions');
    });
    footer.appendChild(closeBtn);

    card.appendChild(footer);
    backdrop.appendChild(card);
  }

  /* ---- row builders ---- */

  private buildSelectRow(label: string, options: string[], current: string, onChange: (v: string) => void): HTMLElement {
    const row = el('div', 'display:flex;align-items:center;justify-content:space-between;gap:12px;');
    row.appendChild(el('span', 'font-size:14px;color:#cbd5e1;', label));

    const btnGroup = el('div', 'display:flex;gap:4px;');
    for (const opt of options) {
      const isActive = opt === current;
      const btn = el('button',
        `padding:6px 14px;border-radius:8px;border:1px solid ${isActive ? '#f0b840' : 'rgba(255,255,255,.15)'};background:${isActive ? 'rgba(240,184,64,.2)' : 'rgba(255,255,255,.06)'};color:${isActive ? '#f0b840' : '#94a3b8'};font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;text-transform:capitalize;`,
        opt,
      );
      btn.addEventListener('click', () => onChange(opt));
      btn.addEventListener('mouseenter', () => { try { sfxSelect(); } catch { /* */ } });
      btnGroup.appendChild(btn);
    }
    row.appendChild(btnGroup);
    return row;
  }

  private buildToggleRow(label: string, checked: boolean, onChange: (v: boolean) => void): HTMLElement {
    const row = el('div', 'display:flex;align-items:center;justify-content:space-between;gap:12px;');
    row.appendChild(el('span', 'font-size:14px;color:#cbd5e1;', label));

    const toggle = el('div',
      `width:44px;height:24px;border-radius:12px;cursor:pointer;border:1px solid rgba(255,255,255,.15);background:${checked ? '#3b82f6' : '#374151'};position:relative;transition:background .2s;`,
    );
    const knob = el('div',
      `position:absolute;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;left:${checked ? '22px' : '2px'};transition:left .2s;`,
    );
    toggle.appendChild(knob);

    let currentState = checked;
    toggle.addEventListener('click', () => {
      currentState = !currentState;
      toggle.style.background = currentState ? '#3b82f6' : '#374151';
      knob.style.left = currentState ? '22px' : '2px';
      onChange(currentState);
    });
    row.appendChild(toggle);
    return row;
  }

  private buildSliderRow(label: string, value: number, onChange: (v: number) => void): HTMLElement {
    const row = el('div', 'display:flex;flex-direction:column;gap:4px;');
    const header = el('div', 'display:flex;justify-content:space-between;');
    header.appendChild(el('span', 'font-size:14px;color:#cbd5e1;', label));
    const valSpan = el('span', 'font-size:13px;color:#94a3b8;', String(value));
    header.appendChild(valSpan);
    row.appendChild(header);

    /* Custom range slider via a clickable bar */
    const bar = el('div',
      'width:100%;height:8px;background:#1e293b;border-radius:4px;cursor:pointer;position:relative;',
    );
    const fill = el('div',
      `height:100%;width:${value}%;background:linear-gradient(90deg,#3b82f6,#60a5fa);border-radius:4px;`,
    );
    bar.appendChild(fill);

    const updateBar = (pct: number) => {
      fill.style.width = pct + '%';
      valSpan.textContent = String(Math.round(pct));
    };

    bar.addEventListener('mousedown', (e) => {
      const rect = bar.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      updateBar(pct);
      onChange(Math.round(pct));

      const onMove = (ev: MouseEvent) => {
        const p = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
        updateBar(p);
        onChange(Math.round(p));
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    row.appendChild(bar);
    return row;
  }

  show(): void {
    this.container.style.display = '';
  }

  hide(): void {
    this.container.style.display = 'none';
  }

  render(_view: any): void {
    /* Client-side only; no server view needed. */
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.container.remove();
  }
}
