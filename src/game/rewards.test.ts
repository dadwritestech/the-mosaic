import { describe, it, expect } from 'vitest';
import { computeRewards, moneyMod } from './rewards';
import { makeRng } from '../ai/rng';

describe('rewards', () => {
  it('trainer money = basePayout * highestLevel * moneyMod', () => {
    const r = computeRewards({ isWild: false, trainer: { basePayout: 50, tier: 'hard' }, opponentLevels: [10, 20], mode: 'normal', rng: makeRng(1) });
    expect(r.money).toBe(1000); // 50 * 20 * 1.0
  });
  it('harder modes pay less', () => {
    const hard = computeRewards({ isWild: false, trainer: { basePayout: 50, tier: 'hard' }, opponentLevels: [20], mode: 'hard', rng: makeRng(1) });
    expect(hard.money).toBe(900); // 50*20*0.9
  });
  it('wild battles pay no money', () => {
    expect(computeRewards({ isWild: true, opponentLevels: [20], mode: 'normal', rng: makeRng(1) }).money).toBe(0);
  });
  it('rolls drops from a trainer drop table deterministically', () => {
    const ctx = { isWild: false, trainer: { basePayout: 10, tier: 'hard', dropTable: [{ itemId: 'potion', chance: 1 }, { itemId: 'ultraball', chance: 0 }] }, opponentLevels: [20], mode: 'normal' as const, rng: makeRng(1) };
    const r = computeRewards(ctx);
    expect(r.items).toContain('potion');     // chance 1 always drops
    expect(r.items).not.toContain('ultraball'); // chance 0 never
  });
  it('moneyMod ordering', () => {
    expect(moneyMod('normal')).toBeGreaterThan(moneyMod('hardest'));
  });
});
