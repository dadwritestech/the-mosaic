import { describe, it, expect } from 'vitest';
import { BIOME_GEN, speciesGeneration } from './generations';

describe('BIOME_GEN', () => {
  it('maps every biome to its source generation', () => {
    expect(BIOME_GEN['kanto-plains']).toBe(1);
    expect(BIOME_GEN['johto-forests']).toBe(2);
    expect(BIOME_GEN['hoenn-beaches']).toBe(3);
    expect(BIOME_GEN['sinnoh-tundra']).toBe(4);
    expect(BIOME_GEN['unova-urban']).toBe(5);
    expect(BIOME_GEN['kalos-gardens']).toBe(6);
    expect(BIOME_GEN['alola-islands']).toBe(7);
    expect(BIOME_GEN['galar-countryside']).toBe(8);
    expect(BIOME_GEN['paldea-wilds']).toBe(9);
  });
});

describe('speciesGeneration', () => {
  it('maps national-dex number to generation at range boundaries', () => {
    expect(speciesGeneration(1)).toBe(1);     // Bulbasaur
    expect(speciesGeneration(151)).toBe(1);   // Mew
    expect(speciesGeneration(152)).toBe(2);   // Chikorita
    expect(speciesGeneration(251)).toBe(2);
    expect(speciesGeneration(386)).toBe(3);
    expect(speciesGeneration(493)).toBe(4);
    expect(speciesGeneration(649)).toBe(5);
    expect(speciesGeneration(721)).toBe(6);
    expect(speciesGeneration(809)).toBe(7);
    expect(speciesGeneration(905)).toBe(8);
    expect(speciesGeneration(906)).toBe(9);
    expect(speciesGeneration(1025)).toBe(9);
  });
  it('returns 0 for an unknown/out-of-range number', () => {
    expect(speciesGeneration(0)).toBe(0);
    expect(speciesGeneration(99999)).toBe(0);
  });
});
