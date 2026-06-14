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
    exits: [{ x: 8, y: 12, to: 'whispering-path' }, { x: 15, y: 6, to: 'verdant-tangle' }],
    path: [{ x: 8, y: 12 }, { x: 8, y: 4 }, { x: 4, y: 7 }, { x: 8, y: 8 }, { x: 12, y: 7 }, { x: 15, y: 6 }],
  }),
  'verdant-tangle': genArea({
    id: 'verdant-tangle', biome: 'johto-forests', w: 35, h: 25,
    spawn: { x: 1, y: 12 },
    exits: [{ x: 0, y: 12, to: 'verdant-hollow' }, { x: 34, y: 12, to: 'cerulean-deep' }],
    grass: [{ x: 10, y: 8, r: 3 }, { x: 18, y: 18, r: 4 }, { x: 26, y: 6, r: 3.5 }],
    path: [{ x: 0, y: 12 }, { x: 10, y: 12 }, { x: 10, y: 5 }, { x: 25, y: 5 }, { x: 25, y: 12 }, { x: 34, y: 12 }],
  }),
  'cerulean-deep': genArea({
    id: 'cerulean-deep', biome: 'hoenn-beaches', w: 25, h: 20,
    spawn: { x: 12, y: 10 },
    buildings: [{ x: 12, y: 4, kind: 'gym', gymId: 'cerulean-gym' }, { x: 6, y: 15, kind: 'center' }, { x: 18, y: 15, kind: 'shop' }],
    npcs: [{ x: 10, y: 8, id: 'maris-fan' }, { x: 14, y: 12, id: 'old-fisher' }],
    exits: [{ x: 0, y: 10, to: 'verdant-tangle' }, { x: 24, y: 10, to: 'tidal-drift' }],
    path: [{ x: 0, y: 10 }, { x: 12, y: 10 }, { x: 12, y: 4 }, { x: 6, y: 15 }, { x: 18, y: 15 }, { x: 12, y: 10 }, { x: 24, y: 10 }],
  }),
  'tidal-drift': genArea({
    id: 'tidal-drift', biome: 'hoenn-beaches', w: 35, h: 20,
    spawn: { x: 1, y: 10 },
    exits: [{ x: 0, y: 10, to: 'cerulean-deep' }, { x: 34, y: 10, to: 'ember-peak' }],
    grass: [{ x: 15, y: 5, r: 3 }, { x: 25, y: 15, r: 4 }],
    path: [{ x: 0, y: 10 }, { x: 34, y: 10 }],
  }),
  'ember-peak': genArea({
    id: 'ember-peak', biome: 'alola-islands', w: 25, h: 25,
    spawn: { x: 12, y: 12 },
    buildings: [{ x: 12, y: 4, kind: 'gym', gymId: 'ember-gym' }, { x: 5, y: 10, kind: 'center' }, { x: 19, y: 10, kind: 'shop' }],
    npcs: [{ x: 10, y: 14, id: 'ember-vendor' }, { x: 14, y: 8, id: 'ash-watcher' }],
    exits: [{ x: 0, y: 12, to: 'tidal-drift' }, { x: 12, y: 0, to: 'scorched-ascent' }],
    path: [{ x: 0, y: 12 }, { x: 12, y: 12 }, { x: 12, y: 4 }, { x: 5, y: 10 }, { x: 19, y: 10 }, { x: 12, y: 12 }, { x: 12, y: 0 }],
  }),
  'scorched-ascent': genArea({
    id: 'scorched-ascent', biome: 'alola-islands', w: 30, h: 30,
    spawn: { x: 15, y: 28 },
    exits: [{ x: 15, y: 29, to: 'ember-peak' }, { x: 15, y: 0, to: 'voltspire' }],
    grass: [{ x: 8, y: 20, r: 4 }, { x: 22, y: 15, r: 4 }, { x: 8, y: 8, r: 4 }],
    path: [{ x: 15, y: 29 }, { x: 15, y: 25 }, { x: 5, y: 25 }, { x: 5, y: 15 }, { x: 25, y: 15 }, { x: 25, y: 5 }, { x: 15, y: 5 }, { x: 15, y: 0 }],
  }),
  'voltspire': genArea({
    id: 'voltspire', biome: 'unova-urban', w: 25, h: 20,
    spawn: { x: 12, y: 10 },
    buildings: [{ x: 12, y: 4, kind: 'gym', gymId: 'voltspire-gym' }, { x: 5, y: 14, kind: 'center' }, { x: 19, y: 14, kind: 'shop' }],
    npcs: [{ x: 10, y: 8, id: 'voltspire-tech' }, { x: 15, y: 8, id: 'spark-urchin' }],
    exits: [{ x: 12, y: 19, to: 'scorched-ascent' }, { x: 24, y: 10, to: 'circuit-way' }],
    path: [{ x: 12, y: 19 }, { x: 12, y: 10 }, { x: 12, y: 4 }, { x: 5, y: 14 }, { x: 19, y: 14 }, { x: 12, y: 10 }, { x: 24, y: 10 }],
  }),
  'circuit-way': genArea({
    id: 'circuit-way', biome: 'unova-urban', w: 40, h: 15,
    spawn: { x: 1, y: 7 },
    exits: [{ x: 0, y: 7, to: 'voltspire' }, { x: 39, y: 7, to: 'mindweave' }],
    grass: [{ x: 10, y: 4, r: 2.5 }, { x: 20, y: 11, r: 3 }, { x: 30, y: 3, r: 2.5 }],
    path: [{ x: 0, y: 7 }, { x: 39, y: 7 }],
  }),
  'mindweave': genArea({
    id: 'mindweave', biome: 'kalos-gardens', w: 25, h: 25,
    spawn: { x: 12, y: 12 },
    buildings: [{ x: 12, y: 4, kind: 'gym', gymId: 'mindweave-gym' }, { x: 6, y: 18, kind: 'center' }, { x: 18, y: 18, kind: 'shop' }],
    npcs: [{ x: 12, y: 9, id: 'mindweave-sage' }, { x: 15, y: 14, id: 'meditator' }],
    exits: [{ x: 0, y: 12, to: 'circuit-way' }, { x: 24, y: 12, to: 'thought-garden' }],
    path: [{ x: 0, y: 12 }, { x: 12, y: 12 }, { x: 12, y: 4 }, { x: 6, y: 18 }, { x: 18, y: 18 }, { x: 12, y: 12 }, { x: 24, y: 12 }],
  }),
  'thought-garden': genArea({
    id: 'thought-garden', biome: 'kalos-gardens', w: 35, h: 25,
    spawn: { x: 1, y: 12 },
    exits: [{ x: 0, y: 12, to: 'mindweave' }, { x: 17, y: 0, to: 'frostfell' }],
    grass: [{ x: 10, y: 18, r: 4 }, { x: 25, y: 15, r: 4 }, { x: 18, y: 8, r: 3 }],
    path: [{ x: 0, y: 12 }, { x: 17, y: 12 }, { x: 17, y: 20 }, { x: 30, y: 20 }, { x: 30, y: 5 }, { x: 17, y: 5 }, { x: 17, y: 0 }],
  }),
  'frostfell': genArea({
    id: 'frostfell', biome: 'sinnoh-tundra', w: 25, h: 20,
    spawn: { x: 12, y: 10 },
    buildings: [{ x: 12, y: 4, kind: 'gym', gymId: 'frostfell-gym' }, { x: 6, y: 14, kind: 'center' }, { x: 18, y: 14, kind: 'shop' }],
    npcs: [{ x: 9, y: 10, id: 'frostfell-butler' }, { x: 15, y: 10, id: 'frost-scout' }],
    exits: [{ x: 12, y: 19, to: 'thought-garden' }, { x: 24, y: 10, to: 'glacier-pass' }],
    path: [{ x: 12, y: 19 }, { x: 12, y: 10 }, { x: 12, y: 4 }, { x: 6, y: 14 }, { x: 18, y: 14 }, { x: 12, y: 10 }, { x: 24, y: 10 }],
  }),
  'glacier-pass': genArea({
    id: 'glacier-pass', biome: 'sinnoh-tundra', w: 35, h: 20,
    spawn: { x: 1, y: 10 },
    exits: [{ x: 0, y: 10, to: 'frostfell' }, { x: 34, y: 10, to: 'drakemaw' }],
    grass: [{ x: 12, y: 5, r: 3 }, { x: 22, y: 15, r: 4 }],
    path: [{ x: 0, y: 10 }, { x: 15, y: 10 }, { x: 15, y: 5 }, { x: 25, y: 5 }, { x: 25, y: 15 }, { x: 30, y: 15 }, { x: 30, y: 10 }, { x: 34, y: 10 }],
  }),
  'drakemaw': genArea({
    id: 'drakemaw', biome: 'paldea-wilds', w: 25, h: 25,
    spawn: { x: 12, y: 12 },
    buildings: [{ x: 12, y: 4, kind: 'gym', gymId: 'drakemaw-gym' }, { x: 5, y: 18, kind: 'center' }, { x: 19, y: 18, kind: 'shop' }],
    npcs: [{ x: 10, y: 10, id: 'drakemaw-vet' }, { x: 15, y: 15, id: 'dragon-whisperer' }],
    exits: [{ x: 0, y: 12, to: 'glacier-pass' }, { x: 24, y: 12, to: 'draconian-trail' }],
    path: [{ x: 0, y: 12 }, { x: 12, y: 12 }, { x: 12, y: 4 }, { x: 5, y: 18 }, { x: 19, y: 18 }, { x: 12, y: 12 }, { x: 24, y: 12 }],
  }),
  'draconian-trail': genArea({
    id: 'draconian-trail', biome: 'paldea-wilds', w: 45, h: 25,
    spawn: { x: 1, y: 12 },
    exits: [{ x: 0, y: 12, to: 'drakemaw' }, { x: 44, y: 12, to: 'shadowmere' }],
    grass: [{ x: 10, y: 5, r: 4 }, { x: 20, y: 18, r: 5 }, { x: 35, y: 10, r: 5 }],
    path: [{ x: 0, y: 12 }, { x: 22, y: 12 }, { x: 22, y: 5 }, { x: 35, y: 5 }, { x: 35, y: 18 }, { x: 40, y: 18 }, { x: 40, y: 12 }, { x: 44, y: 12 }],
  }),
  'shadowmere': genArea({
    id: 'shadowmere', biome: 'galar-countryside', w: 30, h: 30,
    spawn: { x: 15, y: 15 },
    buildings: [{ x: 15, y: 5, kind: 'gym', gymId: 'shadowmere-gym' }, { x: 8, y: 22, kind: 'center' }, { x: 22, y: 22, kind: 'shop' }],
    npcs: [{ x: 12, y: 12, id: 'shadowmere-sentinel' }, { x: 18, y: 18, id: 'lost-soul' }],
    exits: [{ x: 0, y: 15, to: 'draconian-trail' }],
    path: [{ x: 0, y: 15 }, { x: 15, y: 15 }, { x: 15, y: 5 }, { x: 8, y: 22 }, { x: 22, y: 22 }, { x: 15, y: 15 }],
  }),
};
