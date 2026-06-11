import { describe, it, expect } from 'vitest';
import { riftStatus, riftsAddressedCount, partyGenLean, sealDirectionBiome, sealRift, attuneRift } from './rift-state';
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
