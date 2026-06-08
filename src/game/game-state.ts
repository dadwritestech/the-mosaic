import type { GameState, GameSettings, OwnedPokemon } from './types';

const BOX_COUNT = 8, BOX_SIZE = 30;

export function createNewGame(settings: GameSettings): GameState {
  return {
    schemaVersion: 1, settings,
    party: [], boxes: Array.from({ length: BOX_COUNT }, (_, i) => ({ name: `Box ${i + 1}`, slots: Array(BOX_SIZE).fill(null) })),
    bag: {}, money: 0, badges: [],
    pokedex: { seen: new Set(), caught: new Set() },
    location: { mapId: 'start', x: 0, y: 0, atPokemonCenter: true },
    flags: {}, graveyard: [], time: { day: 0, minutes: 0 },
    trainerLog: {},
    stabilizeMeter: 0,
  };
}

function firstFreeBoxSlot(g: GameState): { box: number; slot: number } | null {
  for (let b = 0; b < g.boxes.length; b++) {
    const s = g.boxes[b].slots.findIndex((x) => x === null);
    if (s >= 0) return { box: b, slot: s };
  }
  return null;
}

export function addToParty(g: GameState, mon: OwnedPokemon): GameState {
  if (g.party.length < 6) return { ...g, party: [...g.party, mon] };
  const free = firstFreeBoxSlot(g);
  if (!free) return g;
  const boxes = g.boxes.map((b) => ({ ...b, slots: b.slots.slice() }));
  boxes[free.box].slots[free.slot] = mon;
  return { ...g, boxes };
}

export function depositToBox(g: GameState, uid: string): GameState {
  const mon = g.party.find((m) => m.uid === uid);
  if (!mon) return g;
  const free = firstFreeBoxSlot(g);
  if (!free) return g;
  const boxes = g.boxes.map((b) => ({ ...b, slots: b.slots.slice() }));
  boxes[free.box].slots[free.slot] = mon;
  return { ...g, party: g.party.filter((m) => m.uid !== uid), boxes };
}

export function withdrawFromBox(g: GameState, uid: string): GameState {
  if (g.party.length >= 6) return g;
  const boxes = g.boxes.map((b) => ({ ...b, slots: b.slots.slice() }));
  for (const b of boxes) {
    const i = b.slots.findIndex((m) => m?.uid === uid);
    if (i >= 0) { const mon = b.slots[i]!; b.slots[i] = null; return { ...g, party: [...g.party, mon], boxes }; }
  }
  return g;
}

/** Reorders the party by swapping two slots. No-op for out-of-range or equal indices. */
export function swapPartyMembers(g: GameState, i: number, j: number): GameState {
  if (i === j || i < 0 || j < 0 || i >= g.party.length || j >= g.party.length) return g;
  const party = g.party.slice();
  [party[i], party[j]] = [party[j], party[i]];
  return { ...g, party };
}

export function addItem(g: GameState, pocket: string, itemId: string, count = 1): GameState {
  const bag = { ...g.bag, [pocket]: { ...(g.bag[pocket] ?? {}) } };
  bag[pocket][itemId] = (bag[pocket][itemId] ?? 0) + count;
  return { ...g, bag };
}

export function useItem(g: GameState, pocket: string, itemId: string): GameState {
  const have = g.bag[pocket]?.[itemId] ?? 0;
  if (have <= 0) return g;
  const bag = { ...g.bag, [pocket]: { ...g.bag[pocket] } };
  if (have - 1 <= 0) delete bag[pocket][itemId]; else bag[pocket][itemId] = have - 1;
  return { ...g, bag };
}

export function addMoney(g: GameState, amount: number): GameState {
  return { ...g, money: g.money + Math.max(0, amount) };
}

/** Returns the new state, or null if the player can't afford it. */
export function spendMoney(g: GameState, amount: number): GameState | null {
  if (amount > g.money) return null;
  return { ...g, money: g.money - amount };
}

export function grantBadge(g: GameState, badge: string): GameState {
  return g.badges.includes(badge) ? g : { ...g, badges: [...g.badges, badge] };
}

export function registerSeen(g: GameState, num: number): GameState {
  const seen = new Set(g.pokedex.seen); seen.add(num);
  return { ...g, pokedex: { ...g.pokedex, seen } };
}

export function registerCaught(g: GameState, num: number): GameState {
  const seen = new Set(g.pokedex.seen); seen.add(num);
  const caught = new Set(g.pokedex.caught); caught.add(num);
  return { ...g, pokedex: { seen, caught } };
}
