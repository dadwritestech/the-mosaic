import { describe, it, expect } from 'vitest';
import { riftStatus, riftsAddressedCount, partyGenLean, sealDirectionBiome, sealRift, attuneRift, zoneEncounters, ATTUNE_LEVEL_BUMP } from './rift-state';
import { getRift } from '../content/rifts';
import type { GameState } from './types';

const baseState = (party: { species: string }[]) =>
  ({ riftStates: {}, stabilizeMeter: 0, party } as unknown as GameState);

const stateWith = (riftStates: GameState['riftStates']) => ({ riftStates } as GameState);

describe('rift status helpers', () => {
  it('absent rift reads as unsealed; addressed count ignores unsealed', () => {
    const s = stateWith({ thornmarsh: { status: 'sealed', biome: 'kanto-plains' }, emberreef: { status: 'attuned' } });
    expect(riftStatus(s, 'thornmarsh')).toBe('sealed');
    expect(riftStatus(s, 'nope')).toBe('unsealed');
    expect(riftsAddressedCount(s)).toBe(2);
  });
});

describe('partyGenLean', () => {
  it("'old' when the team skews Gen 4 and below", () => {
    expect(partyGenLean([{ species: 'Pidgey' }, { species: 'Totodile' }])).toBe('old'); // gens 1,2
  });
  it("'new' when at least half are Gen 5+", () => {
    expect(partyGenLean([{ species: 'Pidgey' }, { species: 'Blitzle' }, { species: 'Frigibax' }])).toBe('new'); // 1,5,9
  });
  it("tie resolves to 'new'", () => {
    expect(partyGenLean([{ species: 'Pidgey' }, { species: 'Blitzle' }])).toBe('new'); // old1,new1 -> tie -> new
  });
});

describe('sealDirectionBiome', () => {
  const thornmarsh = getRift('thornmarsh')!; // kanto-plains g1 <-> johto-forests g2
  it('new-leaning team collapses the seam to the higher-gen region', () => {
    expect(sealDirectionBiome(thornmarsh, [{ species: 'Blitzle' }, { species: 'Frigibax' }])).toBe('johto-forests');
  });
  it('old-leaning team collapses to the lower-gen region', () => {
    expect(sealDirectionBiome(thornmarsh, [{ species: 'Pidgey' }, { species: 'Rattata' }])).toBe('kanto-plains');
  });
});

describe('seal / attune actions', () => {
  const thornmarsh = getRift('thornmarsh')!;
  it('sealRift sets sealed + chosen biome and pushes the meter toward Reset', () => {
    const s = sealRift(baseState([{ species: 'Pidgey' }]), thornmarsh);
    expect(s.riftStates['thornmarsh']).toEqual({ status: 'sealed', biome: 'kanto-plains' });
    expect(s.stabilizeMeter).toBeLessThan(0);
  });
  it('attuneRift sets attuned and pushes the meter toward Embrace', () => {
    const s = attuneRift(baseState([{ species: 'Pidgey' }]), thornmarsh);
    expect(s.riftStates['thornmarsh'].status).toBe('attuned');
    expect(s.stabilizeMeter).toBeGreaterThan(0);
  });
  it('is a no-op once a rift is already addressed', () => {
    const once = sealRift(baseState([{ species: 'Pidgey' }]), thornmarsh);
    const twice = attuneRift(once, thornmarsh);
    expect(twice).toBe(once);
  });
});

describe('zoneEncounters', () => {
  const thornmarsh = getRift('thornmarsh')!;
  it('unsealed yields the fused table', () => {
    const s = { riftStates: {} } as GameState;
    expect(zoneEncounters(s, thornmarsh)).toBe(thornmarsh.fusedEncounters);
  });
  it('sealed yields the surviving region pure table', () => {
    const a = { riftStates: { thornmarsh: { status: 'sealed', biome: 'kanto-plains' } } } as unknown as GameState;
    expect(zoneEncounters(a, thornmarsh)).toBe(thornmarsh.pureEncountersA);
    const b = { riftStates: { thornmarsh: { status: 'sealed', biome: 'johto-forests' } } } as unknown as GameState;
    expect(zoneEncounters(b, thornmarsh)).toBe(thornmarsh.pureEncountersB);
  });
  it('attuned yields fused with levels bumped (original untouched)', () => {
    const s = { riftStates: { thornmarsh: { status: 'attuned' } } } as unknown as GameState;
    const base = thornmarsh.fusedEncounters.morning![0];
    const baseMin = base.minLevel, baseMax = base.maxLevel;
    const bumped = zoneEncounters(s, thornmarsh).morning![0];
    expect(bumped.minLevel).toBe(baseMin + ATTUNE_LEVEL_BUMP);
    expect(bumped.maxLevel).toBe(baseMax + ATTUNE_LEVEL_BUMP);
    expect(thornmarsh.fusedEncounters.morning![0].minLevel).toBe(baseMin);
  });
});
