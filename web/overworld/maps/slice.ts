import type { TileMap, Tile, TileMeta } from '../tilemap';

// W3 — open-field maps. Instead of tiny walled boxes, areas are generated as
// larger open grass fields ('field' = bare walkable ground) with winding dirt
// paths, scattered tall-grass encounter patches, irregular tree borders, and
// buildings/exits placed at exact coordinates (so server logic stays correct).

interface Pt { x: number; y: number; }
interface Building extends Pt { kind: 'center' | 'shop' | 'gym'; gymId?: string; }
interface Npc extends Pt { id: string; }
interface Exit extends Pt { to: string; }
interface GrassPatch extends Pt { r: number; }

export interface AreaSpec {
  id: string; biome: string; w: number; h: number;
  spawn: Pt;
  exits: Exit[];
  buildings?: Building[];
  npcs?: Npc[];
  grass?: GrassPatch[];
  path?: Pt[];
}

export function genArea(s: AreaSpec): TileMap {
  const { w, h } = s;
  const tiles: Tile[][] = Array.from({ length: h }, () => Array.from({ length: w }, () => 'field' as Tile));
  const meta: Record<string, TileMeta> = {};
  const noise = (x: number, y: number) => { const v = Math.sin(x * 12.9 + y * 78.2) * 43758.5; return v - Math.floor(v); };

  // irregular tree border (1-2 tiles thick, ragged)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
    const thick = noise(x, y) > 0.62 ? 2 : 1;
    if (edge < thick) tiles[y][x] = 'wall';
  }

  // dirt path through waypoints (Manhattan segments, ~1 tile wide)
  const carve = (x: number, y: number) => { if (x >= 0 && x < w && y >= 0 && y < h && tiles[y][x] !== 'wall') tiles[y][x] = 'floor'; };
  const path = s.path ?? [];
  for (let i = 0; i + 1 < path.length; i++) {
    let { x, y } = path[i]; const t = path[i + 1];
    while (x !== t.x) { carve(x, y); carve(x, y + 1); x += Math.sign(t.x - x); }
    while (y !== t.y) { carve(x, y); carve(x + 1, y); y += Math.sign(t.y - y); }
    carve(t.x, t.y);
  }

  // tall-grass encounter patches (only over open field, not paths)
  for (const g of s.grass ?? []) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (Math.hypot(x - g.x, y - g.y) <= g.r && tiles[y][x] === 'field') tiles[y][x] = 'grass';
  }

  // buildings
  for (const b of s.buildings ?? []) {
    tiles[b.y][b.x] = b.kind;
    if (b.kind === 'gym' && b.gymId) meta[`${b.x},${b.y}`] = { gymId: b.gymId };
  }
  // npcs
  for (const n of s.npcs ?? []) { tiles[n.y][n.x] = 'npc'; meta[`${n.x},${n.y}`] = { npcId: n.id }; }
  // exits — open the border and ensure a walkable approach
  for (const e of s.exits) {
    tiles[e.y][e.x] = 'exit'; meta[`${e.x},${e.y}`] = { exitTo: e.to };
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = e.x + dx, ny = e.y + dy;
      if (nx > 0 && nx < w - 1 && ny > 0 && ny < h - 1 && tiles[ny][nx] === 'wall') tiles[ny][nx] = 'floor';
    }
  }

  return { id: s.id, biome: s.biome, tiles, spawn: s.spawn, meta };
}

export const SLICE_MAPS: Record<string, TileMap> = {
  'aethels-rest': genArea({
    id: 'aethels-rest', biome: 'kanto-plains', w: 18, h: 13,
    spawn: { x: 9, y: 9 },
    buildings: [{ x: 6, y: 4, kind: 'center' }, { x: 12, y: 4, kind: 'shop' }],
    npcs: [{ x: 9, y: 6, id: 'aethel' }],
    exits: [{ x: 9, y: 12, to: 'whispering-path' }],
    path: [{ x: 9, y: 12 }, { x: 9, y: 6 }, { x: 6, y: 5 }, { x: 9, y: 6 }, { x: 12, y: 5 }],
  }),
  'whispering-path': genArea({
    id: 'whispering-path', biome: 'kanto-plains', w: 22, h: 11,
    spawn: { x: 1, y: 5 },
    exits: [{ x: 0, y: 5, to: 'aethels-rest' }, { x: 21, y: 5, to: 'verdant-hollow' }],
    grass: [{ x: 8, y: 4, r: 2.2 }, { x: 14, y: 7, r: 2.2 }, { x: 11, y: 5, r: 1.6 }],
    path: [{ x: 0, y: 5 }, { x: 21, y: 5 }],
  }),
  'verdant-hollow': genArea({
    id: 'verdant-hollow', biome: 'johto-forests', w: 16, h: 13,
    spawn: { x: 8, y: 11 },
    buildings: [{ x: 8, y: 4, kind: 'gym', gymId: 'verdant-gym' }, { x: 4, y: 7, kind: 'center' }, { x: 12, y: 7, kind: 'shop' }],
    exits: [{ x: 8, y: 12, to: 'whispering-path' }],
    path: [{ x: 8, y: 12 }, { x: 8, y: 4 }, { x: 4, y: 7 }, { x: 8, y: 8 }, { x: 12, y: 7 }],
  }),
};
