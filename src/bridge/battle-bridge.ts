import * as Sim from 'pokemon-showdown';
import type {
  TeamSpec, BattleOpts, Action, Side, BattleState, TurnResult, BattleEvent,
  BallType, CatchResult,
} from './types';
import { parseLine } from './protocol-parser';
import { catchChance, rollCatch } from './catch';
import { baseCatchRate } from '../data/catch-rates';

/**
 * Headless wrapper over Showdown's battle engine. No graphics, no AI.
 *
 * Design (verified against pokemon-showdown 0.11.x via the spike test):
 *  - Drive battles through Sim.getPlayerStreams(stream) -> { omniscient, p1, p2 }.
 *  - Each side's |request| arrives on its own stream; we consume them in the
 *    background. teamPreview/wait are auto-resolved; active/forceSwitch requests
 *    are stored and answered explicitly via submitTurn.
 *  - Public battle output (|move|, |-damage|, |turn|, |win|, ...) arrives on the
 *    omniscient stream, consumed via `for await`. A turn is "complete" when the
 *    next |turn| or |win| is seen; submitTurn resolves on that boundary.
 *  - Catching is synthetic: it never touches Showdown (the sim has no Poke Balls).
 *
 * Scope: built for singles. Mid-battle forceSwitch (multi-mon replacement after a
 * faint) is auto-resolved with `default` so scripted/AI play continues; explicit
 * player-driven switch selection during a forced switch arrives with the UI later.
 */
export class BattleBridge {
  private stream: any;
  private streams!: { omniscient: any; p1: any; p2: any };
  private nameMap: Record<string, Side> = { P1: 'p1', P2: 'p2' };
  private latestRequest: Record<Side, any> = { p1: null, p2: null };

  private eventBuffer: BattleEvent[] = [];
  private turnResolver: (() => void) | null = null;

  private _state: BattleState = {
    isWild: false, turn: 0, active: { p1: null, p2: null }, winner: undefined,
  };

  get state(): BattleState { return this._state; }

  async startBattle(p1Team: TeamSpec, p2Team: TeamSpec, opts: BattleOpts = {}): Promise<BattleState> {
    this._state = { isWild: !!opts.isWild, turn: 0, active: { p1: null, p2: null }, winner: undefined };
    this.latestRequest = { p1: null, p2: null };
    this.eventBuffer = [];

    this.stream = new Sim.BattleStream();
    this.streams = Sim.getPlayerStreams(this.stream);

    this.consumeRequests(this.streams.p1, 'p1');
    this.consumeRequests(this.streams.p2, 'p2');
    this.consumeOutput();

    const spec = {
      formatid: opts.formatid ?? 'gen9customgame',
      ...(opts.seed ? { seed: opts.seed } : {}),
    };
    void this.streams.omniscient.write(
      `>start ${JSON.stringify(spec)}\n` +
      `>player p1 ${JSON.stringify({ name: 'P1', team: Sim.Teams.pack(p1Team as any) })}\n` +
      `>player p2 ${JSON.stringify({ name: 'P2', team: Sim.Teams.pack(p2Team as any) })}`,
    );

    await this.waitForTurnBoundary(); // resolves on |turn|1
    this.injectConditions(opts.initialConditions);
    return this._state;
  }

  /** Background loop: store actionable requests, auto-resolve teamPreview/wait. */
  private consumeRequests(s: any, side: Side): void {
    void (async () => {
      for await (const chunk of s) {
        for (const line of String(chunk).split('\n')) {
          if (!line.startsWith('|request|')) continue;
          const json = line.slice('|request|'.length);
          if (!json) continue;
          const req = JSON.parse(json);
          if (req.wait) { this.latestRequest[side] = null; continue; }
          if (req.teamPreview) { void s.write('default'); continue; }
          if (req.forceSwitch) { void s.write('default'); this.latestRequest[side] = null; continue; }
          this.latestRequest[side] = req; // active move request
        }
      }
    })();
  }

  /** Background loop: parse public output into events; signal turn boundaries. */
  private consumeOutput(): void {
    void (async () => {
      for await (const chunk of this.streams.omniscient) {
        for (const line of String(chunk).split('\n')) {
          const ev = parseLine(line, this.nameMap);
          if (ev) { this.eventBuffer.push(ev); this.applyEvent(ev); }
          if (line.startsWith('|turn|') || line.startsWith('|win|')) {
            this.signalTurnBoundary();
          }
        }
      }
    })();
  }

  private waitForTurnBoundary(): Promise<void> {
    return new Promise((resolve) => { this.turnResolver = resolve; });
  }

  private signalTurnBoundary(): void {
    const r = this.turnResolver;
    this.turnResolver = null;
    if (r) r();
  }

  getChoices(side: Side) {
    const req = this.latestRequest[side];
    const moves = (req?.active?.[0]?.moves ?? []).map((m: any, i: number) => ({
      index: i + 1, id: m.id, name: m.move, pp: m.pp, maxpp: m.maxpp, disabled: !!m.disabled,
    }));
    const switches = (req?.side?.pokemon ?? []).map((p: any, i: number) => ({
      index: i + 1,
      species: p.details.split(',')[0],
      hpPercent: p.condition.startsWith('0') ? 0 : 100,
      fainted: p.condition.includes('fnt'),
    }));
    return { moves, switches, canCatch: this._state.isWild && side === 'p1' };
  }

