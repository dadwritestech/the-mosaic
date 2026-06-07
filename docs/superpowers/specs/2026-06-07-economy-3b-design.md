# Economy (Sub-project 3b) — Spec

**Date:** 2026-06-07
**Status:** Approved (design)
**Parent:** `2026-06-07-pokemon-region-game-design.md`
**Depends on:** 3a (GameState, owned-pokemon helpers, bag/money ops), Battle Bridge
(ball types), Showdown Dex (items, evolution data, movepools).

## Purpose

The money → shop → heal → use-item loop, plus the full item roster. 3b owns the item
catalog, the consumable effect engine, shops, Pokémon Centers, and — because their
data is ready — evolution and TM move-teaching. Fully headless and testable.

## Scope boundary (full item roster, B)

- **3b owns:** full **item catalog** (data we bundle), the **consumable effect engine**
  (heal/cure/revive/vitamin/PP/ball), **shops** (badge-gated stock, difficulty
  pricing, buy/sell), **Pokémon Centers** (full party heal incl. PP), **evolution**
  engine (item- and level-triggered, shared with 3c), **TM teaching** (movepool
  legality), and **PP math**.
- **3b defers (defines item + effect descriptor; enforcement in sub-project 4):**
  Repel and Escape Rope — `applyItem` sets state flags the overworld later honors.

## Data we own / verify at plan time
- **Item catalog** (id, name, pocket, buyPrice, sellPrice, useContext, effect) — Showdown
  has competitive held items/berries but no Potions/Revives/prices. We bundle the
  catalog; core roster seeded at build time, the long tail bulk-filled later (`pi`).
- **Evolution data** — probe Showdown's `species.evos`/evolved-species
  `evoLevel`/`evoItem`/`evoType`/`evoCondition` shape when planning (like prior probes).

## Modules & responsibilities

- `src/game/pp.ts` — `maxPp(move)` (= `floor(basePp × (5 + ppUps) / 5)`), `restorePp(mon)`.
- `src/game/items/catalog.ts` — `ITEMS: Record<string, ItemDef>`, `getItem(id)`.
- `src/game/items/effects.ts` — `applyItem(state, itemId, targetUid?, moveIndex?) →
  { state, result }`: a pure dispatcher over `ItemEffect.kind`, validating each use.
- `src/game/evolution.ts` — `evolutionFor(mon, trigger) → species | null`,
  `evolve(mon, intoSpecies) → mon` (species change; ability slot re-resolved; stats
  auto-recompute since derived; HP scaled to new max).
- `src/game/tm.ts` — `teachMove(mon, moveId, replaceIndex?) → { mon, result }`
  (legal only if `moveId ∈ getMovePool(species)`).
- `src/game/shop.ts` — `availableStock(shop, state)`, `buyItem`, `sellItem`,
  `priceMultipliers(mode)`.
- `src/game/center.ts` — `healParty(state) → state` (HP + status + PP for all party).

## Types

```ts
type StatusName = '' | 'psn' | 'tox' | 'par' | 'brn' | 'slp' | 'frz';
type ItemEffect =
  | { kind: 'heal'; amount: number | 'full' }
  | { kind: 'cure'; status: 'all' | StatusName }
  | { kind: 'revive'; fraction: number }            // 0..1 of max HP
  | { kind: 'ev'; stat: keyof Stats6; amount: number }
  | { kind: 'pp'; mode: 'restore' | 'restoreAll' | 'up'; amount?: number }
  | { kind: 'ball'; ballType: 'poke' | 'great' | 'ultra' | 'master' }
  | { kind: 'evoStone'; stone: string }
  | { kind: 'tm'; move: string }
  | { kind: 'repel'; steps: number }
  | { kind: 'escapeRope' };

interface ItemDef {
  id: string; name: string; pocket: string;
  buyPrice: number; sellPrice: number;
  useContext: 'field' | 'battle' | 'both' | 'hold';
  effect: ItemEffect;
}

interface ShopEntry { itemId: string; badgeGate: number; } // visible when badges ≥ gate
interface ShopDef { id: string; name: string; stock: ShopEntry[]; }

interface ItemUseResult { ok: boolean; reason?: string; evolvedInto?: string; }
```

## Effect engine behavior

`applyItem` validates before mutating and returns a clear result:
- `heal` — fails on a fainted (0 HP) or already-full mon; else `setHp(min(max, cur+amount))`.
- `cure` — fails if the target has no (matching) status; else clears it.
- `revive` — fails on a non-fainted mon; else sets HP to `round(fraction × max)`.
- `ev` — `addEvs` (caps already enforced in 3a); fails if no change possible.
- `pp` — restore/restoreAll/up via `pp.ts`; fails if already full / max PP-ups.
- `ball` — only valid in a battle context; hands off to the catch action (the Bridge).
- `evoStone` — calls `evolutionFor(mon, { kind:'item', item })`; evolves or fails.
- `tm` — calls `teachMove`; fails if not learnable.
- `repel` / `escapeRope` — sets `state.flags` the overworld reads later (deferred).

## Shops & economy

- `priceMultipliers(mode)`: normal `{buy:1.0, sell:0.5}`, hard `{buy:1.1, sell:0.4}`,
  hardest `{buy:1.25, sell:0.3}` (applied to the catalog's buy/sell prices).
- `availableStock` filters `shop.stock` by `badgeGate ≤ state.badges.length`.
- `buyItem` — item must be in available stock; price = `ceil(buyPrice × buyMult × qty)`;
  uses `spendMoney` (null → fail); `addItem`. `sellItem` — `floor(sellPrice × sellMult ×
  qty)` via `addMoney`; `useItem` × qty (fails if not enough held).

## Pokémon Center

`healParty(state)` maps each party member through `healFull` + `restorePp` (full HP,
cleared status, full PP). Pure; returns a new state. (Save-on-heal / Center as save
point already handled by 3a's `canSaveHere`.)

## Test strategy (headless, deterministic)

- **PP:** `maxPp` matches known values (e.g. a 24-base move with 3 PP-ups = 38);
  `restorePp` refills.
- **Effects:** each `ItemEffect.kind` — heal clamps & rejects full/fainted; cure
  rejects no-status; revive rejects healthy; vitamin respects caps; PP restore;
  evoStone evolves the right species; TM rejects an un-learnable move.
- **Evolution:** a stone evolves the correct species (e.g. Pikachu + Thunder Stone →
  Raichu); a level trigger evolves at the right level (e.g. Charmander L16 →
  Charmeleon); evolved stats come out higher; non-evolvers return null.
- **TM:** teaching a learnable move fills/replaces a slot; an illegal move is rejected.
- **Shop:** badge-gated entries hidden below the gate; buy debits money & adds item;
  can't buy unaffordable / out-of-stock; sell credits money & removes item; difficulty
  multipliers change buy/sell totals.
- **Center:** `healParty` restores HP/status/PP across a damaged, statused, low-PP party.

## Out of scope (later)
Repel/Escape-Rope *enforcement* (overworld, 4); exp/money/item *rewards from battle*
(3c); the full National-Dex item catalog tail (bulk, `pi`); UI (5).
