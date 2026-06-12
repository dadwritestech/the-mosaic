// Server-side game session. Runs in Node (Vite SSR), where pokemon-showdown works.
// The browser is a thin client; it never imports this or src/.
import type { GameState, OwnedPokemon } from '../src/game/types';
import { createNewGame, addToParty, grantBadge, swapPartyMembers, addMoney, addItem, registerSeen, registerCaught, depositToBox, withdrawFromBox } from '../src/game/game-state';
import { computeStats } from '../src/game/stats';
import { expForLevel, growthRateOf } from '../src/game/growth-rates';
import { maxPp } from '../src/game/pp';
import { listReadyRematches, rematchLevelCap } from '../src/game/rematch';
import { getTrainer } from '../src/content/region';
import { createOwned, setHp } from '../src/game/owned-pokemon';
import { advanceStep, timeOfDay } from '../src/game/clock';
import { wildMoveset } from '../src/game/learnset';
import { rollEncounter } from '../src/content/encounters';
import { getLocation, getGym, getShop } from '../src/content/region';
import { ALL_LOCATIONS } from '../src/content/region/index';
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
import type { PokemonSet, Action, BallType } from '../src/bridge/types';
import * as Sim from 'pokemon-showdown';
import { SLICE_MAPS } from '../web/overworld/maps/slice';
import { loadMapV2, walkableAt, warpAt, encounterAt, hasMapV2 } from '../web/overworld/maps/loader';
import type { MapV2 } from '../web/overworld/maps/mapv2';
import { tileAt, isWalkable, metaAt, type TileMap } from '../web/overworld/tilemap';

interface BattleCtx {
  bridge: BattleBridge; isWild: boolean; oppTeam: PokemonSet[];
  defeated: { species: string; level: number }[];
  gymId?: string; log: string;
  activeIdx: number;              // which party slot is currently on the field (p1)
  participants: Set<string>;      // uids that were ever active — for exp distribution
  wildMon?: OwnedPokemon;         // the catchable wild Pokémon (added to team if caught)
  ended?: {
    result: 'win' | 'loss' | 'caught' | 'run';
    message: string;
    lines: string[];
    rewards?: {
      money: number;
      exp: { species: string; amount: number }[];
      levelUps: { species: string; level: number; evolutionInto: string | null }[];
      items: string[];
    };
  }; // result is staged; the screen waits for "Continue"
}

const BALL_ITEM: Record<string, string> = { poke: 'pokeball', great: 'greatball', ultra: 'ultraball', master: 'masterball' };

class GameSession {
  state: GameState;
  locationId = 'aethels-rest';
  px = 0; py = 0;
  battle: BattleCtx | null = null;
  message = '';
  overlay: any = null;                 // open menu overlay (pause/party/bag/shop/center/message), or null
  private saves = new FileSaveStore('.saves');
  private boxIndex = 0;                 // PC box currently being viewed
  private trainerGym: Record<string, string> = {}; // trainerId -> gymId, for Vs-Seeker rematches
  private visitedLocations = new Set<string>();     // location ids the player has entered

  constructor() {
    let g = addToParty(createNewGame({ difficultyMode: 'normal', nuzlocke: false }),
      createOwned({ species: 'Pikachu', level: 8, moves: ['thunderbolt', 'quickattack', 'irontail', 'thunderwave'], nature: 'Timid' }));
    // A second party member so switching is usable from the start.
    g = addToParty(g, createOwned({ species: 'Eevee', level: 8, moves: wildMoveset('Eevee', 8), nature: 'Jolly' }));
    // Starter wallet + supplies so the shop/bag/Center loop is usable from the first step.
    g = addMoney(g, 3000);
    g = addItem(g, 'medicine', 'potion', 5);
    g = addItem(g, 'medicine', 'antidote', 2);
    g = addItem(g, 'balls', 'pokeball', 10);
    this.state = g;
    for (const p of this.state.party) this.state = registerCaught(this.state, this.dexNum(p.species)); // starters in the dex
    this.enterLocation(this.locationId); // spawn at the start location (imported map or legacy)
  }
  private map(): TileMap { return SLICE_MAPS[this.locationId]; }
  /** The current location's imported map, or null if it's a legacy TileMap location. */
  // MapV2 (Essentials-imported 2D tiles) retired in favour of the 3D overworld,
  // which renders the legacy tile-string maps. Force the legacy path everywhere.
  private curMapV2(): MapV2 | null { return null; }
  private dexNum(species: string): number { return (Sim.Dex as any).forGen(9).species.get(species).num; }

