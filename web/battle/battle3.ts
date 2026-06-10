import { Nameplate } from './nameplate';

const TYPE_COLOR: Record<string, string> = {
  Normal: '#9099a1', Fire: '#ff9d55', Water: '#5090d6', Electric: '#e0c133',
  Grass: '#63bc5a', Ice: '#73cec0', Fighting: '#ce4069', Poison: '#ab6ac8',
  Ground: '#d97845', Flying: '#8fa9de', Psychic: '#fa7179', Bug: '#90c12c',
  Rock: '#c5b78c', Ghost: '#5269ad', Dragon: '#0b6dc3', Dark: '#5a5366',
  Steel: '#5a8ea1', Fairy: '#ec8fe6',
};

const STATUS_COLORS: Record<string, string> = {
  par: '#d8a200', psn: '#9a3fb0', tox: '#9a3fb0', brn: '#d8642a', slp: '#7a8694', frz: '#37b0d8',
};

const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
const STAT_LABELS: Record<string, string> = {
  hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe',
};

/* ------------------------------------------------------------------ */
/*  DOM helpers — zero innerHTML                                       */
/* ------------------------------------------------------------------ */

function el(tag: string, css?: string, text?: string): HTMLElement | HTMLImageElement {
  const node = tag === 'img'
    ? (document.createElement('img') as HTMLImageElement)
    : document.createElement(tag);
  if (css) node.style.cssText = css;
  if (text !== undefined) node.textContent = text;
  return node;
}

function append(parent: HTMLElement, ...children: (HTMLElement | HTMLImageElement)[]): void {
  for (const c of children) parent.appendChild(c);
}

/* ------------------------------------------------------------------ */
/*  BattleScreenV2                                                     */
/* ------------------------------------------------------------------ */

export class BattleScreenV2 {
  /* --- stage elements --- */
  private container: HTMLElement;
  private bgImg: HTMLElement;
  private foeImg: HTMLImageElement;
  private playerImg: HTMLImageElement;
  private foeNameplate: Nameplate;
  private selfNameplate: Nameplate;
  private weatherChip: HTMLElement;
  private bottomPanel: HTMLElement;
  private logLine: HTMLElement;
  private commandArea: HTMLElement;

  /* --- stats panel --- */
  private statsPanel: HTMLElement | null = null;
  private statsToggle: HTMLElement;

  /* --- tooltip --- */
  private tooltip: HTMLElement | null = null;

  /* --- state --- */
  private mode: 'command' | 'fight' | 'bag' | 'party' = 'command';
  private lastFoeNum: number | undefined;
  private lastSelfNum: number | undefined;
  private _lastView: any;

