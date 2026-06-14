import { Hud } from '../ui/hud';
import type { View } from '../net';

export class BattleScreen {
  private container: HTMLDivElement;
  private background: HTMLDivElement;
  private selfImg: HTMLImageElement;
  private foeImg: HTMLImageElement;
  private hud: Hud;
  private selfKey = '';
  private foeKey = '';
  private endedEl: HTMLDivElement | null = null;
  private endKey: ((e: KeyboardEvent) => void) | null = null;

  constructor(private host: HTMLElement, private onAction: (cmd: string, body?: Record<string, unknown>) => void) {
    this.container = document.createElement('div');
    this.container.style.cssText = 'position:absolute;inset:0;background:#afe3ff;overflow:hidden;font-family:"Segoe UI",system-ui,sans-serif;';
    
    // Background scenery
    this.background = document.createElement('div');
    this.background.style.cssText = 'position:absolute;inset:0;background:linear-gradient(to bottom, #74b9ff 0%, #e0f2fe 50%, #8ac45a 50%, #65a30d 100%);';
    this.container.appendChild(this.background);

    // Battle pads
    const createPad = (bottom: string, left: string, right: string, width: string, height: string) => {
      const pad = document.createElement('div');
      pad.style.cssText = `position:absolute;bottom:${bottom};width:${width};height:${height};background:#73b24c;border-radius:50%;border:3px solid #5a9638;box-shadow:inset 0 0 20px rgba(0,0,0,0.1);`;
      if (left) pad.style.left = left;
      if (right) pad.style.right = right;
      return pad;
    };
    
    // Self pad
    this.container.appendChild(createPad('12%', '10%', '', '35%', '15%')); 
    // Foe pad
    this.container.appendChild(createPad('35%', '', '15%', '28%', '10%')); 

    // Self Sprite
    this.selfImg = document.createElement('img');
    // Centered horizontally over the pad (left 10% + half of 35% = 27.5%).
    // Bottom aligned slightly above the vertical center of the pad (12% + half of 15% = 19.5%).
    this.selfImg.style.cssText = 'position:absolute;bottom:18%;left:27.5%;transform:translateX(-50%);image-rendering:pixelated;transform-origin:bottom center;transition:transform 0.2s, filter 0.2s;z-index:2;';
    this.container.appendChild(this.selfImg);

    // Foe Sprite
    this.foeImg = document.createElement('img');
    // Centered horizontally over the pad (right 15% + half of 28% = 29%).
    // Bottom aligned slightly above the vertical center of the pad (35% + half of 10% = 40%).
    this.foeImg.style.cssText = 'position:absolute;bottom:39%;right:29%;transform:translateX(50%);image-rendering:pixelated;transform-origin:bottom center;transition:transform 0.2s, filter 0.2s;z-index:1;';
    this.container.appendChild(this.foeImg);

    this.host.appendChild(this.container);

    this.hud = new Hud(this.container, {
      onMove: (i) => this.onAction('turn', { index: i }),
      onSwitch: (i) => this.onAction('switchMon', { index: i }),
      onBall: (ball) => this.onAction('catch', { ball }),
    });
  }

  // Animate attack/hit using simple CSS transforms
  private triggerAnim(img: HTMLImageElement, type: 'hit' | 'attack', baseScale: number) {
    img.style.transition = 'none';
    const xOffset = img === this.selfImg ? '-50%' : '50%';
    if (type === 'hit') {
      img.style.filter = 'brightness(2) sepia(1) hue-rotate(-50deg) saturate(5)';
      img.style.transform = `translateX(calc(${xOffset} - 10px)) scale(${baseScale})`;
      setTimeout(() => {
        img.style.transition = 'transform 0.2s, filter 0.2s';
        img.style.filter = 'none';
        img.style.transform = `translateX(${xOffset}) scale(${baseScale})`;
      }, 50);
    } else {
      img.style.transform = `translateX(${xOffset}) translateY(-20px) scale(${baseScale * 1.1})`;
      setTimeout(() => {
        img.style.transition = 'transform 0.2s';
        img.style.transform = `translateX(${xOffset}) scale(${baseScale})`;
      }, 100);
    }
  }

  private getScale(heightm: number | undefined, isSelf: boolean): number {
    const h = Math.max(0.1, heightm || 1);
    // Base scale: multiply by 2.5 so a 1m tall pokemon is reasonably large (~240px from 96px sprite).
    let s = 2.5 * Math.min(2.5, Math.max(0.4, Math.pow(h, 0.4)));
    if (isSelf) s *= 1.3; // Self is closer to camera
    return s;
  }

  private selfScale = 1;
  private foeScale = 1;

