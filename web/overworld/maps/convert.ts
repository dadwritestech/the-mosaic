import type { RpgMap, RpgEvent } from './rmxp';
import type { RpgTileset } from './rmxp';
import type { MarshalValue } from './marshal';
import type { MapV2, Trigger } from './mapv2';

export interface ConvertOpts {
  id: string;
  spawn: { x: number; y: number };
  grassTerrainTag?: number;
  mapIdToLocation?: Record<number, string>;
}

const ivar = (o: MarshalValue, k: string): MarshalValue =>
  (o && typeof o === 'object' && 'ivars' in o) ? (o as { ivars: Record<string, MarshalValue> }).ivars[k] : undefined as unknown as MarshalValue;

function firstList(ev: RpgEvent): MarshalValue[] {
  const page = (ev.pages ?? [])[0];
  return (ivar(page, '@list') as MarshalValue[]) ?? [];
}

function transferOf(ev: RpgEvent): { toMapId: number; x: number; y: number } | null {
  for (const cmd of firstList(ev)) {
    if (ivar(cmd, '@code') === 201) {
      const p = ivar(cmd, '@parameters') as number[];
      return { toMapId: p[1], x: p[2], y: p[3] };
    }
  }
  return null;
}

function triggerKind(name: string): { kind: Trigger['kind']; ref?: string } {
  const n = name.toLowerCase();
  if (n.includes('mart')) return { kind: 'shop' };
  if (n.includes('center') || n.includes('pokecenter') || n.includes('nurse')) return { kind: 'center' };
  if (n.includes('gym') || n.includes('leader')) return { kind: 'gym' };
  if (n.includes('sign')) return { kind: 'sign' };
  return { kind: 'npc', ref: name };
}

export function convertMap(map: RpgMap, ts: RpgTileset, opts: ConvertOpts): MapV2 {
  const { width: w, height: h } = map;
  const grassTag = opts.grassTerrainTag ?? 1;
  const layers: number[][][] = [0, 1, 2].map((z) =>
    Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => map.data.at(x, y, z))));
  const top = (x: number, y: number) => layers[2][y][x] || layers[1][y][x] || layers[0][y][x];
  const passages = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => ts.passable(top(x, y))));
  const priorities = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => ts.priority(top(x, y))));
  const encounters = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => ts.terrainTag(top(x, y)) === grassTag));

  const warps: MapV2['warps'] = [];
  const triggers: MapV2['triggers'] = [];
  for (const ev of map.events) {
    const t = transferOf(ev);
    if (t) {
      const toMap = opts.mapIdToLocation?.[t.toMapId];
      if (toMap) warps.push({ x: ev.x, y: ev.y, toMap, toX: t.x, toY: t.y });
      continue;
    }
    if (ev.name) {
      const { kind, ref } = triggerKind(ev.name);
      triggers.push({ x: ev.x, y: ev.y, kind, ...(ref ? { ref } : {}) });
    }
  }

  return {
    id: opts.id, width: w, height: h,
    tileset: ts.tilesetName, autotiles: ts.autotileNames,
    layers, passages, priorities, encounters,
    warps, triggers,
    spawn: opts.spawn,
  };
}
