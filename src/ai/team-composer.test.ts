import { describe, it, expect } from 'vitest';
import { composeTeam } from './team-composer';
import type { TrainerDef, ComposeContext } from './team-composer';
import { makeRng } from './rng';
import { baseStatTotal, gymSpeciesPool } from './species-pool';
import * as Sim from 'pokemon-showdown';

const def = (over: Partial<TrainerDef> = {}): TrainerDef => ({
  baseTier: 'hard', teamSize: 3, levelCap: 50, gymType: 'Steel', ...over,
});
const ctx = (over: Partial<ComposeContext> = {}): ComposeContext => ({
  gen: 9, counterDraftStrength: 0, rng: makeRng(11), ...over,
});

describe('composeTeam', () => {
  it('drafts the requested number of mons, all matching the gym type', () => {
    const team = composeTeam(def(), ctx());
    expect(team.length).toBe(3);
    for (const set of team) {
      const types = (Sim.Dex as any).forGen(9).species.get(set.species).types;
      expect(types.includes('Steel')).toBe(true);
      expect(set.level).toBe(50);
      expect(set.moves.length).toBeGreaterThan(0);
    }
  });

  it('is deterministic for the same def + seed', () => {
    const a = composeTeam(def(), ctx({ rng: makeRng(99) }));
    const b = composeTeam(def(), ctx({ rng: makeRng(99) }));
    expect(a.map((s) => s.species)).toEqual(b.map((s) => s.species));
  });

  it('higher counterDraftStrength drafts stronger teams ON AVERAGE (robust across seeds)', () => {
    // The draft is probabilistic: a single seed can tie or invert (~26% of seeds).
    // The real, asserted property is that the bias holds in aggregate, so we average
    // over many seeds rather than relying on one cherry-picked seed.
    const poolBst = new Map(
      gymSpeciesPool(9, 'Steel').map((s) => [s.name, baseStatTotal(s.baseStats)] as const),
    );
    const teamAvg = (team: { species: string }[]) =>
      team.reduce((a, s) => a + (poolBst.get(s.species) ?? 0), 0) / team.length;

    const N = 40;
    let weakTotal = 0, strongTotal = 0;
    for (let seed = 0; seed < N; seed++) {
      weakTotal += teamAvg(composeTeam(def({ teamSize: 4 }), ctx({ counterDraftStrength: 0, rng: makeRng(seed) })));
      strongTotal += teamAvg(composeTeam(def({ teamSize: 4 }), ctx({ counterDraftStrength: 1, rng: makeRng(seed) })));
    }
    // Aggregate bias is large (~+40 BST); require a clear, non-fragile margin.
    expect(strongTotal / N).toBeGreaterThan(weakTotal / N + 15);
  });
});
