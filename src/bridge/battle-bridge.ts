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
 * Scope: built for single-active singles battles. Mid-battle forceSwitch (multi-mon
 * replacement) is recognized but not yet driven — added when multi-mon teams land.
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
          this.latestRequest[side] = req; // active or forceSwitch
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

  private applyEvent(ev: BattleEvent): void {
    switch (ev.type) {
      case 'turn': this._state.turn = ev.turn; break;
      case 'switch':
        this._state.active[ev.side] = { species: ev.species, hpPercent: ev.hpPercent, status: '' };
        break;
      case 'damage': {
        const m = this._state.active[ev.side]; if (m) m.hpPercent = ev.hpPercent; break;
      }
      case 'status': {
        const m = this._state.active[ev.side]; if (m) m.status = ev.status; break;
      }
      case 'win': this._state.winner = ev.side; break;
      default: break;
    }
  }
}
