import type { GameState } from './types';
import { getItem } from './items/catalog';
import { spendMoney, addMoney, addItem, useItem } from './game-state';

export interface ShopEntry { itemId: string; badgeGate: number; }
export interface ShopDef { id: string; name: string; stock: ShopEntry[]; }
export interface ShopResult { ok: boolean; reason?: string; }

export function priceMultipliers(mode: GameState['settings']['difficultyMode']): { buy: number; sell: number } {
  if (mode === 'hard') return { buy: 1.1, sell: 0.4 };
  if (mode === 'hardest') return { buy: 1.25, sell: 0.3 };
  return { buy: 1.0, sell: 0.5 };
}

export function availableStock(shop: ShopDef, state: GameState): ShopEntry[] {
  return shop.stock.filter((e) => e.badgeGate <= state.badges.length);
}

export function buyItem(state: GameState, shop: ShopDef, itemId: string, qty = 1): { state: GameState; result: ShopResult } {
  if (!availableStock(shop, state).some((e) => e.itemId === itemId)) return { state, result: { ok: false, reason: 'not in stock' } };
  const def = getItem(itemId);
  const mult = priceMultipliers(state.settings.difficultyMode).buy;
  const cost = Math.ceil(def.buyPrice * mult * qty);
  const spent = spendMoney(state, cost);
  if (!spent) return { state, result: { ok: false, reason: 'not enough money' } };
  return { state: addItem(spent, def.pocket, itemId, qty), result: { ok: true } };
}

export function sellItem(state: GameState, itemId: string, qty = 1): { state: GameState; result: ShopResult } {
  const def = getItem(itemId);
  const have = state.bag[def.pocket]?.[itemId] ?? 0;
  if (have < qty) return { state, result: { ok: false, reason: 'not enough to sell' } };
  const mult = priceMultipliers(state.settings.difficultyMode).sell;
  let s = state;
  for (let i = 0; i < qty; i++) s = useItem(s, def.pocket, itemId);
  s = addMoney(s, Math.floor(def.sellPrice * mult * qty));
  return { state: s, result: { ok: true } };
}
