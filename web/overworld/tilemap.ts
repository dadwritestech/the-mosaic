export type Tile = 'field' | 'floor' | 'grass' | 'wall' | 'exit' | 'gym' | 'npc' | 'center' | 'shop';
export interface TileMeta { exitTo?: string; gymId?: string; npcId?: string; }
export interface TileMap { id: string; tiles: Tile[][]; spawn: { x: number; y: number }; meta: Record<string, TileMeta>; biome: string; }

export function tileAt(m: TileMap, x: number, y: number): Tile {
  if (y < 0 || y >= m.tiles.length || x < 0 || x >= m.tiles[0].length) return 'wall';
  return m.tiles[y][x];
}
export function isWalkable(m: TileMap, x: number, y: number): boolean { return tileAt(m, x, y) !== 'wall'; }
export function metaAt(m: TileMap, x: number, y: number): TileMeta { return m.meta[`${x},${y}`] ?? {}; }