  async render(view: View) {
    if (!view.self || !view.foe) return;

    if (view.self.species !== this.selfKey) {
      this.selfKey = view.self.species;
      this.selfScale = this.getScale(view.self.heightm, true);
      this.selfImg.style.transform = `translateX(-50%) scale(${this.selfScale})`;
      this.selfImg.src = `/pkmn/back/${view.self.num}.gif`;
      this.selfImg.onerror = () => this.selfImg.src = `/pkmn/back/${view.self.num}.png`; // fallback to gif if png missing
      this.selfImg.style.opacity = '0';
      setTimeout(() => this.selfImg.style.opacity = '1', 100);
    }
    
    if (view.foe.species !== this.foeKey) {
      this.foeKey = view.foe.species;
      this.foeScale = this.getScale(view.foe.heightm, false);
      this.foeImg.style.transform = `translateX(50%) scale(${this.foeScale})`;
      this.foeImg.src = `/pkmn/${view.foe.num}.gif`;
      this.foeImg.onerror = () => this.foeImg.src = `/pkmn/${view.foe.num}.png`;
      this.foeImg.style.opacity = '0';
      setTimeout(() => this.foeImg.style.opacity = '1', 100);
    }

    // Very basic anim trigger based on log parsing (client-side only trick)
    if (view.log) {
      const lastLine = view.log[view.log.length - 1] || '';
      if (lastLine.includes('lost') || lastLine.includes('hit')) {
        if (lastLine.includes(view.foe.species)) this.triggerAnim(this.foeImg, 'hit', this.foeScale);
        if (lastLine.includes(view.self.species)) this.triggerAnim(this.selfImg, 'hit', this.selfScale);
      } else if (lastLine.includes('used')) {
        if (lastLine.includes(view.foe.species)) this.triggerAnim(this.foeImg, 'attack', this.foeScale);
        if (lastLine.includes(view.self.species)) this.triggerAnim(this.selfImg, 'attack', this.selfScale);
      }
    }

    // Faint effect
    this.selfImg.style.opacity = view.self.hpPercent === 0 ? '0' : '1';
    this.foeImg.style.opacity = view.foe.hpPercent === 0 ? '0' : '1';

    this.hud.render({
      self: { name: `${view.self.species} L${view.self.level}`, hp: view.self.hpPercent, status: view.self.status, boosts: view.self.boosts ?? {}, volatiles: view.self.volatiles ?? [], item: view.self.heldItem || undefined },
      foe: { name: `${view.foe.species}`, hp: view.foe.hpPercent, status: view.foe.status, boosts: view.foe.boosts ?? {}, volatiles: view.foe.volatiles ?? [] },
      weather: view.weather ?? '', terrain: view.terrain ?? '',
      moves: view.moves, switches: view.switches ?? [], balls: view.balls ?? [],
      canCatch: view.canCatch, log: view.log,
      forceSwitch: !!view.forceSwitch,
    });

    if ((view as any).ended) this.showEnded((view as any).ended); else this.clearEnded();
  }

  private clearEnded() {
    if (this.endedEl) { this.endedEl.remove(); this.endedEl = null; }
    if (this.endKey) { window.removeEventListener('keydown', this.endKey); this.endKey = null; }
  }

  private showEnded(ended: any) {
    if (this.endedEl) return;
    const RC: Record<string, string> = { win: '#43e07d', caught: '#5db4ff', loss: '#ff7a6b', run: '#cbd5e1' };
    const color = RC[ended.result] ?? '#fff';
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;background:rgba(8,11,20,.5);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)';
    
    const card = document.createElement('div');
    card.className = 'hud-glass';
    card.style.cssText = 'min-width:300px;max-width:78%;padding:26px 32px;border-radius:22px;text-align:center;display:flex;flex-direction:column;gap:8px;color:#eef3ff;';
    
    const add = (text: string, css: string) => { const d = document.createElement('div'); d.textContent = text; d.style.cssText = css; card.appendChild(d); };
    
    for (const ln of (ended.lines ?? [ended.message]) as string[]) add(ln, `font-size:18px;font-weight:800;color:${color};text-shadow:0 1px 3px rgba(0,0,0,.4)`);
    
    const r = ended.rewards;
    if (r) {
      if (r.money) add(`+${r.money}₽`, 'font-size:14px;font-weight:600;color:#ffd76a;margin-top:4px');
      for (const e of (r.exp ?? [])) add(`${e.species} +${e.amount} EXP`, 'font-size:13px;color:#cbd9f2');
      for (const lu of (r.levelUps ?? [])) add(`${lu.species} grew to Lv ${lu.level}!${lu.evolutionInto ? ` It evolved into ${lu.evolutionInto}!` : ''}`, 'font-size:13px;font-weight:700;color:#9ee7ff');
      for (const it of (r.items ?? [])) add(`Found ${it}!`, 'font-size:13px;color:#d6c8ff');
    }
    
    const cont = document.createElement('button');
    cont.className = 'hud-btn';
    cont.textContent = 'Continue ▶';
    cont.style.cssText = 'pointer-events:auto;margin-top:12px;align-self:center;background:linear-gradient(135deg,#43e07d,#28c866);color:#06210f;font-size:16px;font-weight:800;padding:12px 30px;border:0;border-radius:99px;cursor:pointer';
    cont.addEventListener('click', () => this.onAction('battleContinue'));
    
    card.appendChild(cont);
    overlay.appendChild(card);
    this.host.appendChild(overlay);
    this.endedEl = overlay;
    
    this.endKey = (e: KeyboardEvent) => { 
      if (e.key === 'Enter' || e.key === ' ') { 
        e.preventDefault(); 
        if (this.endKey) { window.removeEventListener('keydown', this.endKey); this.endKey = null; }
        this.onAction('battleContinue'); 
      } 
    };
    window.addEventListener('keydown', this.endKey);
  }

  dispose() {
    this.clearEnded();
    this.hud.clear();
    this.container.remove();
  }
}
