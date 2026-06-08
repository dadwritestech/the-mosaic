import type { TileMap, Tile } from '../tilemap';

const CH: Record<string, Tile> = { '.': 'floor', g: 'grass', '#': 'wall', E: 'exit', Y: 'gym', N: 'npc', C: 'center', S: 'shop' };

function parse(id: string, biome: string, rows: string[], spawn: { x: number; y: number }, meta: Record<string, TileMap['meta'][string]>): TileMap {
  return { id, biome, tiles: rows.map((r) => [...r].map((c) => CH[c] ?? 'floor')), spawn, meta };
}

export const SLICE_MAPS: Record<string, TileMap> = {
  'aethels-rest': parse('aethels-rest', 'kanto-plains',
    ['#########', '#..C..S.#', '#..N....#', '#.......#', '#...E...#', '#########'],
    { x: 4, y: 3 }, { '4,4': { exitTo: 'whispering-path' }, '3,2': { npcId: 'aethel' } }),
  'whispering-path': parse('whispering-path', 'kanto-plains',
    ['###########', 'E...ggg...#', '#..ggggg..#', '#...ggg...E', '###########'],
    { x: 1, y: 1 }, { '0,1': { exitTo: 'aethels-rest' }, '10,3': { exitTo: 'verdant-hollow' } }),
  'verdant-hollow': parse('verdant-hollow', 'johto-forests',
    ['#########', '#...Y...#', '#..C.S..#', '#...E...#', '#########'],
    { x: 4, y: 3 }, { '4,3': { exitTo: 'whispering-path' }, '4,1': { gymId: 'verdant-gym' } }),
};
