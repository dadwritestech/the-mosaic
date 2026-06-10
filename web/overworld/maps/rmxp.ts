import type { MarshalValue } from './marshal';

export interface RmxpTable {
  xsize: number; ysize: number; zsize: number;
  cells: Int16Array;
  at(x: number, y: number, z: number): number;
}

const iv = (o: MarshalValue, k: string): MarshalValue =>
  (o && typeof o === 'object' && 'ivars' in o) ? (o as { ivars: Record<string, MarshalValue> }).ivars[k] : undefined as unknown as MarshalValue;

/** Decode an RMXP Table user-data blob: [dim,x,y,z,total] int32 then `total` int16. */
export function decodeTable(v: MarshalValue): RmxpTable {
  if (!v || typeof v !== 'object' || !('__userClass' in v) || v.__userClass !== 'Table') {
    throw new Error('not a Table');
  }
  const data = (v as { __userClass: string; data: Uint8Array }).data;
  // DataView tolerates non-aligned byteOffsets (typed-array views would throw).
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const xsize = dv.getInt32(4, true);
  const ysize = dv.getInt32(8, true);
  const zsize = dv.getInt32(12, true);
  const total = dv.getInt32(16, true);
  const cells = new Int16Array(total);
  for (let i = 0; i < total; i++) cells[i] = dv.getInt16(20 + i * 2, true);
  return {
    xsize, ysize, zsize, cells,
    at: (x, y, z) => cells[z * xsize * ysize + y * xsize + x],
  };
}

export interface RpgEvent { x: number; y: number; name: string; pages: MarshalValue[]; }
export interface RpgMap {
  width: number; height: number; tilesetId: number;
  data: RmxpTable; events: RpgEvent[];
}

export function toRpgMap(obj: MarshalValue): RpgMap {
  const width = iv(obj, '@width') as number;
  const height = iv(obj, '@height') as number;
  const tilesetId = iv(obj, '@tileset_id') as number;
  const data = decodeTable(iv(obj, '@data'));
  const rawEvents = (iv(obj, '@events') ?? {}) as Record<string, MarshalValue>;
  const events: RpgEvent[] = Object.values(rawEvents).map((e) => ({
    x: iv(e, '@x') as number,
    y: iv(e, '@y') as number,
    name: (iv(e, '@name') as string) ?? '',
    pages: (iv(e, '@pages') as MarshalValue[]) ?? [],
  }));
  return { width, height, tilesetId, data, events };
}

export interface RpgTileset {
  tilesetName: string;
  autotileNames: string[];
  passable(id: number): boolean;
  priority(id: number): number;
  terrainTag(id: number): number;
}

export function toTilesets(arr: MarshalValue[]): (RpgTileset | null)[] {
  return arr.map((ts) => {
    if (!ts) return null;
    const pass = decodeTable(iv(ts, '@passages')).cells;
    const prio = decodeTable(iv(ts, '@priorities')).cells;
    const terr = decodeTable(iv(ts, '@terrain_tags')).cells;
    return {
      tilesetName: iv(ts, '@tileset_name') as string,
      autotileNames: (iv(ts, '@autotile_names') as string[]) ?? [],
      passable: (id) => ((pass[id] ?? 0) & 0x0f) !== 0x0f,
      priority: (id) => prio[id] ?? 0,
      terrainTag: (id) => terr[id] ?? 0,
    };
  });
}
