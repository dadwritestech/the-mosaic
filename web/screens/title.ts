// web/screens/title.ts — full-screen title / start menu.
// Shown before the overworld; has New Game, Continue, Options buttons.

import { select as sfxSelect, confirm as sfxConfirm } from '../audio/sfx';

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
/*  TitleScreen                                                        */
/* ------------------------------------------------------------------ */

export class TitleScreen {
  private container: HTMLElement;
  private disposed = false;
  private animFrame: number = 0;

  constructor(
    host: HTMLElement,
    private onAction: (cmd: string, body?: Record<string, unknown>) => void,
  ) {
    this.container = el('div', 'position:absolute;inset:0;z-index:100;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;user-select:none;overflow:hidden;');
    host.appendChild(this.container);
    this.build();
  }

  private build(): void {
    /* ---- animated gradient background ---- */
    const bg = el('div',
      'position:absolute;inset:0;background:linear-gradient(135deg,#0a0e1a 0%,#141c34 25%,#1a2844 50%,#141c34 75%,#0a0e1a 100%);background-size:400% 400%;animation:titleBgShift 12s ease infinite;',
    );
    this.container.appendChild(bg);

    /* ---- inject keyframes once ---- */
    if (!document.getElementById('title-screen-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'title-screen-styles';
      styleEl.textContent = `
        @keyframes titleBgShift {
          0%   { background-position:0% 50% }
          50%  { background-position:100% 50% }
          100% { background-position:0% 50% }
        }
        @keyframes titlePulse {
          0%,100% { text-shadow:0 0 20px rgba(240,184,64,.3),0 0 60px rgba(240,184,64,.1) }
          50%     { text-shadow:0 0 30px rgba(240,184,64,.5),0 0 80px rgba(240,184,64,.2) }
        }
        @keyframes titleFloat {
          0%,100% { transform:translateY(0) }
          50%     { transform:translateY(-6px) }
        }
      `;
      document.head.appendChild(styleEl);
    }

    /* ---- floating particles (subtle dots) ---- */
    const particles = el('div', 'position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden;');
    for (let i = 0; i < 30; i++) {
      const dot = el('div',
        `position:absolute;width:${2 + Math.random() * 3}px;height:${2 + Math.random() * 3}px;border-radius:50%;background:rgba(240,184,64,${0.15 + Math.random() * 0.2});left:${Math.random() * 100}%;top:${Math.random() * 100}%;animation:titleParticle ${8 + Math.random() * 12}s linear infinite;opacity:${0.3 + Math.random() * 0.4};`,
      );
      particles.appendChild(dot);
    }
    this.container.appendChild(particles);

    /* inject particle keyframe */
    if (!document.getElementById('title-particle-style')) {
      const s = document.createElement('style');
      s.id = 'title-particle-style';
      s.textContent = `@keyframes titleParticle { 0%{transform:translateY(0) translateX(0)} 25%{transform:translateY(-30px) translateX(15px)} 50%{transform:translateY(-10px) translateX(-10px)} 75%{transform:translateY(-40px) translateX(5px)} 100%{transform:translateY(0) translateX(0)} }`;
      document.head.appendChild(s);
    }

    /* ---- centered content ---- */
    const content = el('div',
      'position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;',
    );

    /* ---- game logo ---- */
    const logoWrap = el('div', 'animation:titleFloat 4s ease-in-out infinite;text-align:center;');

    const logoTop = el('div',
      'font-size:16px;font-weight:600;letter-spacing:8px;color:#94a3b8;margin-bottom:8px;text-transform:uppercase;',
      'THE',
    );

    const logoMain = el('div',
      'font-size:56px;font-weight:900;letter-spacing:12px;color:#f0b840;animation:titlePulse 3s ease-in-out infinite;',
      'MOSAIC',
    );

    logoWrap.appendChild(logoTop);
    logoWrap.appendChild(logoMain);
    content.appendChild(logoWrap);

    /* ---- subtitle ---- */
    const subtitle = el('div',
      'font-size:14px;color:#64748b;letter-spacing:4px;margin-top:-12px;',
      'A Pok\u00e9mon Adventure',
    );
    content.appendChild(subtitle);

    /* ---- button group ---- */
    const btnGroup = el('div', 'display:flex;flex-direction:column;gap:12px;margin-top:20px;min-width:220px;');

    const btnStyle =
      'width:100%;padding:14px 24px;border-radius:12px;border:1px solid rgba(255,255,255,.15);font-size:16px;font-weight:700;cursor:pointer;font-family:inherit;letter-spacing:2px;transition:background .2s,transform .1s;';

    /* New Game */
    const newGameBtn = el('button', btnStyle + 'background:rgba(240,184,64,.15);color:#f0b840;', 'New Game');
    newGameBtn.addEventListener('mouseenter', () => {
      newGameBtn.style.background = 'rgba(240,184,64,.3)';
      newGameBtn.style.transform = 'scale(1.03)';
      try { sfxSelect(); } catch { /* */ }
    });
    newGameBtn.addEventListener('mouseleave', () => {
      newGameBtn.style.background = 'rgba(240,184,64,.15)';
      newGameBtn.style.transform = '';
    });
    newGameBtn.addEventListener('click', () => {
      try { sfxConfirm(); } catch { /* */ }
      this.onAction('newGame');
    });
    btnGroup.appendChild(newGameBtn);

    /* Continue (only if save exists — controlled via render) */
    const continueBtn = el('button', btnStyle + 'background:rgba(59,130,246,.15);color:#3b82f6;', 'Continue');
    continueBtn.addEventListener('mouseenter', () => {
      continueBtn.style.background = 'rgba(59,130,246,.3)';
      continueBtn.style.transform = 'scale(1.03)';
      try { sfxSelect(); } catch { /* */ }
    });
    continueBtn.addEventListener('mouseleave', () => {
      continueBtn.style.background = 'rgba(59,130,246,.15)';
      continueBtn.style.transform = '';
    });
    continueBtn.addEventListener('click', () => {
      try { sfxConfirm(); } catch { /* */ }
      this.onAction('loadGame');
    });
    btnGroup.appendChild(continueBtn);

    /* Options */
    const optionsBtn = el('button', btnStyle + 'background:rgba(255,255,255,.08);color:#cbd5e1;', 'Options');
    optionsBtn.addEventListener('mouseenter', () => {
      optionsBtn.style.background = 'rgba(255,255,255,.15)';
      optionsBtn.style.transform = 'scale(1.03)';
      try { sfxSelect(); } catch { /* */ }
    });
    optionsBtn.addEventListener('mouseleave', () => {
      optionsBtn.style.background = 'rgba(255,255,255,.08)';
      optionsBtn.style.transform = '';
    });
    optionsBtn.addEventListener('click', () => {
      try { sfxSelect(); } catch { /* */ }
      this.onAction('openOptions');
    });
    btnGroup.appendChild(optionsBtn);

    content.appendChild(btnGroup);
    this.container.appendChild(content);

    /* ---- version footer ---- */
    const footer = el('div',
      'position:absolute;bottom:16px;left:0;right:0;text-align:center;font-size:11px;color:#475569;z-index:2;',
      'Powered by Pok\u00e9mon Showdown',
    );
    this.container.appendChild(footer);

    /* store refs for render updates */
    (this as any)._continueBtn = continueBtn;
  }

  show(): void {
    this.container.style.display = '';
  }

  hide(): void {
    this.container.style.display = 'none';
  }

  render(view: any): void {
    /* Gate Continue button visibility based on hasSave */
    const btn = (this as any)._continueBtn as HTMLElement | undefined;
    if (btn) {
      if (view.hasSave) {
        btn.style.display = '';
        btn.style.opacity = '1';
      } else {
        btn.style.opacity = '0.3';
        btn.style.pointerEvents = 'none';
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.container.remove();
    const styles = ['title-screen-styles', 'title-particle-style'];
    for (const id of styles) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }
  }
}
