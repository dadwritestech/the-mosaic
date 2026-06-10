import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { MapV2, Warp } from './mapv2';

const cache = new Map<string, MapV2>();

function mapPath(id: string): string {
  return join(process.cwd(), 'web/public/maps', `${id}.json`);
}

export function hasMapV2(id: string): boolean {
  return existsSync(mapPath(id));
}

export function loadMapV2(id: string): MapV2 {
  if (!cache.has(id)) {
    cache.set(id, JSON.parse(readFileSync(mapPath(id), 'utf8')) as MapV2);
  }
  return cache.get(id)!;
}

export function warpAt(m: MapV2, x: number, y: number): Warp | null {
  return m.warps.find((w) => w.x === x && w.y === y) ?? null;
}

export function encounterAt(m: MapV2, x: number, y: number): boolean {
  return !!m.encounters[y]?.[x];
}

export function walkableAt(m: MapV2, x: number, y: number): boolean {
  return y >= 0 && y < m.height && x >= 0 && x < m.width && !!m.passages[y]?.[x];
}
