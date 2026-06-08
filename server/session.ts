// Server-side game session. Runs in Node (Vite SSR), where pokemon-showdown works.
// The browser is a thin client; it never imports this or src/.
import type { GameState } from '../src/game/types';
import { createNewGame, addToParty, grantBadge } from '../src/game/game-state';
import { createOwned } from '../src/game/owned-pokemon';
import { advanceStep, timeOfDay } from '../src/game/clock';
import { rollEncounter } from '../src/content/encounters';
import { getLocation, getGym } from '../src/content/region';
import { composeTeam } from '../src/ai/team-composer';
import { BattleBridge } from '../src/bridge/battle-bridge';
import { chooseAction } from '../src/ai/decision-brain';
import { buildView } from '../src/ai/view-from-bridge';
import { ownedToSet } from '../src/game/projection';
import { applyBattleResult } from '../src/game/battle-result';
import { recordTrainerDefeat } from '../src/game/rematch';
import { maxHp } from '../src/game/stats';
import { makeRng } from '../src/ai/rng';
import type { PokemonSet } from '../src/bridge/types';
import * as Sim from 'pokemon-showdown';
import { SLICE_MAPS } from '../web/overworld/maps/slice';
import { tileAt, isWalkable, metaAt, type TileMap } from '../web/overworld/tilemap';

interface BattleCtx {
  bridge: BattleBridge; isWild: boolean; oppTeam: PokemonSet[];
  defeated: { species: string; level: number }[];
  gymId?: string; log: string;
}

class GameSession {
  state: GameState;
  locationId = 'aethels-rest';
  px: number; py: number;
  battle: BattleCtx | null = null;
  message = '';

  constructor() {
    this.state = addToParty(createNewGame({ difficultyMode: 'normal', nuzlocke: false }),
      createOwned({ species: 'Pikachu', level: 8, moves: ['thunderbolt', 'quickattack', 'irontail', 'thunderwave'], nature: 'Timid' }));
    const m = this.map(); this.px = m.spawn.x; this.py = m.spawn.y;
  }
  private map(): TileMap { return SLICE_MAPS[this.locationId]; }
  private mon() { return this.state.party[0]; }

  view() {
    if (this.battle) return this.battleView();
    const m = this.map();
    return {
      screen: 'overworld' as const, locationId: this.locationId, tiles: m.tiles,
      player: { x: this.px, y: this.py }, time: timeOfDay(this.state),
      party: this.state.party.map((p) => ({ species: p.species, level: p.level, hpPercent: Math.round((p.currentHp / maxHp(p)) * 100) })),
      badges: this.state.badges, money: this.state.money, message: this.message,
    };
  }

  move(dir: 'up' | 'down' | 'left' | 'right') {
    this.message = '';
    if (this.battle) return this.view();
    const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    const nx = this.px + D[0], ny = this.py + D[1];
    const m = this.map();
    if (!isWalkable(m, nx, ny)) return this.view();
    this.px = nx; this.py = ny;
    this.state = advanceStep(this.state);
    const meta = metaAt(m, nx, ny);
    if (meta.exitTo) { this.locationId = meta.exitTo; const nm = this.map(); this.px = nm.spawn.x; this.py = nm.spawn.y; return this.view(); }
    if (meta.npcId) { this.message = 'Aethel: The Core remembers every trainer who walked here.'; return this.view(); }
    if (meta.gymId) return this.startGym(meta.gymId);
    if (tileAt(m, nx, ny) === 'grass') {
      const loc = getLocation(this.locationId);
      if (loc.encounters) { const enc = rollEncounter(loc.encounters, timeOfDay(this.state), makeRng(Date.now())); if (enc) return this.startWild(enc.species, enc.level); }
    }
    return this.view();
  }

