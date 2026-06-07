import { describe, it, expect } from 'vitest';
import { catchChance, BALL_MODIFIERS } from './catch';

describe('catch formula', () => {
  it('master ball always catches', () => {
    expect(catchChance({ baseRate: 3, hpPercent: 100, status: '', ball: 'master' })).toBe(1);
  });
  it('low hp + status beats full hp for the same species/ball', () => {
    const weak = catchChance({ baseRate: 45, hpPercent: 5, status: 'slp', ball: 'ultra' });
    const full = catchChance({ baseRate: 45, hpPercent: 100, status: '', ball: 'poke' });
    expect(weak).toBeGreaterThan(full);
  });
  it('chance is clamped to [0,1]', () => {
    const c = catchChance({ baseRate: 255, hpPercent: 1, status: 'slp', ball: 'ultra' });
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(1);
  });
  it('exposes ball modifiers', () => {
    expect(BALL_MODIFIERS.ultra).toBeGreaterThan(BALL_MODIFIERS.poke);
  });
});
