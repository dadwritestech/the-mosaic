import { describe, it, expect } from 'vitest';
import { decodeTable, toRpgMap, toTilesets } from './rmxp';

function table1d(cells: number[]) {
  const head = new Int32Array([1, cells.length, 1, 1, cells.length]);
  const body = new Int16Array(cells);
  const out = new Uint8Array(head.byteLength + body.byteLength);
  out.set(new Uint8Array(head.buffer), 0);
  out.set(new Uint8Array(body.buffer), head.byteLength);
  return { __userClass: 'Table', data: out };
}

function tableBlob(xs: number, ys: number, zs: number, cells: number[]): Uint8Array {
  const head = new Int32Array([3, xs, ys, zs, cells.length]);
  const body = new Int16Array(cells);
  const out = new Uint8Array(head.byteLength + body.byteLength);
  out.set(new Uint8Array(head.buffer), 0);
  out.set(new Uint8Array(body.buffer), head.byteLength);
  return out;
}

describe('decodeTable', () => {
  it('parses dims + cells and indexes (x,y,z)', () => {
    // 2x2x2, cells laid out z-major then y then x
    const t = decodeTable({ __userClass: 'Table', data: tableBlob(2, 2, 2, [10,11,12,13, 20,21,22,23]) });
    expect([t.xsize, t.ysize, t.zsize]).toEqual([2, 2, 2]);
    expect(t.at(0, 0, 0)).toBe(10);
    expect(t.at(1, 0, 0)).toBe(11);
    expect(t.at(0, 1, 0)).toBe(12);
    expect(t.at(1, 1, 1)).toBe(23);
  });
  it('decodes from a non-aligned buffer offset', () => {
    // place the blob at byte offset 1 inside a larger buffer (offset not a multiple of 4)
    const blob = tableBlob(1, 1, 1, [42]);
    const padded = new Uint8Array(blob.length + 1);
    padded.set(blob, 1);
    const t = decodeTable({ __userClass: 'Table', data: padded.subarray(1) });
    expect(t.at(0, 0, 0)).toBe(42);
  });
});

describe('toRpgMap', () => {
  it('extracts width/height/tileset_id/data/events from an RPG::Map object', () => {
    const obj = { __class: 'RPG::Map', ivars: {
      '@width': 2, '@height': 1, '@tileset_id': 7,
      '@data': { __userClass: 'Table', data: tableBlob(2, 1, 3, [384,385, 0,0, 0,0]) },
      '@events': {},
    }};
    const m = toRpgMap(obj);
    expect(m.width).toBe(2);
    expect(m.tilesetId).toBe(7);
    expect(m.data.at(0, 0, 0)).toBe(384);
    expect(m.data.at(1, 0, 0)).toBe(385);
  });
});

describe('toTilesets', () => {
  it('reads name, autotiles, passages, terrain tags by id', () => {
    const ts = { __class: 'RPG::Tileset', ivars: {
      '@tileset_name': 'Outside', '@autotile_names': ['Grass','','','','','',''],
      '@passages': table1d([0x0f, 0x00, 0x00]),     // id0 blocked, id1/2 passable
      '@priorities': table1d([0, 0, 1]),
      '@terrain_tags': table1d([0, 2, 0]),          // id1 terrain tag 2
    }};
    const out = toTilesets([null, ts]);
    expect(out[1]!.tilesetName).toBe('Outside');
    expect(out[1]!.autotileNames[0]).toBe('Grass');
    expect(out[1]!.passable(0)).toBe(false);
    expect(out[1]!.passable(1)).toBe(true);
    expect(out[1]!.priority(2)).toBe(1);
    expect(out[1]!.terrainTag(1)).toBe(2);
  });
});
