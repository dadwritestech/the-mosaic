import { describe, it, expect } from 'vitest';
import { warpAt, encounterAt, walkableAt } from './loader';
import type { MapV2 } from './mapv2';

const m: MapV2 = {
  id: 't', width: 2, height: 1, tileset: 'Outside', autotiles: [],
  layers: [[[0, 0]], [[0, 0]], [[0, 0]]], passages: [[true, false]], priorities: [[0, 0]],
  warps: [{ x: 1, y: 0, toMap: 'inside', toX: 3, toY: 4 }], triggers: [], encounters: [[false, true]],
  spawn: { x: 0, y: 0 },
};

describe('loader helpers', () => {
  it('finds a warp at a cell', () => {
    expect(warpAt(m, 1, 0)).toEqual({ x: 1, y: 0, toMap: 'inside', toX: 3, toY: 4 });
    expect(warpAt(m, 0, 0)).toBeNull();
  });
  it('reports encounter cells', () => {
    expect(encounterAt(m, 1, 0)).toBe(true);
    expect(encounterAt(m, 0, 0)).toBe(false);
  });
  it('reports walkability + bounds', () => {
    expect(walkableAt(m, 0, 0)).toBe(true);
    expect(walkableAt(m, 1, 0)).toBe(false);
    expect(walkableAt(m, 5, 0)).toBe(false);
  });
});
