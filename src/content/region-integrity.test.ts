import { describe, it, expect } from 'vitest';
import * as Sim from 'pokemon-showdown';
import { ALL_LOCATIONS, ALL_GYMS, ALL_TRAINERS, ALL_SHOPS } from './region/index';
import { composeTeam } from '../ai/team-composer';
import { makeRng } from '../ai/rng';
import { ITEMS } from '../game/items/catalog';

const dex = (Sim.Dex as any).forGen(9);
const VALID_TYPES = new Set(['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy']);

describe('region integrity', () => {
  it('the map is fully connected with symmetric links', () => {
    const ids = new Set(ALL_LOCATIONS.map((l) => l.id));
    for (const l of ALL_LOCATIONS) for (const c of l.connections) {
      expect(ids.has(c)).toBe(true);
      expect(ALL_LOCATIONS.find((x) => x.id === c)!.connections).toContain(l.id);
    }
    const start = 'aethels-rest';
    const seen = new Set([start]); const q = [start];
    while (q.length) { const cur = q.shift()!; for (const n of ALL_LOCATIONS.find((l) => l.id === cur)!.connections) if (!seen.has(n)) { seen.add(n); q.push(n); } }
    expect(seen.size).toBe(ALL_LOCATIONS.length);
  });

  it('has exactly 8 gyms, type-locked, with strictly increasing level caps', () => {
    expect(ALL_GYMS.length).toBe(8);
    const badgeIds = new Set<string>();
    let prevCap = 0;
    for (const g of ALL_GYMS) {
      expect(VALID_TYPES.has(g.type)).toBe(true);
      expect(g.trainer.gymType).toBe(g.type);
      expect(badgeIds.has(g.badgeId)).toBe(false); badgeIds.add(g.badgeId);
      expect(g.trainer.levelCap).toBeGreaterThan(prevCap); prevCap = g.trainer.levelCap;
    }
  });

  it('every encounter species exists in the dex and is standard; levels are valid', () => {
    for (const l of ALL_LOCATIONS) for (const tbl of Object.values(l.encounters ?? {})) for (const e of tbl ?? []) {
      const s = dex.species.get(e.species);
      expect(s.exists, `${e.species} in ${l.id}`).toBe(true);
      expect(!!s.isNonstandard).toBe(false);
      expect(e.minLevel).toBeGreaterThanOrEqual(1);
      expect(e.maxLevel).toBeGreaterThanOrEqual(e.minLevel);
    }
  });

  it('every shop item exists in the catalog', () => {
    for (const shop of ALL_SHOPS) for (const entry of shop.stock) expect(ITEMS[entry.itemId], entry.itemId).toBeTruthy();
  });

  it('every gym composes a legal type-locked team', () => {
    for (const g of ALL_GYMS) {
      const team = composeTeam(g.trainer, { gen: 9, counterDraftStrength: 0.3, rng: makeRng(1) });
      expect(team.length).toBe(g.trainer.teamSize);
      for (const set of team) expect(dex.species.get(set.species).types).toContain(g.type);
    }
  });

  // Sanity: registry of trainers is non-empty and ids unique.
  it('trainers have unique ids', () => {
    const ids = ALL_TRAINERS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