  constructor(
    host: HTMLElement,
    private onAction: (cmd: string, body?: Record<string, unknown>) => void,
  ) {
    /* ---- stage container ---- */
    this.container = el('div', 'position:absolute;inset:0;overflow:hidden;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;user-select:none;');
    host.appendChild(this.container);

    /* ---- background: clean sky→grass gradient (own platforms, no misaligned bg) ---- */
    this.bgImg = el('div', 'position:absolute;inset:0;z-index:0;background:linear-gradient(#bfe9ff 0%,#d7f2ff 48%,#bfe6a8 48%,#a6db96 100%);');
    this.container.appendChild(this.bgImg);

    /* ---- platform ovals — sprites stand ON these so nothing floats ---- */
    const FOE = { x: 70, y: 40 }, SELF = { x: 28, y: 72 };
    const platform = (cx: number, cy: number, w: number) => el('div',
      `position:absolute;left:${cx}%;top:${cy}%;width:${w}px;height:${Math.round(w * 0.26)}px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(ellipse at center,#cfe3a8 0%,#bcd693 60%,#a7c87d 100%);box-shadow:0 6px 14px rgba(0,0,0,.18);z-index:1;`);
    this.container.appendChild(platform(FOE.x, FOE.y, 210));
    this.container.appendChild(platform(SELF.x, SELF.y, 290));

    /* ---- foe sprite: bottom-centre anchored on the foe platform ---- */
    this.foeImg = document.createElement('img') as HTMLImageElement;
    this.foeImg.style.cssText = `position:absolute;left:${FOE.x}%;top:${FOE.y}%;image-rendering:pixelated;z-index:2;transform-origin:50% 100%;transform:translate(-50%,-100%) scale(2.2);`;
    this.container.appendChild(this.foeImg);

    /* ---- player sprite: bottom-centre anchored on the player platform ---- */
    this.playerImg = document.createElement('img') as HTMLImageElement;
    this.playerImg.style.cssText = `position:absolute;left:${SELF.x}%;top:${SELF.y}%;image-rendering:pixelated;z-index:2;transform-origin:50% 100%;transform:translate(-50%,-100%) scale(2.6);`;
    this.container.appendChild(this.playerImg);

    /* ---- nameplates ---- */
    this.foeNameplate = new Nameplate('foe');
    this.foeNameplate.el.style.cssText += ';position:absolute;top:8%;left:6%;z-index:3;';
    this.container.appendChild(this.foeNameplate.el);

    this.selfNameplate = new Nameplate('self');
    this.selfNameplate.el.style.cssText += ';position:absolute;top:50%;right:6%;z-index:3;';
    this.container.appendChild(this.selfNameplate.el);

    /* ---- weather / terrain chip ---- */
    this.weatherChip = el('div',
      'position:absolute;top:4%;left:50%;transform:translateX(-50%);z-index:2;display:none;padding:4px 14px;border-radius:12px;background:rgba(30,40,60,.85);color:#e2e8f0;font-size:12px;font-weight:600;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);white-space:nowrap;',
    );
    this.container.appendChild(this.weatherChip);

    /* ---- bottom panel ---- */
    this.bottomPanel = el('div',
      'position:absolute;left:0;right:0;bottom:0;background:#1a2336;color:#fff;padding:10px;z-index:3;display:flex;flex-direction:column;gap:8px;',
    );
    this.container.appendChild(this.bottomPanel);

    /* ---- log line ---- */
    this.logLine = el('div', 'min-height:22px;font-size:14px;line-height:1.35;word-break:break-word;');
    this.bottomPanel.appendChild(this.logLine);

    /* ---- stats toggle (top-right of panel) ---- */
    this.statsToggle = el('button',
      'position:absolute;top:8px;right:10px;z-index:5;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);color:#cbd5e1;font-size:12px;padding:3px 8px;border-radius:6px;cursor:pointer;font-family:inherit;',
      '📊 Stats',
    );
    this.statsToggle.addEventListener('click', () => this.toggleStats());
    this.bottomPanel.appendChild(this.statsToggle);

    /* ---- command area ---- */
    this.commandArea = el('div', 'display:flex;flex-direction:column;gap:8px;position:relative;');
    this.bottomPanel.appendChild(this.commandArea);
  }

  /* ================================================================ */
  /*  public API                                                       */
  /* ================================================================ */

  render(view: any): void {
    this._lastView = view;

    /* --- sprites (only update src when num changes, avoids gif restart) --- */
    if (view.foe.num !== this.lastFoeNum) {
      this.foeImg.src = `/pkmn/${view.foe.num}.gif`;
      this.lastFoeNum = view.foe.num;
    }
    if (view.self.num !== this.lastSelfNum) {
      this.playerImg.src = `/pkmn/back/${view.self.num}.gif`;
      this.lastSelfNum = view.self.num;
    }

    /* --- nameplates --- */
    this.foeNameplate.update({
      name: view.foe.species,
      level: view.foe.level,
      gender: 'N',
      hpPercent: view.foe.hpPercent,
      status: view.foe.status,
    });
    this.selfNameplate.update({
      name: view.self.species,
      level: view.self.level,
      gender: view.self.gender,
      hpPercent: view.self.hpPercent,
      hp: view.self.hp,
      maxHp: view.self.maxHp,
      status: view.self.status,
    });

    /* --- weather / terrain chip --- */
    const parts: string[] = [];
    if (view.weather) parts.push(view.weather);
    if (view.terrain) parts.push(view.terrain);
    if (parts.length) {
      this.weatherChip.style.display = '';
      this.weatherChip.textContent = parts.join(' · ');
    } else {
      this.weatherChip.style.display = 'none';
    }

    /* --- log --- */
    this.logLine.textContent = view.log;

    /* --- battle over? show the result + a Continue button, don't auto-close --- */
    if (view.ended) {
      this.clearStatsPanel();
      this.drawEnded(view.ended);
      return;
    }

    /* --- reset mode each render (turn-based flow) --- */
    this.mode = 'command';
    this.clearStatsPanel();
    this.redrawCommand();
  }

