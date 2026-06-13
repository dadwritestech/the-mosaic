import { getSettings, setSetting } from '../settings';

function el(tag: string, css?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (css) node.style.cssText = css;
  if (text !== undefined) node.textContent = text;
  return node;
}

export class Sidebar {
  private container: HTMLElement;
  private toggleBtn: HTMLElement;
  private contentPanel: HTMLElement;
  private settingsOverlay: HTMLElement | null = null;
  private isOpen: boolean;
  private currentData: any = null;

  constructor(private host: HTMLElement) {
    const s = getSettings();
    this.isOpen = s.sidebarOpen;

    this.container = el('div', `
      position: absolute;
      top: 60px;
      right: ${this.isOpen ? '20px' : '-280px'};
      width: 260px;
      bottom: 20px;
      z-index: 45;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
      transition: right 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
      font-family: 'Segoe UI', system-ui, sans-serif;
    `);

    // The content area that holds the cards
    this.contentPanel = el('div', `
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: auto;
      overflow-y: auto;
      scrollbar-width: none;
    `);
    
    // Toggle button hangs off the left edge
    this.toggleBtn = el('button', `
      position: absolute;
      top: 20px;
      left: -36px;
      width: 32px;
      height: 48px;
      background: rgba(18, 22, 36, 0.85);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.15);
      border-right: none;
      border-radius: 8px 0 0 8px;
      color: #cbd5e1;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      pointer-events: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s, color 0.2s;
    `, this.isOpen ? '›' : '‹');

    this.toggleBtn.addEventListener('click', () => this.toggle());
    this.toggleBtn.addEventListener('mouseenter', () => { this.toggleBtn.style.color = '#fff'; this.toggleBtn.style.background = 'rgba(30, 36, 50, 0.9)'; });
    this.toggleBtn.addEventListener('mouseleave', () => { this.toggleBtn.style.color = '#cbd5e1'; this.toggleBtn.style.background = 'rgba(18, 22, 36, 0.85)'; });

    // Settings cog button
    const configBtn = el('button', `
      align-self: flex-end;
      background: rgba(18, 22, 36, 0.7);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 50%;
      width: 36px;
      height: 36px;
      color: #94a3b8;
      font-size: 18px;
      cursor: pointer;
      pointer-events: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    `, '⚙');
    configBtn.addEventListener('click', () => this.openConfig());
    configBtn.addEventListener('mouseenter', () => { configBtn.style.color = '#fff'; configBtn.style.background = 'rgba(30, 36, 50, 0.9)'; });
    configBtn.addEventListener('mouseleave', () => { configBtn.style.color = '#94a3b8'; configBtn.style.background = 'rgba(18, 22, 36, 0.7)'; });

    this.container.appendChild(this.toggleBtn);
    this.container.appendChild(this.contentPanel);
    this.container.appendChild(configBtn);

    this.host.appendChild(this.container);
  }

  private toggle() {
    this.isOpen = !this.isOpen;
    setSetting('sidebarOpen', this.isOpen);
    this.container.style.right = this.isOpen ? '20px' : '-280px';
    this.toggleBtn.textContent = this.isOpen ? '›' : '‹';
  }

  private cardFrame(title: string): HTMLElement {
    const card = el('div', `
      background: rgba(16, 20, 30, 0.75);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      display: flex;
      flex-direction: column;
      gap: 10px;
    `);
    const hdr = el('div', 'font-size: 13px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;', title);
    card.appendChild(hdr);
    return card;
  }

  private renderPartyCard(data: any): HTMLElement {
    const card = this.cardFrame('Party');
    if (!data.party || data.party.length === 0) {
      card.appendChild(el('div', 'font-size: 13px; color: #64748b; font-style: italic;', 'No Pokémon.'));
      return card;
    }
    for (const p of data.party) {
      const row = el('div', 'display: flex; flex-direction: column; gap: 4px;');
      const header = el('div', 'display: flex; justify-content: space-between; font-size: 14px; font-weight: 600; color: #e2e8f0;');
      header.appendChild(el('span', '', p.species));
      header.appendChild(el('span', 'font-size: 12px; color: #94a3b8; font-weight: normal;', `Lv.${p.level}`));
      
      const barBg = el('div', 'height: 6px; background: rgba(0,0,0,0.4); border-radius: 3px; overflow: hidden;');
      const barFill = el('div', `height: 100%; width: ${p.hpPercent}%; background: ${p.hpPercent > 50 ? '#22c55e' : p.hpPercent > 20 ? '#eab308' : '#ef4444'}; transition: width 0.3s;`);
      barBg.appendChild(barFill);

      row.appendChild(header);
      row.appendChild(barBg);
      card.appendChild(row);
    }
    return card;
  }