  private async startWild(species: string, level: number) {
    const wild = createOwned({ species, level, moves: ['tackle'] });
    const bridge = new BattleBridge();
    await bridge.startBattle([ownedToSet(this.mon())], [ownedToSet(wild)], { formatid: 'gen9customgame', isWild: true });
    this.battle = { bridge, isWild: true, oppTeam: [ownedToSet(wild)], defeated: [{ species, level }], log: `A wild ${species} appeared!` };
    return this.battleView();
  }
  private async startGym(gymId: string) {
    const gym = getGym(gymId);
    const team = composeTeam(gym.trainer, { gen: 9, counterDraftStrength: 0.3, rng: makeRng(7) });
    const bridge = new BattleBridge();
    await bridge.startBattle([ownedToSet(this.mon())], team, { formatid: 'gen9customgame' });
    this.battle = { bridge, isWild: false, oppTeam: team, defeated: team.map((s) => ({ species: s.species, level: s.level })), gymId, log: `${gym.trainer.name} wants to battle!` };
    return this.battleView();
  }

  private battleView() {
    const b = this.battle!; const s = b.bridge.state; const c = b.bridge.getChoices('p1');
    const sideView = (m: any) => ({ species: m.species, hpPercent: m.hpPercent, status: m.status, boosts: m.boosts ?? {}, volatiles: m.volatiles ?? [] });
    return {
      screen: 'battle' as const, isWild: b.isWild,
      self: { ...sideView(s.active.p1), level: this.mon().level, heldItem: this.mon().heldItem ?? '' },
      foe: { ...sideView(s.active.p2) },
      weather: s.weather ?? '', terrain: s.terrain ?? '',
      moves: c.moves.map((mo: { index: number; id: string; name: string; pp: number; maxpp: number }) => {
        const md = (Sim.Dex as any).forGen(9).moves.get(mo.id);
        return { index: mo.index, name: mo.name, type: md.type, category: md.category, pp: mo.pp, maxpp: mo.maxpp };
      }),
      canCatch: c.canCatch, log: b.log,
      done: s.winner !== undefined ? (s.winner === 'p1' ? 'win' : 'loss') : null,
    };
  }

  private narrate(events: any[], name: (side: string) => string): string {
    const nm = (side: string) => (side === 'p1' ? name(side) : `the opposing ${name(side)}`);
    const cause = (e: any) => (e.source ? `${e.source}'s ${e.cause}` : e.cause); // "Pikachu's Static"
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const lines: string[] = [];
    for (const e of events) {
      switch (e.type) {
        case 'move': lines.push(`${nm(e.side)} used ${e.move}!`); break;
        case 'status': { const word = ({ par: 'paralyzed', psn: 'poisoned', tox: 'badly poisoned', brn: 'burned', slp: 'put to sleep', frz: 'frozen' } as any)[e.status] ?? e.status; lines.push(`${nm(e.side)} was ${word}${e.cause ? ` by ${cause(e)}` : ''}!`); break; }
        case 'damage': if (e.cause) lines.push(`${nm(e.side)} was hurt by ${/^(psn|tox)$/.test(e.cause) ? 'poison' : e.cause === 'brn' ? 'its burn' : e.cause}!`); break;
        case 'cure': lines.push(`${nm(e.side)} shook off its ${e.status}.`); break;
        case 'boost': lines.push(`${nm(e.side)}'s ${e.stat.toUpperCase()} ${e.amount > 0 ? 'rose' : 'fell'}${Math.abs(e.amount) > 1 ? ' sharply' : ''}${e.cause ? ` (${cause(e)})` : ''}!`); break;
        case 'weather': lines.push(e.weather ? `The weather turned to ${e.weather}!` : 'The weather cleared.'); break;
        case 'field': if (e.start) lines.push(`${e.effect} set in!`); break;
        case 'volatile': if (e.start) lines.push(`${nm(e.side)} became ${e.effect}!`); break;
        case 'ability': lines.push(`[${name(e.side)}'s ${e.ability}]`); break;
        case 'item': lines.push(e.ended ? `${nm(e.side)}'s ${e.item} was used up.` : `${nm(e.side)}'s ${e.item} activated!`); break;
        case 'cant': lines.push(`${nm(e.side)} ${({ par: "is paralyzed! It can't move!", slp: 'is fast asleep!', frz: 'is frozen solid!', flinch: "flinched and couldn't move!" } as any)[e.reason] ?? "couldn't move!"}`); break;
        case 'immune': lines.push(`It doesn't affect ${nm(e.side)}…`); break;
        case 'miss': lines.push(`${nm(e.side)}'s attack missed!`); break;
        case 'effectiveness': lines.push(e.kind === 'super' ? "It's super effective!" : "It's not very effective…"); break;
        case 'crit': lines.push('A critical hit!'); break;
        case 'fail': lines.push('But it failed!'); break;
        case 'faint': lines.push(`${nm(e.side)} fainted!`); break;
      }
    }
    return lines.map(cap).join(' ') || '…';
  }

