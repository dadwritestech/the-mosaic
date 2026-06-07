import { describe, it, expect } from 'vitest';
import { reputationLevel, deriveNotableTraits } from './reputation';
import { createPlayerModel } from './player-model';

describe('reputation', () => {
  it('maps score+badges to ascending levels', () => {
    expect(reputationLevel(0, 0)).toBe('Unknown');
    expect(reputationLevel(3, 0)).toBe('Noticed');
    expect(reputationLevel(8, 0)).toBe('Known');
    expect(reputationLevel(10, 5)).toBe('Renowned'); // 10 + 5*2 = 20
    expect(reputationLevel(40, 8)).toBe('Legendary');
  });

  it('derives traits only from high-confidence extreme tendencies', () => {
    const m = createPlayerModel();
    m.tendencies.typeReliance = { value: 0.95, confidence: 0.8 };  // confident + extreme
    m.tendencies.statusUsage = { value: 0.95, confidence: 0.1 };   // extreme but NOT confident
    const traits = deriveNotableTraits(m.tendencies);
    expect(traits.some((t) => /type/i.test(t))).toBe(true);
    expect(traits.some((t) => /status/i.test(t))).toBe(false);
  });
});
