import { describe, it, expect } from 'vitest';
import { buildMoveset } from './moveset-builder';
import * as Sim from 'pokemon-showdown';

const bp = (id: string) => (Sim.Dex as any).forGen(9).moves.get(id).basePower as number;
const avgBp = (ids: string[]) => {
  const dmg = ids.map((id) => (Sim.Dex as any).forGen(9).moves.get(id)).filter((m: any) => m.category !== 'Status' && m.basePower > 0);
  return dmg.length ? dmg.reduce((a: number, m: any) => a + m.basePower, 0) / dmg.length : 0;
};

describe('buildMoveset', () => {
  it('returns 1..4 legal moves including at least one damaging move', () => {
    const moves = buildMoveset(9, 'skarmory', 'hard');
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.length).toBeLessThanOrEqual(4);
    expect(moves.some((id) => bp(id) > 0)).toBe(true);
  });

  it('hard tier picks higher-power damaging moves than easy tier', () => {
    const hard = buildMoveset(9, 'skarmory', 'hard');
    const easy = buildMoveset(9, 'skarmory', 'easy');
    expect(avgBp(hard)).toBeGreaterThan(avgBp(easy));
  });

  it('is deterministic for a given species+tier', () => {
    expect(buildMoveset(9, 'skarmory', 'normal')).toEqual(buildMoveset(9, 'skarmory', 'normal'));
  });
});