  async turn(moveIndex: number) {
    const b = this.battle; if (!b) return this.view();
    const view = buildView('p2', b.bridge.state, b.oppTeam, [ownedToSet(this.mon())], b.bridge.getChoices('p2').moves, []);
    const ai = chooseAction(view, { gen: 9, knobs: { randomness: 0.1, lookaheadDepth: 1, switchSmarts: 1 }, personality: { aggression: 1, caution: 0.5 }, rng: makeRng(Date.now()) });
    const res = await b.bridge.submitTurn({ kind: 'move', index: moveIndex }, ai);
    const name = (side: string) => b.bridge.state.active[side as 'p1' | 'p2']?.species ?? (side === 'p1' ? 'Your Pokémon' : 'the foe');
    b.log = this.narrate(res.events, name);
    if (b.bridge.state.winner) return this.finish();
    return this.battleView();
  }
  async catch() {
    const b = this.battle; if (!b) return this.view();
    const r = b.bridge.attemptCatch('ultra');
    if (r.caught) { b.log = `Caught ${b.bridge.state.active.p2!.species}!`; return this.finish('caught'); }
    b.log = 'The Pokémon broke free!';
    return this.turn(1);
  }

  private finish(catchResult?: 'caught') {
    const b = this.battle!; const won = catchResult === 'caught' || b.bridge.state.winner === 'p1';
    const p1 = b.bridge.finalConditions().p1[0];
    let msg = '';
    if (won) {
      const out = applyBattleResult(this.state, {
        won: true, finalConditions: [{ uid: this.mon().uid, hpPercent: p1?.hpPercent ?? 0, status: p1?.status ?? '' }],
        defeatedTeam: b.defeated, participantUids: [this.mon().uid], isWild: b.isWild,
        trainer: b.gymId ? { basePayout: getGym(b.gymId).trainer.basePayout, tier: getGym(b.gymId).trainer.baseTier } : undefined,
        rng: makeRng(1),
      });
      this.state = out.state;
      if (b.gymId) { const gym = getGym(b.gymId); this.state = recordTrainerDefeat(grantBadge(this.state, gym.badgeId), gym.trainer.id); msg = `You earned the ${gym.badgeId} badge!`; }
      else if (catchResult === 'caught') msg = 'Added to your party path.';
      else msg = `You won! +${out.summary.money}₽`;
    } else { msg = 'You were defeated…'; }
    this.battle = null; this.message = msg;
    return this.view();
  }
}

let singleton: GameSession | null = null;
export async function dispatch(cmd: string, body: any) {
  if (!singleton || cmd === 'reset') singleton = new GameSession();
  switch (cmd) {
    case 'view': return singleton.view();
    case 'move': return singleton.move(body.dir);
    case 'turn': return singleton.turn(body.index);
    case 'catch': return singleton.catch();
    default: return { error: `unknown cmd ${cmd}` };
  }
}
