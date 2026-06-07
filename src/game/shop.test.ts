import { describe, it, expect } from 'vitest';
import { availableStock, buyItem, sellItem, priceMultipliers } from './shop';
import type { ShopDef } from './shop';
import { createNewGame, addMoney, addItem, grantBadge } from './game-state';

const shop: ShopDef = { id: 'mart', name: 'Mart', stock: [
  { itemId: 'potion', badgeGate: 0 },
  { itemId: 'hyperpotion', badgeGate: 3 },
] };

describe('shop', () => {
  it('hides badge-gated stock until enough badges', () => {
    let g = createNewGame({ difficultyMode: 'normal', nuzlocke: false });
    expect(availableStock(shop, g).map((e) => e.itemId)).toEqual(['potion']);
    g = grantBadge(grantBadge(grantBadge(g, 'a'), 'b'), 'c');
    expect(availableStock(shop, g).map((e) => e.itemId)).toContain('hyperpotion');
  });

  it('buys an item, debiting money and adding to the bag', () => {
    let g = addMoney(createNewGame({ difficultyMode: 'normal', nuzlocke: false }), 1000);
    const r = buyItem(g, shop, 'potion', 2);
    expect(r.result.ok).toBe(true);
    expect(r.state.money).toBe(1000 - 400); // 200*1.0*2
    expect(r.state.bag.medicine.potion).toBe(2);
  });

  it('refuses an unaffordable or out-of-stock purchase', () => {
    let g = addMoney(createNewGame({ difficultyMode: 'normal', nuzlocke: false }), 100);
    expect(buyItem(g, shop, 'potion', 1).result.ok).toBe(false);      // can't afford (price 200)
    expect(buyItem(addMoney(g, 10000), shop, 'hyperpotion', 1).result.ok).toBe(false); // gated out
  });

  it('sells an item at the difficulty-adjusted price', () => {
    let g = addItem(createNewGame({ difficultyMode: 'hard', nuzlocke: false }), 'medicine', 'potion', 1);
    const r = sellItem(g, 'potion', 1);
    expect(r.result.ok).toBe(true);
    expect(r.state.money).toBe(Math.floor(100 * 0.4)); // sellPrice 100 * hard sellMult 0.4
  });

  it('hard mode buys cost more than normal', () => {
    expect(priceMultipliers('hardest').buy).toBeGreaterThan(priceMultipliers('normal').buy);
  });
});
