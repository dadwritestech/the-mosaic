import { describe, it, expect } from 'vitest';
import { evaluateMove } from './calc-evaluator';
import type { ActiveView } from './types';

const set = (species: string, extra: Partial<any> = {}) => ({
  name: species, species, ability: extra.ability ?? '', item: extra.item ?? '',
  moves: extra.moves ?? [], nature: 'Hardy',
  evs: extra.evs ?? { hp: 0, atk: 252, def: 0, spa: 252, spd: 0, spe: 0 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50,
});

describe('evaluateMove', () => {
  it('reports a guaranteed OHKO as koThisTurnChance=1 for a strong hit', () => {
    const atk: ActiveView = { set: set('Pikachu', { evs: { spa: 252 } }), hpPercent: 100, status: '' };
    const def: ActiveView = { set: set('Gyarados'), hpPercent: 100, status: '' };
    const r = evaluateMove(9, atk, def, 'Thunderbolt');
    expect(r.koThisTurnChance).toBe(1);
    expect(r.avgDamagePercent).toBeGreaterThan(90);
  });

  it('reports koThisTurnChance=0 when the move cannot KO this turn', () => {
    const atk: ActiveView = { set: set('Pikachu', { evs: { spa: 252 } }), hpPercent: 100, status: '' };
    const def: ActiveView = { set: set('Snorlax', { evs: { hp: 252, spd: 252 } }), hpPercent: 100, status: '' };
    const r = evaluateMove(9, atk, def, 'Thunderbolt');
    expect(r.koThisTurnChance).toBe(0);
    expect(r.avgDamagePercent).toBeGreaterThan(0);
  });

  it('a damaged + statused target is easier to KO', () => {
    const atk: ActiveView = { set: set('Pikachu', { evs: { spa: 252 } }), hpPercent: 100, status: '' };
    const full: ActiveView = { set: set('Snorlax', { evs: { hp: 252 } }), hpPercent: 100, status: '' };
    const weak: ActiveView = { set: set('Snorlax', { evs: { hp: 252 } }), hpPercent: 12, status: 'brn' };
    expect(evaluateMove(9, atk, weak, 'Thunderbolt').koThisTurnChance)
      .toBeGreaterThan(evaluateMove(9, atk, full, 'Thunderbolt').koThisTurnChance);
  });
});