  private drawEnded(ended: any): void {
    if (this.tooltip) { this.tooltip.remove(); this.tooltip = null; }
    while (this.commandArea.firstChild) this.commandArea.removeChild(this.commandArea.firstChild);
    const colors: Record<string, string> = { win: '#f0b840', loss: '#e5533a', caught: '#46d160', run: '#9fb3d1' };
    const wrap = el('div', 'display:flex;flex-direction:column;align-items:center;gap:10px;padding:4px 0;');
    const lines = (ended.lines ?? [ended.message]) as string[];
    for (const ln of lines) append(wrap, el('div', `font-size:15px;font-weight:700;color:${colors[ended.result] ?? '#fff'};text-align:center;`, ln));
    const cont = el('button', 'pointer-events:auto;padding:10px 30px;border-radius:10px;border:0;background:#3b82f6;color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;');
    cont.textContent = 'Continue ▶';
    cont.addEventListener('click', () => this.onAction('battleContinue'));
    append(wrap, cont);
    append(this.commandArea, wrap);
  }

  dispose(): void {
    this.container.remove();
  }

  /* ================================================================ */
  /*  command-area redraw                                              */
  /* ================================================================ */

  private redrawCommand(): void {
    this.hideTooltip();
    while (this.commandArea.firstChild) {
      this.commandArea.removeChild(this.commandArea.firstChild);
    }
    switch (this.mode) {
      case 'command': this.drawCommand(); break;
      case 'fight':   this.drawFight();   break;
      case 'bag':     this.drawBag();     break;
      case 'party':   this.drawParty();   break;
    }
  }

  /* ---- command (main menu) ---- */

