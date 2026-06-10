import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { readMarshal } from './marshal';
import { toRpgMap } from './rmxp';

describe('real Essentials map fixture', () => {
  it('parses sample-map.rxdata to a sane RPG::Map', () => {
    const buf = readFileSync(new URL('./__fixtures__/sample-map.rxdata', import.meta.url));
    const m = toRpgMap(readMarshal(new Uint8Array(buf)));
    expect(m.width).toBeGreaterThan(0);
    expect(m.height).toBeGreaterThan(0);
    expect(m.data.zsize).toBe(3);
    expect(m.tilesetId).toBeGreaterThan(0);
  });
});
