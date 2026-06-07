import { describe, it, expect } from 'vitest';
import { rollEncounter } from './encounters';
import { makeRng } from '../ai/rng';
import type { EncounterTable } from './types';

const table: EncounterTable = {
  day: [
    { species: 'Pidgey', minLevel: 2, maxLevel: 4, weight: 9 },
    { species: 'Rattata', minLevel: 3, maxLevel: 3, weight: 1 },
  ],
  night: [],
};

describe('rollEncounter', () => {
  it('returns a species from the requested time bucket within its level range', () => {
    const r = rollEncounter(table, 'day', makeRng(1))!;
    expect(['Pidgey', 'Rattata']).toContain(r.species);
    const entry = table.day!.find((e) => e.species === r.species)!;
    expect(r.level).toBeGreaterThanOrEqual(entry.minLevel);
    expect(r.level).toBeLessThanOrEqual(entry.maxLevel);
  });
  it('returns null for an empty or missing bucket', () => {
    expect(rollEncounter(table, 'night', makeRng(1))).toBeNull();
    expect(rollEncounter(table, 'morning', makeRng(1))).toBeNull();
  });
  it('respects weights (the 9:1 favorite dominates over many rolls)', () => {
    let pidgey = 0;
    for (let s = 0; s < 200; s++) if (rollEncounter(table, 'day', makeRng(s))!.species === 'Pidgey') pidgey++;
    expect(pidgey).toBeGreaterThan(140); // ~90% expected
  });
});
