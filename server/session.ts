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
    return {
      screen: 'battle' as const, isWild: b.isWild,
      self: { species: s.active.p1!.species, level: this.mon().level, hpPercent: s.active.p1!.hpPercent, status: s.active.p1!.status },
      foe: { species: s.active.p2!.species, hpPercent: s.active.p2!.hpPercent, status: s.active.p2!.status },
      moves: c.moves.map((mo: { index: number; name: string }) => ({ index: mo.index, name: mo.name })),
      canCatch: c.canCatch, log: b.log,
      done: s.winner !== undefined ? (s.winner === 'p1' ? 'win' : 'loss') : null,
    };
  }

  async turn(moveIndex: number) {
    const b = this.battle; if (!b) return this.view();
    const view = buildView('p2', b.bridge.state, b.oppTeam, [ownedToSet(this.mon())], b.bridge.getChoices('p2').moves, []);
    const ai = chooseAction(view, { gen: 9, knobs: { randomness: 0.1, lookaheadDepth: 1, switchSmarts: 1 }, personality: { aggression: 1, caution: 0.5 }, rng: makeRng(Date.now()) });
    const res = await b.bridge.submitTurn({ kind: 'move', index: moveIndex }, ai);
    b.log = res.events.filter((e) => e.type === 'move' || e.type === 'faint')
      .map((e: any) => e.type === 'move' ? `${e.side === 'p1' ? 'Your' : 'Foe'} ${e.move}` : `${e.side === 'p1' ? 'Your mon' : 'Foe'} fainted`).join(' · ') || '…';
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