  private toCmd(a: Action): string {
    if (a.kind === 'move') return `move ${a.index}`;
    if (a.kind === 'switch') return `switch ${a.index}`;
    return 'default'; // catch is handled by attemptCatch, never reaches here
  }

  async submitTurn(p1Action: Action, p2Action: Action): Promise<TurnResult> {
    this.eventBuffer = [];
    const ready = this.waitForTurnBoundary();
    void this.streams.p1.write(this.toCmd(p1Action));
    void this.streams.p2.write(this.toCmd(p2Action));
    await ready;
    return { events: this.eventBuffer.slice(), state: this._state };
  }

  /** Synthetic, non-Showdown capture action (wild battles, player side only). */
  attemptCatch(ball: BallType): CatchResult {
    if (!this._state.isWild) throw new Error('Cannot catch in a trainer battle');
    const target = this._state.active.p2;
    if (!target) throw new Error('No wild Pokemon to catch');
    const chance = catchChance({
      baseRate: baseCatchRate(target.species),
      hpPercent: target.hpPercent,
      status: target.status,
      ball,
    });
    const result = rollCatch(chance);
    if (result.caught) this._state.winner = 'p1'; // capture ends the battle
    return result;
  }

  /** Heal/cure the currently-active mon mid-battle (for in-battle item use).
   *  hpPercent is the new HP percent; clearStatus also removes its status. */
  setActiveHp(side: Side, hpPercent: number, clearStatus = false): void {
    const st = this._state.active[side];
    if (st) { st.hpPercent = hpPercent; if (clearStatus) st.status = ''; }
    const battle: any = (this.stream as any).battle;
    const mon = battle?.sides?.[side === 'p1' ? 0 : 1]?.active?.[0];
    if (mon) {
      mon.sethp(Math.max(1, Math.round((hpPercent / 100) * mon.maxhp)));
      if (clearStatus && typeof mon.clearStatus === 'function') mon.clearStatus();
    }
  }

  private injectConditions(conds?: { p1?: import('./types').MonCondition[]; p2?: import('./types').MonCondition[] }): void {
    if (!conds) return;
    const battle = (this.stream as any).battle;
    if (!battle) return;
    const statusMap: Record<string, string> = { par: 'paralysis', brn: 'burn', psn: 'poison', tox: 'toxic', slp: 'sleep', frz: 'freeze' };
    const apply = (sideIdx: number, list?: import('./types').MonCondition[]) => {
      if (!list) return;
      const mons = battle.sides[sideIdx].pokemon;
      list.forEach((c, i) => {
        const p = mons[i]; if (!p) return;
        if (typeof c.hpPercent === 'number') p.sethp(Math.max(1, Math.round((c.hpPercent / 100) * p.maxhp)));
        if (c.status) p.setStatus(statusMap[c.status] ?? c.status);
      });
    };
    apply(0, conds.p1); apply(1, conds.p2);
  }

  private normalizeStatus(raw: string): string {
    const map: Record<string, string> = { paralysis: 'par', burn: 'brn', poison: 'psn', toxic: 'tox', sleep: 'slp', freeze: 'frz' };
    return map[raw] ?? raw;
  }

  finalConditions(): { p1: import('./types').MonReadout[]; p2: import('./types').MonReadout[] } {
    const battle = (this.stream as any).battle;
    const read = (sideIdx: number): import('./types').MonReadout[] => {
      if (!battle) return [];
      return battle.sides[sideIdx].pokemon.map((p: any) => ({
        species: p.species?.name ?? p.name,
        hpPercent: p.maxhp ? Math.round((p.hp / p.maxhp) * 100) : 0,
        status: this.normalizeStatus(p.status ?? ''),
        fainted: !!p.fainted,
      }));
    };
    return { p1: read(0), p2: read(1) };
  }

  private applyEvent(ev: BattleEvent): void {
    switch (ev.type) {
      case 'turn': this._state.turn = ev.turn; break;
      case 'switch':
        // a fresh mon clears boosts/volatiles/status
        this._state.active[ev.side] = { species: ev.species, hpPercent: ev.hpPercent, status: '', boosts: {}, volatiles: [] };
        break;
      case 'damage': { const m = this._state.active[ev.side]; if (m) m.hpPercent = ev.hpPercent; break; }
      case 'heal': { const m = this._state.active[ev.side]; if (m) m.hpPercent = ev.hpPercent; break; }
      case 'status': { const m = this._state.active[ev.side]; if (m) m.status = ev.status; break; }
      case 'cure': { const m = this._state.active[ev.side]; if (m && m.status === ev.status) m.status = ''; break; }
      case 'boost': {
        const m = this._state.active[ev.side]; if (m) { m.boosts = m.boosts ?? {}; m.boosts[ev.stat] = Math.max(-6, Math.min(6, (m.boosts[ev.stat] ?? 0) + ev.amount)); }
        break;
      }
      case 'volatile': {
        const m = this._state.active[ev.side]; if (m) { m.volatiles = m.volatiles ?? []; if (ev.start) { if (!m.volatiles.includes(ev.effect)) m.volatiles.push(ev.effect); } else m.volatiles = m.volatiles.filter((v) => v !== ev.effect); }
        break;
      }
      case 'weather': this._state.weather = ev.weather; break;
      case 'field': this._state.terrain = ev.start ? ev.effect : ''; break;
      case 'win': this._state.winner = ev.side; break;
      default: break;
    }
  }
}
