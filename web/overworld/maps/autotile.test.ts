import { describe, it, expect } from 'vitest';
import { AUTOTILE_TABLE, autotileQuads, quarterSrc } from './autotile';

describe('autotile table', () => {
  it('has 48 entries, each 4 quarter-indices in range 0..47', () => {
    expect(AUTOTILE_TABLE).toHaveLength(48);
    for (const quad of AUTOTILE_TABLE) {
      expect(quad).toHaveLength(4);
      for (const q of quad) { expect(q).toBeGreaterThanOrEqual(0); expect(q).toBeLessThanOrEqual(47); }
    }
  });
  it('sub-pattern 0 is the fully-surrounded centre tile (quads 26,27,32,33)', () => {
    expect(autotileQuads(0)).toEqual([26, 27, 32, 33]);
  });
  it('maps a 16x16 quarter index to source px (6-wide grid)', () => {
    expect(quarterSrc(0)).toEqual({ sx: 0, sy: 0 });
    expect(quarterSrc(7)).toEqual({ sx: 16, sy: 16 }); // index7 -> col1,row1
  });
});