  private drawCommand(): void {
    const view = this._lastView;
    const row = el('div', 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center;');

    const actions: { label: string; emoji: string; mode?: 'fight' | 'bag' | 'party'; action?: string }[] = [
      { label: 'FIGHT',   emoji: '⚔️',  mode: 'fight' },
      { label: 'BAG',     emoji: '🎒',  mode: 'bag' },
      { label: 'POKéMON', emoji: '⬤',   mode: 'party' },
    ];
    if (view?.isWild) {
      actions.push({ label: 'RUN', emoji: '🏃', action: 'run' });
    }

    for (const a of actions) {
      const btn = el('button',
        'flex:1 1 0;min-width:72px;padding:12px 8px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;text-align:center;transition:background .15s;',
        `${a.emoji} ${a.label}`,
      );
      btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(255,255,255,.18)'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(255,255,255,.08)'; });
      btn.addEventListener('click', () => {
        if (a.mode) { this.mode = a.mode; this.redrawCommand(); }
        if (a.action) { this.onAction(a.action); }
      });
      row.appendChild(btn);
    }
    append(this.commandArea, row);
  }

  /* ---- fight (move grid) ---- */

  private drawFight(): void {
    const view = this._lastView;
    if (!view) return;

    const moves = view.moves ?? [];
    const grid = el('div', 'display:grid;grid-template-columns:1fr 1fr;gap:6px;');

    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      const typeColor = TYPE_COLOR[m.type] ?? '#6b7280';
      grid.appendChild(this.createMoveButton(m, typeColor, i));
    }

    const backBtn = el('button',
      'margin-top:6px;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);color:#fff;font-size:13px;cursor:pointer;font-family:inherit;',
      '← Back',
    );
    backBtn.addEventListener('click', () => { this.mode = 'command'; this.redrawCommand(); });

    append(this.commandArea, grid, backBtn);
  }

  private createMoveButton(m: any, typeColor: string, index: number): HTMLElement {
    const btn = el('div',
      `padding:8px 10px;border-radius:10px;background:${typeColor};color:#fff;cursor:pointer;position:relative;min-height:64px;display:flex;flex-direction:column;justify-content:space-between;transition:filter .15s;border:2px solid rgba(255,255,255,.2);`,
    );

    /* name row + eff badge */
    const nameRow = el('div', 'display:flex;justify-content:space-between;align-items:center;gap:4px;');
    const nameSpan = el('span', 'font-weight:700;font-size:13px;');
    nameSpan.textContent = m.name;
    nameRow.appendChild(nameSpan);

    const badge = this.effBadge(m.eff);
    if (badge) nameRow.appendChild(badge);

    /* type + pp */
    const sub = el('div', 'font-size:11px;opacity:.85;margin-top:2px;');
    sub.textContent = `${m.type.toUpperCase()}  PP ${m.pp}/${m.maxpp}`;

    /* category tag */
    const catTag = el('span',
      'display:inline-block;font-size:10px;padding:1px 5px;border-radius:4px;background:rgba(0,0,0,.35);margin-top:3px;align-self:flex-start;',
    );
    catTag.textContent = m.category;

    /* info icon */
    const infoIcon = el('span', 'position:absolute;top:6px;right:8px;font-size:13px;opacity:.7;cursor:help;');
    infoIcon.textContent = 'ⓘ';

    append(btn, nameRow, sub, catTag, infoIcon);

    /* tooltip on hover */
    btn.addEventListener('mouseenter', () => {
      btn.style.filter = 'brightness(1.15)';
      this.showTooltip(btn, m);
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.filter = '';
      this.hideTooltip();
    });

    /* click — use the move's own server index (1-based), not the grid position */
    btn.addEventListener('click', () => { this.onAction('turn', { index: m.index ?? index } ); });

    return btn;
  }

  private effBadge(eff: number | null): HTMLElement | null {
    if (eff === null || eff === 1) return null;
    const badge = el('span',
      'font-size:10px;font-weight:700;padding:1px 5px;border-radius:4px;white-space:nowrap;',
    );
    if (eff === 0)       { badge.textContent = 'NO EFFECT'; badge.style.background = '#444'; }
    else if (eff >= 4)   { badge.textContent = '4×';       badge.style.background = '#2ecc71'; }
    else if (eff >= 2)   { badge.textContent = '2×';       badge.style.background = '#2ecc71'; }
    else                  { badge.textContent = eff === 0.5 ? '½×' : '¼×'; badge.style.background = '#7f8c8d'; }
    return badge;
  }

  private showTooltip(anchor: HTMLElement, m: any): void {
    this.hideTooltip();
    const tip = el('div',
      'position:absolute;z-index:10;background:rgba(15,20,35,.95);color:#e2e8f0;padding:8px 12px;border-radius:8px;font-size:12px;line-height:1.4;pointer-events:none;max-width:220px;border:1px solid rgba(255,255,255,.15);box-shadow:0 4px 12px rgba(0,0,0,.4);',
    );

    const power = m.power != null ? `${m.power}` : '—';
    const acc = m.accuracy != null ? `${m.accuracy}%` : '—';
    const line1 = el('div', 'margin-bottom:3px;');
    line1.textContent = `Power: ${power} · Acc: ${acc}`;
    const line2 = el('div', 'color:#94a3b8;font-size:11px;');
    line2.textContent = m.shortDesc ?? '';
    append(tip, line1, line2);

    /* position above button, relative to container */
    const rect = anchor.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();
    tip.style.left = `${rect.left - containerRect.left}px`;
    tip.style.top = `${rect.top - containerRect.top - 80}px`;

    this.container.appendChild(tip);
    this.tooltip = tip;
  }

  private hideTooltip(): void {
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
  }

  /* ---- bag ---- */

  private drawBag(): void {
    const view = this._lastView;
    if (!view) return;

    const bagItems = view.bag ?? [];
    const balls = view.balls ?? [];

    if (bagItems.length) {
      const label = el('div', 'font-size:12px;font-weight:600;color:#94a3b8;margin-bottom:4px;', 'Items');
      append(this.commandArea, label);

      for (const item of bagItems) {
        const row = el('div',
          'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.05);margin-bottom:4px;',
        );
        const info = el('span', 'font-size:13px;');
        info.textContent = `${item.name} ×${item.count} — ${item.effect}`;
        const useBtn = el('button',
          'font-size:12px;padding:4px 10px;border-radius:6px;border:none;background:#3b82f6;color:#fff;cursor:pointer;font-family:inherit;white-space:nowrap;',
          'Use',
        );
        useBtn.addEventListener('click', () => {
          this.onAction('useItemBattle', { itemId: item.itemId });
        });
        append(row, info, useBtn);
        this.commandArea.appendChild(row);
      }
    }

    if (view.canCatch && balls.length) {
      const sep = el('div', 'height:1px;background:rgba(255,255,255,.1);margin:6px 0;');
      this.commandArea.appendChild(sep);

      const label = el('div', 'font-size:12px;font-weight:600;color:#94a3b8;margin-bottom:4px;', 'Poké Balls');
      this.commandArea.appendChild(label);

      for (const ball of balls) {
        const btn = el('button',
          'width:100%;text-align:left;padding:7px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);color:#fff;font-size:13px;cursor:pointer;font-family:inherit;margin-bottom:4px;',
          `Throw ${ball.name} (${ball.count})`,
        );
        btn.addEventListener('click', () => {
          this.onAction('catch', { ball: ball.ballType });
        });
        this.commandArea.appendChild(btn);
      }
    }

    const backBtn = el('button',
      'margin-top:6px;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);color:#fff;font-size:13px;cursor:pointer;font-family:inherit;',
      '← Back',
    );
    backBtn.addEventListener('click', () => { this.mode = 'command'; this.redrawCommand(); });
    this.commandArea.appendChild(backBtn);
  }

  /* ---- party (switch) ---- */

  private drawParty(): void {
    const view = this._lastView;
    if (!view) return;

    const switches = view.switches ?? [];

    for (const s of switches) {
      const row = el('div',
        'display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.05);margin-bottom:4px;',
      );
      if (s.fainted) {
        row.style.opacity = '0.4';
      }

      /* small sprite */
      const sprite = document.createElement('img') as HTMLImageElement;
      sprite.src = `/pkmn/${s.num}.gif`;
      sprite.style.cssText = 'width:28px;height:28px;image-rendering:pixelated;flex-shrink:0;';
      row.appendChild(sprite);

      /* info column */
      const info = el('div', 'flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;');

      const nameLine = el('div', 'display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;');
      const nameSpan = el('span', 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;');
      nameSpan.textContent = `${s.species} Lv.${s.level}`;
      nameLine.appendChild(nameSpan);

      if (s.status) {
        const pill = el('span',
          'font-size:10px;font-weight:600;color:#fff;padding:1px 5px;border-radius:3px;flex-shrink:0;',
        );
        pill.style.background = STATUS_COLORS[s.status] ?? '#888';
        pill.textContent = s.status.toUpperCase();
        nameLine.appendChild(pill);
      }

      /* HP bar */
      const pct = Math.max(0, Math.min(100, s.hpPercent));
      const hpColor = pct > 50 ? '#46d160' : pct > 20 ? '#f5c043' : '#e5533a';
      const hpBar = el('div', 'height:6px;background:#0e1626;border-radius:3px;overflow:hidden;width:100%;');
      const hpFill = el('div', `height:100%;border-radius:3px;width:${pct}%;background:${hpColor};`);
      hpBar.appendChild(hpFill);

      append(info, nameLine, hpBar);
      row.appendChild(info);

      /* click to switch (not fainted) */
      if (!s.fainted) {
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => { this.onAction('switchMon', { index: s.index }); });
        row.addEventListener('mouseenter', () => { row.style.background = 'rgba(255,255,255,.1)'; });
        row.addEventListener('mouseleave', () => { row.style.background = 'rgba(255,255,255,.05)'; });
      }

      this.commandArea.appendChild(row);
    }

    const backBtn = el('button',
      'margin-top:6px;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);color:#fff;font-size:13px;cursor:pointer;font-family:inherit;',
      '← Back',
    );
    backBtn.addEventListener('click', () => { this.mode = 'command'; this.redrawCommand(); });
    this.commandArea.appendChild(backBtn);
  }

  /* ================================================================ */
  /*  stats panel                                                      */
  /* ================================================================ */

  private toggleStats(): void {
    if (this.statsPanel) {
      this.clearStatsPanel();
    } else {
      this.buildStatsPanel();
    }
  }

  private clearStatsPanel(): void {
    if (this.statsPanel) {
      this.statsPanel.remove();
      this.statsPanel = null;
    }
  }

  private buildStatsPanel(): void {
    const view = this._lastView;
    if (!view?.self) return;
    const self = view.self;

    const panel = el('div',
      'position:absolute;z-index:4;bottom:70px;right:10px;width:260px;background:rgba(15,22,36,.96);color:#e2e8f0;border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:12px 14px;font-size:13px;line-height:1.5;box-shadow:0 8px 24px rgba(0,0,0,.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;flex-direction:column;gap:4px;',
    );

    /* close */
    const closeBtn = el('button',
      'position:absolute;top:6px;right:8px;background:none;border:none;color:#94a3b8;font-size:16px;cursor:pointer;font-family:inherit;',
      '✕',
    );
    closeBtn.addEventListener('click', () => this.clearStatsPanel());
    panel.appendChild(closeBtn);

    /* header */
    const genderSym = self.gender === 'M' ? '♂' : self.gender === 'F' ? '♀' : '';
    const genderClr = self.gender === 'M' ? '#5b9be6' : self.gender === 'F' ? '#f28e8e' : '';
    const header = el('div', 'font-size:15px;font-weight:700;margin-bottom:2px;');
    const headerText = el('span');
    headerText.textContent = `${self.species}  Lv.${self.level}`;
    const genderSpan = el('span', `color:${genderClr};font-size:13px;margin-left:4px;`);
    genderSpan.textContent = genderSym;
    append(header, headerText, genderSpan);
    panel.appendChild(header);

    /* types + ability */
    const types = self.types ?? [];
    const abilityLine = el('div', 'font-size:12px;color:#94a3b8;');
    abilityLine.textContent = `${types.join(' · ')}  ·  Ability: ${self.ability}`;
    panel.appendChild(abilityLine);

    /* ability desc */
    if (self.abilityDesc) {
      const desc = el('div', 'font-size:11px;color:#64748b;margin-bottom:2px;');
      desc.textContent = self.abilityDesc;
      panel.appendChild(desc);
    }

    /* held item */
    if (self.heldItem) {
      const itemLine = el('div', 'font-size:12px;color:#cbd5e1;');
      itemLine.textContent = `Held Item: ${self.heldItem}`;
      panel.appendChild(itemLine);
    }

    /* nature */
    if (self.nature) {
      const natureLine = el('div', 'font-size:12px;color:#cbd5e1;');
      natureLine.textContent = `Nature: ${self.nature}`;
      panel.appendChild(natureLine);
    }

    /* separator */
    const sep = el('div', 'height:1px;background:rgba(255,255,255,.1);margin:4px 0;');
    panel.appendChild(sep);

    /* stat rows */
    const stats = self.stats;
    const boosts = self.boosts ?? {};
    for (const key of STAT_KEYS) {
      const val = stats?.[key] ?? '—';
      const boost = boosts[key];

      const row = el('div', 'display:flex;justify-content:space-between;align-items:center;');
      const label = el('span');
      label.textContent = `${STAT_LABELS[key]}:`;
      const valueSpan = el('span', 'font-weight:600;');
      valueSpan.textContent = `${val}`;
      append(row, label, valueSpan);

      if (boost && boost !== 0) {
        const arrowSpan = el('span', boost > 0
          ? 'color:#2ecc71;margin-left:4px;font-size:11px;'
          : 'color:#e74c3c;margin-left:4px;font-size:11px;',
        );
        arrowSpan.textContent = boost > 0
          ? Array.from({ length: boost }, () => '▲').join('')
          : Array.from({ length: Math.abs(boost) }, () => '▼').join('');
        row.appendChild(arrowSpan);
      }

      panel.appendChild(row);
    }

    this.container.appendChild(panel);
    this.statsPanel = panel;
  }
}
