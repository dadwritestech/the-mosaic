import { describe, it, expect } from 'vitest';
import { readMarshal } from './marshal';

const wrap = (...bytes: number[]) => new Uint8Array([0x04, 0x08, ...bytes]);

describe('marshal primitives', () => {
  it('reads nil/true/false', () => {
    expect(readMarshal(wrap(0x30))).toBe(null);          // '0'
    expect(readMarshal(wrap(0x54))).toBe(true);          // 'T'
    expect(readMarshal(wrap(0x46))).toBe(false);         // 'F'
  });
  it('reads fixnums (compact encoding)', () => {
    expect(readMarshal(wrap(0x69, 0x00))).toBe(0);       // i, 0
    expect(readMarshal(wrap(0x69, 0x06))).toBe(1);       // i, n+5 for 1..122 => 6
    expect(readMarshal(wrap(0x69, 0x7f))).toBe(122);     // 0x7f = 127 => 122
    expect(readMarshal(wrap(0x69, 0xfa))).toBe(-1);      // n-5 for -1 => 0xfa
    expect(readMarshal(wrap(0x69, 0x01, 0xff))).toBe(255);   // 1 trailing byte
    expect(readMarshal(wrap(0x69, 0x02, 0x00, 0x01))).toBe(256); // 2 trailing bytes
  });
});
