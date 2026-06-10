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

describe('marshal composites', () => {
  it('reads symbol + symlink', () => {
    // [:ab, :ab] -> array len 2, def-symbol 'ab', symlink 0
    const v = readMarshal(new Uint8Array([0x04,0x08, 0x5b,0x07, 0x3a,0x07,0x61,0x62, 0x3b,0x00]));
    expect(v).toEqual([{ __symbol: 'ab' }, { __symbol: 'ab' }]);
  });
  it('reads ascii string (ivar-wrapped)', () => {
    // I"hi\x06:\x06ET  (string "hi", 1 ivar :E=true)
    const v = readMarshal(new Uint8Array([0x04,0x08, 0x49,0x22,0x07,0x68,0x69, 0x06,0x3a,0x06,0x45,0x54]));
    expect(v).toBe('hi');
  });
  it('reads hash {i6=>i7}', () => {
    const v = readMarshal(new Uint8Array([0x04,0x08, 0x7b,0x06, 0x69,0x06, 0x69,0x07]));
    expect(v).toEqual({ '1': 2 });
  });
  it('reads object o:Foo with @x=1', () => {
    // o:\x08Foo\x06:\x07@x i\x06
    const v = readMarshal(new Uint8Array([0x04,0x08, 0x6f,0x3a,0x08,0x46,0x6f,0x6f, 0x06, 0x3a,0x07,0x40,0x78, 0x69,0x06]));
    expect(v).toEqual({ __class: 'Foo', ivars: { '@x': 1 } });
  });
  it('reads userdef u:Table<bytes>', () => {
    // u:\nTable\x07\x01\x02  (class Table, 2 bytes 0x01 0x02)
    const v = readMarshal(new Uint8Array([0x04,0x08, 0x75,0x3a,0x0a,0x54,0x61,0x62,0x6c,0x65, 0x07,0x01,0x02])) as { __userClass: string; data: Uint8Array };
    expect(v.__userClass).toBe('Table');
    expect([...v.data]).toEqual([1, 2]);
  });
});