  /** Move into a location, placing the player at its spawn (works for either map type). */
  private enterLocation(id: string) {
    this.locationId = id;
    this.visitedLocations.add(id);
    const mv = this.curMapV2();
    if (mv) { this.px = mv.spawn.x; this.py = mv.spawn.y; }
    else { const m = this.map(); this.px = m.spawn.x; this.py = m.spawn.y; }
    this.autosave();
  }

  /** Debug: jump straight to any location (imported map or legacy). */
  loadSample(id = 'sample') {
    if (!hasMapV2(id) && !SLICE_MAPS[id]) { this.message = `no map ${id}`; return this.view(); }
    this.enterLocation(id);
    return this.view();
  }

  view() {
    if (this.battle) return this.battleView();
    const mv = this.curMapV2();
    if (mv) {
      return {
        screen: 'overworld' as const, locationId: this.locationId, mapV2: mv,
        player: { x: this.px, y: this.py }, time: timeOfDay(this.state),
        party: this.state.party.map((p) => ({ species: p.species, level: p.level, hpPercent: Math.round((p.currentHp / maxHp(p)) * 100) })),
        badges: this.state.badges, money: this.state.money, message: this.message, overlay: this.overlay,
      };
    }
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

    // MapV2 (Essentials-imported) movement
    const mv = this.curMapV2();
    if (mv) {
      const warp = warpAt(mv, nx, ny);
      // warp tiles (door/exit mats) are always steppable even if the tileset marks them solid
      if (!warp && !walkableAt(mv, nx, ny)) return this.view();
      this.px = nx; this.py = ny;
      this.state = advanceStep(this.state);
      if (warp && (hasMapV2(warp.toMap) || SLICE_MAPS[warp.toMap])) {
        this.locationId = warp.toMap; this.visitedLocations.add(this.locationId);
        this.px = warp.toX; this.py = warp.toY;
        return this.view();
      }
      if (encounterAt(mv, nx, ny)) {
        const loc = getLocation(this.locationId);
        if (loc?.encounters) { const enc = rollEncounter(loc.encounters, timeOfDay(this.state), makeRng(Date.now())); if (enc) return this.startWild(enc.species, enc.level); }
      }
      return this.view();
    }

    const m = this.map();
    if (!isWalkable(m, nx, ny)) return this.view();
    this.px = nx; this.py = ny;
    this.state = advanceStep(this.state);
    const meta = metaAt(m, nx, ny);
    if (meta.exitTo) { this.enterLocation(meta.exitTo); return this.view(); }
    if (meta.npcId) { this.message = 'Aethel: The Core remembers every trainer who walked here.'; return this.view(); }
    if (meta.gymId) return this.startGym(meta.gymId);
    const t = tileAt(m, nx, ny);
    if (t === 'center') { this.state = healParty(this.state); this.overlay = { kind: 'center', message: 'Welcome! Your Pokémon are now fully rested and healed.' }; return this.view(); }
    if (t === 'shop') { return this.openShop(); }
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
      case 'shop':   return this.openShop();
      case 'pokedex': this.overlay = this.pokedexOverlay(); break;
      case 'box':    this.overlay = this.boxOverlay(); break;
      case 'vsseeker': this.overlay = this.vsSeekerOverlay(); break;
      case 'close':  this.overlay = null; break;
      default:       this.overlay = null; break;
    }
    return this.view();
  }

  private monList() {
    return this.state.party.map((p) => ({
      uid: p.uid, species: p.species, num: this.dexNum(p.species), level: p.level,
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

  // ---- Summary / Box / Pokédex / Vs-Seeker --------------------------------

  private monSummary(mon: OwnedPokemon) {
    const dex = (Sim.Dex as any).forGen(9);
    const stats = computeStats(mon);
    const group = growthRateOf(mon.species);
    const cur = expForLevel(mon.level, group);
    const next = mon.level >= 100 ? cur : expForLevel(mon.level + 1, group);
    const span = Math.max(1, next - cur);
    const into = mon.exp - cur;
    let heldItem = '';
    if (mon.heldItem) { try { heldItem = getItem(mon.heldItem).name; } catch { heldItem = mon.heldItem; } }
    return {
      species: mon.species, num: this.dexNum(mon.species), level: mon.level, gender: mon.gender ?? 'N',
      types: dex.species.get(mon.species).types as string[],
      ability: mon.ability, nature: mon.nature, heldItem,
      hp: mon.currentHp, maxHp: stats.hp, hpPercent: Math.round((mon.currentHp / stats.hp) * 100), status: mon.status ?? '',
      stats,
      exp: mon.exp, expIntoLevel: into, expSpan: span, expToNext: Math.max(0, next - mon.exp), expPercent: Math.min(100, Math.round((into / span) * 100)),
      moves: mon.moves.map((mv) => { const md = dex.moves.get(mv.id); return { name: md.name, type: md.type, pp: mv.pp, maxpp: maxPp(mv) }; }),
    };
  }
  summary(uid: string) {
    const mon = this.state.party.find((p) => p.uid === uid) ?? this.state.boxes.flatMap((b) => b.slots).find((m) => m?.uid === uid) ?? undefined;
    if (!mon) return this.view();
    this.overlay = { kind: 'summary', mon: this.monSummary(mon) };
    return this.view();
  }

  private boxOverlay() {
    this.boxIndex = Math.max(0, Math.min(this.boxIndex, this.state.boxes.length - 1));
    const box = this.state.boxes[this.boxIndex];
    return {
      kind: 'box', boxIndex: this.boxIndex, boxName: `Box ${this.boxIndex + 1}`, boxCount: this.state.boxes.length,
      party: this.monList().map((m) => ({ uid: m.uid, species: m.species, num: m.num, level: m.level, hpPercent: m.hpPercent, status: m.status })),
      slots: box.slots.map((m) => (m ? { uid: m.uid, species: m.species, num: this.dexNum(m.species), level: m.level } : null)),
    };
  }
  boxNav(delta: number) { this.boxIndex += delta; this.overlay = this.boxOverlay(); return this.view(); }
  deposit(uid: string) { this.state = depositToBox(this.state, uid); this.overlay = this.boxOverlay(); return this.view(); }
  withdraw(uid: string) { this.state = withdrawFromBox(this.state, uid); this.overlay = this.boxOverlay(); return this.view(); }

  private pokedexOverlay() {
    const dex = (Sim.Dex as any).forGen(9);
    const nums = new Set<number>([...this.state.pokedex.seen, ...this.state.pokedex.caught]);
    const nameByNum = new Map<number, string>();
    for (const sp of dex.species.all()) { if (nums.has(sp.num) && !nameByNum.has(sp.num)) nameByNum.set(sp.num, sp.name); }
    const entries = [...nums].sort((a, b) => a - b).map((num) => ({ num, name: nameByNum.get(num) ?? `#${num}`, caught: this.state.pokedex.caught.has(num) }));
    return { kind: 'pokedex', seen: this.state.pokedex.seen.size, caught: this.state.pokedex.caught.size, entries };
  }

  private vsSeekerOverlay() {
    const ready = listReadyRematches(this.state)
      .map((id) => { let name = id; try { name = getTrainer(id).name; } catch { /* keep id */ } return { trainerId: id, name, gymId: this.trainerGym[id] ?? '' }; })
      .filter((r) => r.gymId);
    return { kind: 'vsseeker', levelCap: rematchLevelCap(this.state), ready };
  }
  async rechallenge(gymId: string) { if (!gymId || this.battle) return this.view(); this.overlay = null; return this.startGym(gymId); }

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

  private playerTeam(): PokemonSet[] { return this.state.party.map((p) => ownedToSet(p)); }
  private activeMon() { return this.state.party[this.battle?.activeIdx ?? 0]; }

  private async startWild(species: string, level: number) {
    const wild = createOwned({ species, level, moves: wildMoveset(species, level) });
    this.state = registerSeen(this.state, this.dexNum(species));
    const bridge = new BattleBridge();
    await bridge.startBattle(this.playerTeam(), [ownedToSet(wild)], { formatid: 'gen9customgame', isWild: true, initialConditions: { p1: this.carryConditions() } });
    this.battle = { bridge, isWild: true, oppTeam: [ownedToSet(wild)], defeated: [{ species, level }], log: `A wild ${species} appeared!`, activeIdx: 0, participants: new Set([this.state.party[0].uid]), wildMon: wild };
    return this.battleView();
  }
  private async startGym(gymId: string) {
    const gym = getGym(gymId);
    const team = composeTeam(gym.trainer, { gen: 9, counterDraftStrength: 0.3, rng: makeRng(7) });
    for (const s of team) this.state = registerSeen(this.state, this.dexNum(s.species));
    const bridge = new BattleBridge();
    await bridge.startBattle(this.playerTeam(), team, { formatid: 'gen9customgame', initialConditions: { p1: this.carryConditions() } });
    this.battle = { bridge, isWild: false, oppTeam: team, defeated: team.map((s) => ({ species: s.species, level: s.level })), gymId, log: `${gym.trainer.name} wants to battle!`, activeIdx: 0, participants: new Set([this.state.party[0].uid]) };
    return this.battleView();
  }

  // Carry each party member's persisted HP/status into the battle (no free heal).
  private carryConditions() {
    return this.state.party.map((p) => ({ hpPercent: Math.round((p.currentHp / maxHp(p)) * 100), status: p.status ?? '' }));
  }

  // Type-effectiveness multiplier of an attacking type vs a set of defending types.
  // Returns 0 / 0.25 / 0.5 / 1 / 2 / 4, or null for non-damaging moves.
  private typeEff(moveType: string, defTypes: string[]): number {
    const dex = (Sim.Dex as any).forGen(9);
    let eff = 0;
    for (const dt of defTypes) {
      if (!dex.getImmunity(moveType, dt)) return 0;
      eff += dex.getEffectiveness(moveType, dt);
    }
    return Math.pow(2, eff);
  }

  private battleView() {
    const b = this.battle!; const s = b.bridge.state; const c = b.bridge.getChoices('p1');
    const dex = (Sim.Dex as any).forGen(9);
    const active = this.activeMon();
    const a1 = s.active.p1, a2 = s.active.p2;
    const foeSp = dex.species.get(a2.species);

    // Rich SELF view (your active mon — full stats/types/ability/item).
    let abilityDesc = ''; try { abilityDesc = dex.abilities.get(active.ability).shortDesc ?? ''; } catch { /* */ }
    let heldItem = '', itemDesc = '';
    if (active.heldItem) { try { const it = getItem(active.heldItem); heldItem = it.name; } catch { heldItem = active.heldItem; } }
    const self = {
      species: a1.species, num: this.dexNum(a1.species), level: active.level, gender: active.gender ?? 'N',
      // hp derives from the LIVE battle percent (persisted party HP only updates at battle end)
      hpPercent: a1.hpPercent, hp: Math.max(0, Math.round((a1.hpPercent / 100) * maxHp(active))), maxHp: maxHp(active),
      status: a1.status, boosts: a1.boosts ?? {}, volatiles: a1.volatiles ?? [],
      types: dex.species.get(a1.species).types as string[], ability: active.ability, abilityDesc,
      nature: active.nature, heldItem, itemDesc, stats: computeStats(active),
    };
    // Lighter FOE view (species/types/level + battle state).
    const foeSet = b.oppTeam.find((st) => dex.species.get(st.species).name === foeSp.name);
    const foe = {
      species: a2.species, num: this.dexNum(a2.species), hpPercent: a2.hpPercent,
      status: a2.status, boosts: a2.boosts ?? {}, volatiles: a2.volatiles ?? [],
      types: foeSp.types as string[], level: foeSet?.level ?? active.level,
    };

    const switches = this.state.party
      .map((p, i) => ({ index: i + 1, species: p.species, num: this.dexNum(p.species), level: p.level, hpPercent: Math.round((p.currentHp / maxHp(p)) * 100), status: p.status ?? '', fainted: p.currentHp <= 0 }))
      .filter((_, i) => i !== b.activeIdx);
    const balls = Object.entries(BALL_ITEM)
      .map(([ballType, itemId]) => ({ ballType, name: getItem(itemId).name, count: this.state.bag.balls?.[itemId] ?? 0 }))
      .filter((x) => x.count > 0);
    return {
      screen: 'battle' as const, isWild: b.isWild,
      self, foe,
      weather: s.weather ?? '', terrain: s.terrain ?? '',
      moves: c.moves.map((mo: { index: number; id: string; name: string; pp: number; maxpp: number }) => {
        const md = dex.moves.get(mo.id);
        return {
          index: mo.index, name: mo.name, type: md.type, category: md.category, pp: mo.pp, maxpp: mo.maxpp,
          power: md.basePower || null, accuracy: md.accuracy === true ? null : md.accuracy,
          shortDesc: md.shortDesc ?? md.desc ?? '',
          eff: md.category === 'Status' ? null : this.typeEff(md.type, foe.types),
        };
      }),
      bag: this.battleBag(), inBattleItems: !this.battle!.isWild ? true : true, // bag usable in any battle
      switches, balls,
      canCatch: c.canCatch, log: b.log,
      ended: b.ended ?? null,
      done: s.winner !== undefined ? (s.winner === 'p1' ? 'win' : 'loss') : null,
    };
  }

  // Field-usable healing/status/X items in the bag, for the in-battle BAG menu.
  private battleBag() {
    const usable = ['heal', 'cure', 'revive', 'pp'];
    const out: { itemId: string; name: string; count: number; effect: string }[] = [];
    for (const items of Object.values(this.state.bag)) {
      for (const [id, count] of Object.entries(items as Record<string, number>)) {
        let def; try { def = getItem(id); } catch { continue; }
        if (usable.includes(def.effect.kind)) out.push({ itemId: id, name: def.name, count, effect: def.effect.kind });
      }
    }
    return out;
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

  // The AI's choice for p2, given its (omniscient in PvE) view of the battle.
  private aiAction(): Action {
    const b = this.battle!;
    const view = buildView('p2', b.bridge.state, b.oppTeam, this.playerTeam(), b.bridge.getChoices('p2').moves, []);
    return chooseAction(view, { gen: 9, knobs: { randomness: 0.1, lookaheadDepth: 1, switchSmarts: 1 }, personality: { aggression: 1, caution: 0.5 }, rng: makeRng(Date.now()) });
  }
  // Submit one full turn (player action vs AI action) and narrate the result.
  private async resolve(p1Action: Action) {
    const b = this.battle!;
    const res = await b.bridge.submitTurn(p1Action, this.aiAction());
    const name = (side: string) => b.bridge.state.active[side as 'p1' | 'p2']?.species ?? (side === 'p1' ? 'Your Pokémon' : 'the foe');
    b.log = this.narrate(res.events, name);
    return res;
  }

  async turn(moveIndex: number) {
    const b = this.battle; if (!b) return this.view();
    await this.resolve({ kind: 'move', index: moveIndex });
    if (b.bridge.state.winner) return this.finish();
    return this.battleView();
  }

  async switchMon(index: number) {
    const b = this.battle; if (!b) return this.view();
    const target = this.state.party[index - 1];
    if (index - 1 === b.activeIdx || !target) return this.battleView();
    if (target.currentHp <= 0) { b.log = `${target.species} has no energy left to battle!`; return this.battleView(); }
    await this.resolve({ kind: 'switch', index });
    b.activeIdx = index - 1; b.participants.add(target.uid);
    if (b.bridge.state.winner) return this.finish();
    return this.battleView();
  }

  async catch(ball: string = 'poke') {
    const b = this.battle; if (!b) return this.view();
    if (!b.isWild) { b.log = "You can't catch another trainer's Pokémon!"; return this.battleView(); }
    const itemId = BALL_ITEM[ball] ?? 'pokeball';
    if ((this.state.bag.balls?.[itemId] ?? 0) <= 0) { b.log = `You don't have any ${getItem(itemId).name}s!`; return this.battleView(); }
    this.state = this.consume(this.state, 'balls', itemId);
    const foe = b.bridge.state.active.p2!.species;
    const r = b.bridge.attemptCatch(ball as BallType);
    if (r.caught) { b.log = `Gotcha! ${foe} was caught!`; return this.finish('caught'); }
    b.log = `Oh no! The wild ${foe} broke free!`;
    await this.resolve({ kind: 'move', index: 1 }); // a failed throw costs the turn — the foe acts
    if (b.bridge.state.winner) return this.finish();
    return this.battleView();
  }

  // Use a healing/cure item on the active mon mid-battle. (v1: does not consume the
  // turn — Showdown has no "skip" action; a turn-cost variant is a later refinement.)
  async useItemBattle(itemId: string) {
    const b = this.battle; if (!b) return this.view();
    let def; try { def = getItem(itemId); } catch { return this.battleView(); }
    // Sync the LIVE battle HP/status onto the party mon first — applyItem judges
    // "already full"/"no status" against the stored mon, which is stale mid-battle.
    const live = b.bridge.state.active.p1;
    if (live) {
      const cur = this.activeMon();
      const liveHp = Math.max(0, Math.round((live.hpPercent / 100) * maxHp(cur)));
      this.state = { ...this.state, party: this.state.party.map((p, i) => (i === b.activeIdx ? { ...setHp(p, liveHp), status: live.status || '' } : p)) };
    }
    const mon = this.activeMon();
    const { state, result } = applyItem(this.state, itemId, mon.uid);
    if (!result.ok) { b.log = `Can't use ${def.name}: ${result.reason}.`; return this.battleView(); }
    this.state = this.consume(state, def.pocket, itemId);
    const healed = this.activeMon();
    b.bridge.setActiveHp('p1', Math.round((healed.currentHp / maxHp(healed)) * 100), def.effect.kind === 'cure');
    b.log = `You used ${def.name} on ${healed.species}!`;
    return this.battleView();
  }

  // Flee a wild battle (persists the team's battle HP/status).
  async run() {
    const b = this.battle; if (!b) return this.view();
    if (!b.isWild) { b.log = "There's no running from a Trainer battle!"; return this.battleView(); }
    const fc = b.bridge.finalConditions().p1;
    this.writeBackParty(this.state.party.map((p, i) => ({ hpPercent: fc[i]?.hpPercent ?? Math.round((p.currentHp / maxHp(p)) * 100), status: fc[i]?.status ?? (p.status ?? '') })));
    b.ended = { result: 'run', message: 'Got away safely!', lines: ['Got away safely!'] };
    return this.battleView();
  }

  // Write each party member's end-of-battle HP/status back onto the saved party.
  private writeBackParty(fc: { hpPercent: number; status: string }[]) {
    this.state = { ...this.state, party: this.state.party.map((p, i) => fc[i] ? { ...setHp(p, Math.round((fc[i].hpPercent / 100) * maxHp(p))), status: fc[i].status } : p) };
  }

  private finish(catchResult?: 'caught') {
    const b = this.battle!;
    const fc = b.bridge.finalConditions().p1; // aligned to party order
    const finalConditions = this.state.party.map((p, i) => ({
      uid: p.uid,
      hpPercent: fc[i]?.hpPercent ?? Math.round((p.currentHp / maxHp(p)) * 100),
      status: fc[i]?.status ?? (p.status ?? ''),
    }));
    let msg = '';
    let rewards: BattleCtx['ended']['rewards'] | undefined;
    if (catchResult === 'caught') {
      this.writeBackParty(finalConditions);                       // your mon kept its battle damage
      if (b.wildMon) {                                            // actually add the caught Pokémon
        this.state = registerCaught(this.state, this.dexNum(b.wildMon.species));
        this.state = addToParty(this.state, b.wildMon);
      }
      const full = this.state.party.length >= 6;
      msg = `${b.wildMon?.species ?? 'The Pokémon'} was added to your ${full ? 'PC box' : 'team'}!`;
    } else if (b.bridge.state.winner === 'p1') {
      const out = applyBattleResult(this.state, {
        won: true, finalConditions,
        defeatedTeam: b.defeated, participantUids: Array.from(b.participants), isWild: b.isWild,
        trainer: b.gymId ? { basePayout: getGym(b.gymId).trainer.basePayout, tier: getGym(b.gymId).trainer.baseTier } : undefined,
        rng: makeRng(1),
      });
      this.state = out.state;
      const party = out.state.party;
      const nameOf = (uid: string) => party.find((p) => p.uid === uid)?.species ?? '?';
      rewards = {
        money: out.summary.money,
        exp: [...out.summary.expGained.entries()]
          .filter(([, amt]) => amt > 0)
          .map(([uid, amt]) => ({ species: nameOf(uid), amount: amt })),
        levelUps: out.summary.levelUps.map((l) => ({
          species: nameOf(l.uid),
          level: party.find((p) => p.uid === l.uid)?.level ?? 0,
          evolutionInto: l.evolutionInto,
        })),
        items: out.summary.items.map((id) => getItem(id).name),
      };
      if (b.gymId) { const gym = getGym(b.gymId); this.trainerGym[gym.trainer.id] = b.gymId; this.state = recordTrainerDefeat(grantBadge(this.state, gym.badgeId), gym.trainer.id); msg = `You earned the ${gym.badgeId} badge!`; }
      else msg = `You won! +${out.summary.money}₽`;
    } else {
      this.writeBackParty(finalConditions); // persist the beating even on a loss
      msg = 'You were defeated… your team needs healing.';
    }
    // Stage the result on the battle screen — DON'T drop to the overworld yet.
    // The player taps "Continue" (battleContinue) to dismiss it.
    const result = catchResult === 'caught' ? 'caught' : (b.bridge.state.winner === 'p1' ? 'win' : 'loss');
    b.ended = { result, message: msg, lines: [b.log, msg].filter(Boolean), rewards };
    return this.battleView();
  }

  // Autosave to a dedicated slot so the player can close the tab anytime and
  // resume via the title's Continue. Fire-and-forget; called at safe checkpoints.
  private autosave() { void this.saves.save('auto', serialize(this.state)); }

  // Dismiss the end-of-battle result screen and return to the overworld.
  battleContinue() {
    const b = this.battle; if (!b) return this.view();
    this.message = b.ended?.message ?? '';
    this.battle = null;
    this.autosave();
    return this.view();
  }

  // ---- Meta-screen commands (Batch E/F/G/H) --------------------------

  /** Title screen: check if any save slot has data. */
  async title() {
    const slots = await this.saves.list();
    return { screen: 'title' as const, hasSave: slots.length > 0 };
  }

  /** New game: signal dispatch to create a fresh session. */
  newGame(): { __reset: true } {
    return { __reset: true };
  }

  /** Load game: prefer the autosave slot, else the first available save. */
  async loadGame(): Promise<any> {
    const slots = await this.saves.list();
    if (!slots.length) return this.view();
    const pick = slots.find((s) => s.slot === 'auto') ?? slots[0];
    const json = await this.saves.load(pick.slot);
    if (!json) return this.view();
    return { __load: json };
  }

  /** Trainer card: summary of the player. */
  trainerCard() {
    const dex = (Sim.Dex as any).forGen(9);
    return {
      screen: 'trainercard' as const,
      money: this.state.money,
      badges: this.state.badges,
      party: this.state.party.map((p) => ({
        species: p.species, num: this.dexNum(p.species), level: p.level,
        hpPercent: Math.round((p.currentHp / maxHp(p)) * 100),
      })),
      dexSeen: this.state.pokedex.seen.size,
      dexCaught: this.state.pokedex.caught.size,
    };
  }

  /** Enhanced Pokédex: entries with detail data for caught species. */
  pokedex() {
    const dex = (Sim.Dex as any).forGen(9);
    // Showdown's species.get() keys on name/id, not dex number — build a
    // number→species map (first/base forme wins) so num lookups resolve.
    const byNum = new Map<number, any>();
    for (const s of dex.species.all()) {
      if (s.num > 0 && !byNum.has(s.num)) byNum.set(s.num, s);
    }
    const nums = new Set<number>([...this.state.pokedex.seen, ...this.state.pokedex.caught]);
    const entries: any[] = [];
    for (const num of [...nums].sort((a, b) => a - b)) {
      const sp = byNum.get(num);
      if (!sp) continue;
      const seen = this.state.pokedex.seen.has(num);
      const caught = this.state.pokedex.caught.has(num);
      const entry: any = {
        num, name: sp.name, seen, caught,
        types: sp.types as string[],
      };
      // Only include detail data for caught species
      if (caught) {
        entry.flavor = sp.description ?? '';
        // Base stats from the species data
        const bst = sp.baseStats;
        if (bst) {
          entry.baseStats = { hp: bst.hp ?? 0, atk: bst.atk ?? 0, def: bst.def ?? 0, spa: bst.spa ?? 0, spd: bst.spd ?? 0, spe: bst.spe ?? 0 };
        }
      }
      entries.push(entry);
    }
    return {
      screen: 'pokedex' as const,
      entries,
      seenCount: this.state.pokedex.seen.size,
      caughtCount: this.state.pokedex.caught.size,
    };
  }

  /** Region map: location list with visit tracking. */
  regionMap() {
    // Normalized positions on a 0..1 grid for drawing pins.
    // Laid out in a rough west-to-east / north-to-south progression.
    const positions: Record<string, { x: number; y: number }> = {
      'aethels-rest':      { x: 0.10, y: 0.55 },
      'whispering-path':   { x: 0.20, y: 0.45 },
      'verdant-hollow':    { x: 0.30, y: 0.50 },
      'verdant-tangle':    { x: 0.38, y: 0.40 },
      'cerulean-deep':     { x: 0.48, y: 0.35 },
      'tidal-drift':       { x: 0.55, y: 0.45 },
      'ember-peak':        { x: 0.62, y: 0.40 },
      'scorched-ascent':   { x: 0.68, y: 0.30 },
      'voltspire':         { x: 0.75, y: 0.35 },
      'circuit-way':       { x: 0.80, y: 0.45 },
      'mindweave':         { x: 0.85, y: 0.40 },
      'thought-garden':    { x: 0.88, y: 0.30 },
      'frostfell':         { x: 0.90, y: 0.20 },
      'glacier-pass':      { x: 0.85, y: 0.12 },
      'drakemaw':          { x: 0.78, y: 0.15 },
      'draconian-trail':   { x: 0.70, y: 0.10 },
      'shadowmere':        { x: 0.60, y: 0.08 },
    };
    const locations = ALL_LOCATIONS.map((loc) => {
      const pos = positions[loc.id] ?? { x: 0.5, y: 0.5 };
      return {
        id: loc.id, name: loc.name, x: pos.x, y: pos.y,
        visited: this.visitedLocations.has(loc.id),
        current: this.locationId === loc.id,
      };
    });
    return { screen: 'regionmap' as const, locations, current: this.locationId };
  }

  /** Open shop: returns the shop view-model with buy/sell data. */
  openShop(shopId?: string) {
    return this.shopView(shopId);
  }
  private shopView(shopId?: string) {
    const sid = shopId ?? this.shopId();
    const shop = getShop(sid);
    const mult = priceMultipliers(this.state.settings.difficultyMode);
    const buy = availableStock(shop, this.state).map((e) => {
      const def = getItem(e.itemId);
      return { id: e.itemId, itemId: e.itemId, name: def.name, price: Math.ceil(def.buyPrice * mult.buy) };
    });
    const sell = Object.values(this.state.bag).flatMap((items) =>
      Object.keys(items as Record<string, number>).map((id) => {
        const def = getItem(id);
        return { id, itemId: id, name: def.name, count: (items as Record<string, number>)[id], price: Math.floor(def.sellPrice * mult.sell) };
      }));
    return {
      screen: 'shop' as const, name: shop.name, stock: buy, sellItems: sell, money: this.state.money,
    };
  }

  /** Buy from shop, then return updated shop view (keeps player in shop screen). */
  shopBuy(itemId: string, qty = 1) {
    const { state, result } = buyItem(this.state, getShop(this.shopId()), itemId, qty);
    this.state = state;
    if (!result.ok) {
      return { ...this.shopView(), message: `Can't buy: ${result.reason}.` };
    }
    return { ...this.shopView(), message: `Bought ${qty}\u00d7 ${getItem(itemId).name}.` };
  }

  /** Sell to shop, then return updated shop view. */
  shopSell(itemId: string, qty = 1) {
    const { state, result } = sellItem(this.state, itemId, qty);
    this.state = state;
    if (!result.ok) {
      return { ...this.shopView(), message: `Can't sell: ${result.reason}.` };
    }
    return { ...this.shopView(), message: `Sold ${qty}\u00d7 ${getItem(itemId).name}.` };
  }

  /** Open options: returns a view that signals the client to show the options overlay. */
  openOptions() { return { screen: 'options' as const }; }

  /** Close auxiliary screens (client-driven; server just returns to overworld). */
  closeOptions() { this.overlay = null; return this.view(); }
  closeTrainerCard() { return this.view(); }
  closePokedex() { return this.view(); }
  closeShop() { this.overlay = null; return this.view(); }
  closeRegionMap() { return this.view(); }
}

let singleton: GameSession | null = null;
export async function dispatch(cmd: string, body: any) {
  if (!singleton || cmd === 'reset') singleton = new GameSession();
  switch (cmd) {
    case 'view': return singleton.view();
    case 'move': return singleton.move(body.dir);
    case 'loadSample': return singleton.loadSample(body.id);
    case 'turn': return singleton.turn(body.index);
    case 'switchMon': return singleton.switchMon(body.index);
    case 'catch': return singleton.catch(body.ball ?? 'poke');
    case 'battleContinue': return singleton.battleContinue();
    case 'useItemBattle': return singleton.useItemBattle(body.itemId);
    case 'run': return singleton.run();
    case 'summary': return singleton.summary(body.uid);
    case 'boxNav': return singleton.boxNav(body.delta);
    case 'deposit': return singleton.deposit(body.uid);
    case 'withdraw': return singleton.withdraw(body.uid);
    case 'rechallenge': return singleton.rechallenge(body.gymId);
    case 'menu': return singleton.menu(body.which);
    case 'closeMenu': return singleton.closeMenu();
    case 'swapParty': return singleton.swapParty(body.a, body.b);
    case 'useItem': return singleton.useItem(body.itemId, body.targetUid, body.moveIndex);
    case 'buy': return singleton.buy(body.itemId, body.qty ?? 1);
    case 'sell': return singleton.sell(body.itemId, body.qty ?? 1);
    case 'save': return singleton.save(body.slot);
    case 'load': return singleton.load(body.slot);
    case 'title': return singleton.title();
    case 'newGame': {
      const r = singleton.newGame();
      if (r.__reset) { singleton = new GameSession(); return singleton.view(); }
      return r;
    }
    case 'loadGame': {
      const r = await singleton.loadGame();
      if (r.__load) {
        singleton = new GameSession();
        singleton.state = validateAndRepair(deserialize(r.__load));
        singleton.message = 'Game loaded.';
        singleton.overlay = null;
        singleton.battle = null;
        return singleton.view();
      }
      return r;
    }
    case 'trainerCard': return singleton.trainerCard();
    case 'pokedex': return singleton.pokedex();
    case 'regionMap': return singleton.regionMap();
    case 'openShop': return singleton.openShop(body.shopId);
    case 'shopBuy': return singleton.shopBuy(body.itemId, body.qty ?? 1);
    case 'shopSell': return singleton.shopSell(body.itemId, body.qty ?? 1);
    case 'closeOptions': return singleton.closeOptions();
    case 'closeTrainerCard': return singleton.closeTrainerCard();
    case 'closePokedex': return singleton.closePokedex();
    case 'closeShop': return singleton.closeShop();
    case 'openOptions': return singleton.openOptions();
    case 'closeRegionMap': return singleton.closeRegionMap();
    default: return { error: `unknown cmd ${cmd}` };
  }
}
