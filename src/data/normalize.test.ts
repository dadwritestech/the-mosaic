import { describe, it, expect } from 'vitest';
import { toKey } from './normalize';

describe('toKey', () => {
  it('strips punctuation/spaces and lowercases', () => {
    expect(toKey('Pikachu')).toBe('pikachu');
    expect(toKey('Mr. Mime')).toBe('mrmime');
    expect(toKey('Farfetch’d')).toBe('farfetchd');
    expect(toKey('Nidoran-F')).toBe('nidoranf');
  });
});
