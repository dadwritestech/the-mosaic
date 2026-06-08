// Server-side game session. Runs in Node (Vite SSR), where pokemon-showdown works.
// The browser is a thin client; it never imports this or src/.
import type { GameState } from '../src/game/types';
import { createNewGame, addToParty, grantBadge, swapPartyMembers, addMoney, addItem } from '../src/game/game-state';
import { createOwned } from '../src/game/owned-pokemon';
import { advanceStep, timeOfDay } from '../src/game/clock';
import { wildMoveset } from '../src/game/learnset';
import { rollEncounter } from '../src/content/encounters';
import { getLocation, getGym, getShop } from '../src/content/region';
import { healParty } from '../src/game/center';
import { applyItem } from '../src/game/items/effects';
import { getItem } from '../src/game/items/catalog';
import { buyItem, sellItem, availableStock, priceMultipliers } from '../src/game/shop';
import { serialize, deserialize, validateAndRepair } from '../src/game/save';
import { FileSaveStore } from './file-save-store';
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
  overlay: any = null;                 // open menu overlay (pause/party/bag/shop/center/message), or null
  private saves = new FileSaveStore('.saves');

  constructor() {
    let g = addToParty(createNewGame({ difficultyMode: 'normal', nuzlocke: false }),
      createOwned({ species: 'Pikachu', level: 8, moves: ['thunderbolt', 'quickattack', 'irontail', 'thunderwave'], nature: 'Timid' }));
    // Starter wallet + supplies so the shop/bag/Center loop is usable from the first step.
    g = addMoney(g, 3000);
    g = addItem(g, 'medicine', 'potion', 5);
    g = addItem(g, 'medicine', 'antidote', 2);
    g = addItem(g, 'balls', 'pokeball', 10);
    this.state = g;
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
      overlay: this.overlay,
    };
  }

  move(dir: 'up' | 'down' | 'left' | 'right') {
    this.message = '';
    if (this.battle) return this.view();
    if (this.overlay) return this.view();          // movement is blocked while a menu is open
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
    const t = tileAt(m, nx, ny);
    if (t === 'center') { this.state = healParty(this.state); this.overlay = { kind: 'center', message: 'Welcome! Your Pokémon are now fully rested and healed.' }; return this.view(); }
    if (t === 'shop') { this.overlay = this.shopOverlay(); return this.view(); }
    if (t === 'grass') {
      const loc = getLocation(this.locationId);
      if (loc.encounters) { const enc = rollEncounter(loc.encounters, timeOfDay(this.state), makeRng(Date.now())); if (enc) return this.startWild(enc.species, enc.level); }
    }
    return this.view();
  }

  // ---- Menus (server-driven overlays) -------------------------------------

  /** Open a menu overlay by name. Called from the client (pause menu + tabs). */
  menu(which: string) {
    switch (which) {
      case 'pause':  this.overlay = { kind: 'pause' }; break;
      case 'party':  this.overlay = this.partyOverlay(); break;
      case 'bag':    this.overlay = this.bagOverlay(); break;
      case 'save':   this.overlay = { kind: 'save', slots: ['slot1', 'slot2', 'slot3'] }; break;
      case 'shop':   this.overlay = this.shopOverlay(); break;
      case 'close':  this.overlay = null; break;
      default:       this.overlay = null; break;
    }
    return this.view();
  }

  private monList() {
    return this.state.party.map((p) => ({
      uid: p.uid, species: p.species, level: p.level,
      hp: p.currentHp, maxHp: maxHp(p), hpPercent: Math.round((p.currentHp / maxHp(p)) * 100),
      status: p.status ?? '',
    }));
  }

  private partyOverlay(purpose?: string, itemId?: string) {
    return { kind: 'party', purpose: purpose ?? 'view', itemId, mons: this.monList() };
  }

  private bagOverlay() {
    const pockets = Object.entries(this.state.bag).map(([pocket, items]) => ({
      pocket,
      items: Object.entries(items as Record<string, number>).map(([id, count]) => {
        const def = getItem(id);
        return { id, name: def.name, count, pocket, usable: this.usableOutOfBattle(def.effect.kind) };
      }),
    })).filter((p) => p.items.length > 0);
    return { kind: 'bag', pockets };
  }

  private usableOutOfBattle(kind: string): boolean {
    return ['heal', 'cure', 'revive', 'pp', 'ev', 'evoStone', 'repel', 'escapeRope'].includes(kind);
  }

  private shopId(): string { return getLocation(this.locationId).shopId ?? 'aethel-mart'; }
  private shopOverlay() {
    const shop = getShop(this.shopId());
    const mult = priceMultipliers(this.state.settings.difficultyMode);
    const buy = availableStock(shop, this.state).map((e) => {
      const def = getItem(e.itemId);
      return { itemId: e.itemId, name: def.name, price: Math.ceil(def.buyPrice * mult.buy) };
    });
    const sell = Object.values(this.state.bag).flatMap((items) =>
      Object.keys(items as Record<string, number>).map((id) => {
        const def = getItem(id);
        return { itemId: id, name: def.name, count: (items as Record<string, number>)[id], price: Math.floor(def.sellPrice * mult.sell) };
      }));
    return { kind: 'shop', name: shop.name, buy, sell, money: this.state.money };
  }

  closeMenu() { this.overlay = null; return this.view(); }

  swapParty(a: number, b: number) {
    this.state = swapPartyMembers(this.state, a, b);
    this.overlay = this.partyOverlay();
    return this.view();
  }

  useItem(itemId: string, targetUid?: string, moveIndex?: number) {
    const def = getItem(itemId);
    // Target-needing items first open the party picker; then apply on the chosen mon.
    if (!targetUid && this.usableOutOfBattle(def.effect.kind) && !['repel', 'escapeRope'].includes(def.effect.kind)) {
      this.overlay = this.partyOverlay('useItem', itemId);
      return this.view();
    }
    const { state, result } = applyItem(this.state, itemId, targetUid, moveIndex);
    if (result.ok) this.state = this.consume(state, def.pocket, itemId);
    this.message = result.ok
      ? `Used ${def.name}${result.evolvedInto ? ` — it evolved into ${result.evolvedInto}!` : '!'}`
      : `Can't use ${def.name}: ${result.reason}.`;
    this.overlay = this.bagOverlay();
    return this.view();
  }
  // Decrement one of the item from the bag after a successful use.
  private consume(state: GameState, pocket: string, itemId: string): GameState {
    const bag: any = { ...state.bag, [pocket]: { ...(state.bag as any)[pocket] } };
    const have = bag[pocket]?.[itemId] ?? 0;
    if (have <= 1) delete bag[pocket][itemId]; else bag[pocket][itemId] = have - 1;
    return { ...state, bag };
  }

  buy(itemId: string, qty = 1) {
    const { state, result } = buyItem(this.state, getShop(this.shopId()), itemId, qty);
    this.state = state;
    this.message = result.ok ? `Bought ${qty}× ${getItem(itemId).name}.` : `Can't buy: ${result.reason}.`;
    this.overlay = this.shopOverlay();
    return this.view();
  }
  sell(itemId: string, qty = 1) {
    const { state, result } = sellItem(this.state, itemId, qty);
    this.state = state;
    this.message = result.ok ? `Sold ${qty}× ${getItem(itemId).name}.` : `Can't sell: ${result.reason}.`;
    this.overlay = this.shopOverlay();
    return this.view();
  }

  async save(slot = 'slot1') {
    await this.saves.save(slot, serialize(this.state));
    this.message = `Game saved to ${slot}.`;
    this.overlay = null;
    return this.view();
  }
  async load(slot = 'slot1') {
    const json = await this.saves.load(slot);
    if (!json) { this.message = `No save in ${slot}.`; return this.view(); }
    this.state = validateAndRepair(deserialize(json));
    this.message = `Loaded ${slot}.`;
    this.overlay = null;
    return this.view();
  }

  private async startWild(species: string, level: number) {
    const wild = createOwned({ species, level, moves: wildMoveset(species, level) });
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
    case 'menu': return singleton.menu(body.which);
    case 'closeMenu': return singleton.closeMenu();
    case 'swapParty': return singleton.swapParty(body.a, body.b);
    case 'useItem': return singleton.useItem(body.itemId, body.targetUid, body.moveIndex);
    case 'buy': return singleton.buy(body.itemId, body.qty ?? 1);
    case 'sell': return singleton.sell(body.itemId, body.qty ?? 1);
    case 'save': return singleton.save(body.slot);
    case 'load': return singleton.load(body.slot);
    default: return { error: `unknown cmd ${cmd}` };
  }
}
