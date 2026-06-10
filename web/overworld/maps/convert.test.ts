import { describe, it, expect } from 'vitest';
import { convertMap } from './convert';
import type { RpgMap, RpgTileset } from './rmxp';

function fakeMap(): RpgMap {
  // 2x1, 3 layers. cell(0,0): layer0=384, cell(1,0): layer0=48; upper layers 0.
  const cells = new Int16Array([384, 48,  0, 0,  0, 0]); // z0:[384,48] z1:[0,0] z2:[0,0]
  return {
    width: 2, height: 1, tilesetId: 1, events: [],
    data: { xsize: 2, ysize: 1, zsize: 3, cells, at: (x, y, z) => cells[z * 2 * 1 + y * 2 + x] },
  };
}
const fakeTileset = (): RpgTileset => ({
  tilesetName: 'Outside', autotileNames: ['Grass','','','','','',''],
  passable: (id) => id !== 384,            // 384 is a wall, 48 (grass) passable
  priority: () => 0,
  terrainTag: (id) => (id === 48 ? 1 : 0), // grass autotile has terrain tag 1
});

describe('convertMap', () => {
  it('builds layers, passability and encounters from top tile', () => {
    const m = convertMap(fakeMap(), fakeTileset(), { id: 'test', spawn: { x: 0, y: 0 } });
    expect(m.width).toBe(2);
    expect(m.tileset).toBe('Outside');
    expect(m.autotiles[0]).toBe('Grass');
    expect(m.layers[0][0]).toEqual([384, 48]);    // layer0 row0
    expect(m.passages[0]).toEqual([false, true]); // 384 blocked, 48 passable
    expect(m.encounters[0]).toEqual([false, true]); // only grass cell
    expect(m.warps).toEqual([]);
    expect(m.triggers).toEqual([]);
  });
});
