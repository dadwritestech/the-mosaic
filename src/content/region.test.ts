import { describe, it, expect } from 'vitest';
import { getLocation, getTrainer, getGym, getShop, neighbors } from './region';

describe('region registry', () => {
  it('resolves slice locations and the slice is connected', () => {
    expect(getLocation('aethels-rest').name).toBe("Aethel's Rest");
    expect(neighbors('aethels-rest')).toContain('whispering-path');
    expect(neighbors('whispering-path').sort()).toEqual(['aethels-rest', 'verdant-hollow']);
  });
  it('resolves the Grass gym and its leader', () => {
    const gym = getGym('verdant-gym');
    expect(gym.type).toBe('Grass');
    expect(gym.badgeId).toBe('mosaic-leaf');
    expect(getTrainer(gym.trainer.id).name).toBe('Bramble');
  });
  it('resolves the starter-town shop', () => {
    expect(getShop('aethel-mart').stock.some((e) => e.itemId === 'pokeball')).toBe(true);
  });
  it('throws on unknown ids', () => {
    expect(() => getLocation('nowhere')).toThrow();
  });
});
