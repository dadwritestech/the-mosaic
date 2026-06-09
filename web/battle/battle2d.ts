import { Hud } from '../ui/hud';

export class BattleScreen2D {
  private container: HTMLElement;
  private bgImg: HTMLImageElement;
  private foeImg: HTMLImageElement;
  private playerImg: HTMLImageElement;
  private hud: Hud;
  private lastFoeNum: number | undefined;
  private lastSelfNum: number | undefined;

  constructor(
    host: HTMLElement,
    onAction: (cmd: string, body?: Record<string, unknown>) => void
  ) {
    this.container = document.createElement('div');
    Object.assign(this.container.style, {
      position: 'absolute',
      inset: '0',
      overflow: 'hidden',
    });
    host.appendChild(this.container);

    // Background
    this.bgImg = document.createElement('img');
    this.bgImg.src = '/2d/battlebg.png';
    Object.assign(this.bgImg.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      imageRendering: 'pixelated',
      zIndex: '0',
    });
    this.container.appendChild(this.bgImg);

    // Foe sprite (upper-right)
    this.foeImg = document.createElement('img');
    Object.assign(this.foeImg.style, {
      position: 'absolute',
      top: '14%',
      right: '16%',
      imageRendering: 'pixelated',
      zIndex: '1',
      transformOrigin: 'bottom center',
      transform: 'scale(2.2)',
    });
    this.container.appendChild(this.foeImg);

    // Player sprite (lower-left)
    this.playerImg = document.createElement('img');
    Object.assign(this.playerImg.style, {
      position: 'absolute',
      left: '12%',
      bottom: '30%',
      imageRendering: 'pixelated',
      zIndex: '1',
      transformOrigin: 'bottom center',
      transform: 'scale(2.6)',
    });
    this.container.appendChild(this.playerImg);

    // HUD
    this.hud = new Hud(host, {
      onMove: (i: number) => onAction('turn', { index: i }),
      onSwitch: (i: number) => onAction('switchMon', { index: i }),
      onBall: (b: string) => onAction('catch', { ball: b }),
    });
  }

  render(view: any): void {
    if (view.foe.num !== this.lastFoeNum) {
      this.foeImg.src = `/pkmn/${view.foe.num}.gif`;
      this.lastFoeNum = view.foe.num;
    }
    if (view.self.num !== this.lastSelfNum) {
      this.playerImg.src = `/pkmn/back/${view.self.num}.gif`;
      this.lastSelfNum = view.self.num;
    }

    this.hud.render({
      self: {
        name: `${view.self.species} L${view.self.level}`,
        hp: view.self.hpPercent,
        status: view.self.status,
        boosts: view.self.boosts ?? {},
        volatiles: view.self.volatiles ?? [],
        item: view.self.heldItem || undefined,
      },
      foe: {
        name: `${view.foe.species}`,
        hp: view.foe.hpPercent,
        status: view.foe.status,
        boosts: view.foe.boosts ?? {},
        volatiles: view.foe.volatiles ?? [],
      },
      weather: view.weather ?? '',
      terrain: view.terrain ?? '',
      moves: view.moves,
      switches: view.switches ?? [],
      balls: view.balls ?? [],
      canCatch: view.canCatch,
      log: view.log,
    });
  }

  dispose(): void {
    this.hud.clear();
    this.container.remove();
  }
}
