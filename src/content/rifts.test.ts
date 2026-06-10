import { describe, it, expect } from 'vitest';
import { RIFTS, getRift } from './rifts';
import { BIOME_GEN } from '../game/generations';
import type { EncounterTable } from './types';

const nonEmpty = (t: EncounterTable) =>
  Object.values(t).some((list) => Array.isArray(list) && list.length > 0);

describe('rift registry', () => {
  it('has unique ids and getRift resolves them', () => {
    const ids = RIFTS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of RIFTS) expect(getRift(r.id)).toBe(r);
  });

  it('each rift pairs two different biomes of different generations', () => {
    for (const r of RIFTS) {
      expect(r.biomeA).not.toBe(r.biomeB);
      expect(BIOME_GEN[r.biomeA]).not.toBe(BIOME_GEN[r.biomeB]);
    }
  });

  it('each rift has non-empty fused + both pure encounter tables', () => {
    for (const r of RIFTS) {
      expect(nonEmpty(r.fusedEncounters)).toBe(true);
      expect(nonEmpty(r.pureEncountersA)).toBe(true);
      expect(nonEmpty(r.pureEncountersB)).toBe(true);
    }
  });

  it('each Warden has a signature tactic and a level cap within the band', () => {
    for (const r of RIFTS) {
      expect(r.warden.signatureTactic.length).toBeGreaterThan(0);
      expect(r.warden.levelCap).toBeGreaterThanOrEqual(r.levelBand.max);
    }
  });

  it('level bands increase monotonically across the chain', () => {
    for (let i = 1; i < RIFTS.length; i++) {
      expect(RIFTS[i].levelBand.min).toBeGreaterThan(RIFTS[i - 1].levelBand.min);
    }
  });
});