  private renderPokedexCard(data: any): HTMLElement {
    const card = this.cardFrame('Pokédex');
    const seen = data.dexSeen || 0;
    const caught = data.dexCaught || 0;
    
    const row = el('div', 'display: flex; justify-content: space-between; align-items: baseline;');
    row.appendChild(el('span', 'font-size: 24px; font-weight: 800; color: #38bdf8;', String(caught)));
    row.appendChild(el('span', 'font-size: 14px; color: #94a3b8;', `/ ${seen} seen`));
    
    card.appendChild(row);
    return card;
  }

  private renderMapCard(data: any): HTMLElement {
    const card = this.cardFrame('Location');
    const loc = (data.locationId || 'Unknown').replace(/-/g, ' ');
    card.appendChild(el('div', 'font-size: 16px; font-weight: 600; color: #e2e8f0; text-transform: capitalize;', loc));
    
    const timeColor = data.time === 'night' ? '#8b5cf6' : data.time === 'morning' ? '#f59e0b' : '#38bdf8';
    const timeIcon = data.time === 'night' ? '🌙' : data.time === 'morning' ? '🌅' : '☀️';
    
    card.appendChild(el('div', `font-size: 14px; color: ${timeColor}; display: flex; align-items: center; gap: 6px;`, `${timeIcon} ${data.time || 'day'}`));
    return card;
  }

  private renderProgressCard(data: any): HTMLElement {
    const card = this.cardFrame('Progress');
    const badges = data.badges || 0;
    card.appendChild(el('div', 'font-size: 14px; color: #e2e8f0;', `🏆 Badges: ${badges}`));
    return card;
  }

  private renderWealthCard(data: any): HTMLElement {
    const card = this.cardFrame('Wealth');
    const money = data.money || 0;
    card.appendChild(el('div', 'font-size: 20px; font-weight: 700; color: #fbbf24;', `${money}₽`));
    return card;
  }

  render(data: any) {
    if (!data) return;
    this.currentData = data;
    this.contentPanel.replaceChildren();
    
    const s = getSettings();
    for (const cardType of s.sidebarCards) {
      if (cardType === 'party') this.contentPanel.appendChild(this.renderPartyCard(data));
      else if (cardType === 'pokedex') this.contentPanel.appendChild(this.renderPokedexCard(data));
      else if (cardType === 'map') this.contentPanel.appendChild(this.renderMapCard(data));
      else if (cardType === 'progress') this.contentPanel.appendChild(this.renderProgressCard(data));
      else if (cardType === 'wealth') this.contentPanel.appendChild(this.renderWealthCard(data));
    }
  }

  private openConfig() {
    if (this.settingsOverlay) return;
    const overlay = el('div', `
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(4px);
      z-index: 50;
      pointer-events: auto;
      display: flex;
      align-items: center;
      justify-content: center;
    `);

    const modal = el('div', `
      background: rgba(20, 28, 44, 0.95);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 12px;
      padding: 24px;
      width: 300px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      color: #fff;
    `);

    modal.appendChild(el('div', 'font-size: 18px; font-weight: 700; color: #f0b840;', 'Configure Sidebar'));
    modal.appendChild(el('div', 'font-size: 14px; color: #94a3b8;', 'Select up to 3 cards to display.'));

    const opts = ['party', 'pokedex', 'map', 'progress', 'wealth'];
    const s = getSettings();
    let selected = new Set(s.sidebarCards);

    const checks = el('div', 'display: flex; flex-direction: column; gap: 10px;');
    for (const o of opts) {
      const row = el('div', 'display: flex; align-items: center; gap: 8px; cursor: pointer;');
      const box = el('div', `
        width: 18px; height: 18px; border-radius: 4px; 
        border: 1px solid ${selected.has(o) ? '#3b82f6' : 'rgba(255,255,255,0.2)'};
        background: ${selected.has(o) ? '#3b82f6' : 'transparent'};
        display: flex; align-items: center; justify-content: center;
      `);
      if (selected.has(o)) box.textContent = '✓';
      
      const label = el('span', 'font-size: 14px; text-transform: capitalize;', o);
      
      row.appendChild(box);
      row.appendChild(label);
      
      row.addEventListener('click', () => {
        if (selected.has(o)) {
          selected.delete(o);
        } else {
          if (selected.size >= 3) return; // max 3
          selected.add(o);
        }
        
        box.style.background = selected.has(o) ? '#3b82f6' : 'transparent';
        box.style.border = `1px solid ${selected.has(o) ? '#3b82f6' : 'rgba(255,255,255,0.2)'}`;
        box.textContent = selected.has(o) ? '✓' : '';
      });
      checks.appendChild(row);
    }
    modal.appendChild(checks);

    const saveBtn = el('button', `
      margin-top: 8px;
      padding: 10px;
      background: #3b82f6;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    `, 'Save');
    saveBtn.addEventListener('click', () => {
      setSetting('sidebarCards', Array.from(selected));
      overlay.remove();
      this.settingsOverlay = null;
      if (this.currentData) this.render(this.currentData);
    });
    
    modal.appendChild(saveBtn);
    overlay.appendChild(modal);
    this.host.appendChild(overlay);
    this.settingsOverlay = overlay;
  }
}
