// web/screens/starter.ts — UI overlay for picking a starter Pokémon

import { select as sfxSelect, confirm as sfxConfirm } from '../audio/sfx';

function el(tag: string, css?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (css) node.style.cssText = css;
  if (text !== undefined) node.textContent = text;
  return node;
}

export class StarterScreen {
  private container: HTMLElement;
  private disposed = false;
  private choicesContainer: HTMLElement;

  constructor(
    host: HTMLElement,
    private onAction: (cmd: string, body?: Record<string, unknown>) => void,
  ) {
    this.container = el('div', 'position:absolute;inset:0;z-index:100;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;user-select:none;overflow:hidden;background:rgba(10,14,26,0.9);backdrop-filter:blur(10px);display:flex;flex-direction:column;align-items:center;justify-content:center;');
    host.appendChild(this.container);

    const title = el('div', 'font-size:36px;font-weight:800;color:#f0b840;letter-spacing:4px;margin-bottom:12px;text-shadow:0 2px 10px rgba(240,184,64,0.3);', 'CHOOSE YOUR PARTNER');
    const subtitle = el('div', 'font-size:16px;color:#cbd5e1;margin-bottom:48px;letter-spacing:1px;', 'Three paths lie ahead. Which will you walk?');
    
    this.container.appendChild(title);
    this.container.appendChild(subtitle);

    this.choicesContainer = el('div', 'display:flex;gap:32px;align-items:center;justify-content:center;');
    this.container.appendChild(this.choicesContainer);
  }

  show(): void {
    this.container.style.display = 'flex';
  }

  hide(): void {
    this.container.style.display = 'none';
  }

  render(view: any): void {
    if (view.screen !== 'starter' || !view.choices) return;
    
    this.choicesContainer.innerHTML = ''; // clear

    view.choices.forEach((choice: { species: string, num: number }) => {
      const card = el('div', 'width:200px;height:280px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:transform 0.2s, background 0.2s, box-shadow 0.2s;position:relative;overflow:hidden;');
      
      const img = el('img', 'width:96px;height:96px;object-fit:contain;margin-bottom:24px;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.5));') as HTMLImageElement;
      
      // Use the local nginx sprite routing. Fall back to static png if the animated gif is missing for newer gens.
      img.src = `/pkmn/${choice.num}.gif`;
      img.onerror = () => img.src = `/pkmn/${choice.num}.png`;
      
      const name = el('div', 'font-size:24px;font-weight:700;color:#fff;letter-spacing:1px;', choice.species);
      
      card.appendChild(img);
      card.appendChild(name);

      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-10px) scale(1.05)';
        card.style.background = 'rgba(255,255,255,0.1)';
        card.style.boxShadow = '0 10px 20px rgba(0,0,0,0.3), 0 0 15px rgba(240,184,64,0.3)';
        try { sfxSelect(); } catch { /* */ }
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
        card.style.background = 'rgba(255,255,255,0.05)';
        card.style.boxShadow = '';
      });
      
      card.addEventListener('click', () => {
        if (confirm(`Will you choose the Pokémon ${choice.species}?`)) {
          try { sfxConfirm(); } catch { /* */ }
          this.onAction('chooseStarter', { species: choice.species });
        }
      });

      this.choicesContainer.appendChild(card);
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.container.remove();
  }
}
