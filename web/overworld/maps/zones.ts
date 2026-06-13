import { genArea } from './slice';
import type { TileMap } from '../tilemap';
import { ALL_RIFTS } from '../../../src/content/rifts';

// The world spine: a linear journey from the hub town, through one zone per
// convergence rift, to the World Core. Each rift zone is a horizontal route
// (enter left, exit right) carrying that rift's wild encounters. Data-driven
// from ALL_RIFTS so the chain and the content stay in sync.

export const HUB_ID = 'mosaic-hub';
export const CORE_ID = 'world-core';
const riftZoneId = (id: string) => `rift-${id}`;

export const ZONE_MAPS: Record<string, TileMap> = {};
/** zone id -> rift id, for resolving wild encounters from the rift tables. */
export const ZONE_RIFT: Record<string, string> = {};

// chain[0]=hub, chain[1..7]=rift zones, chain[8]=core
const chain = [HUB_ID, ...ALL_RIFTS.map((r) => riftZoneId(r.id)), CORE_ID];

// Hub town — start of the journey: a Center, a Mart, and the road out.
ZONE_MAPS[HUB_ID] = genArea({
  id: HUB_ID, biome: 'kanto-plains', w: 20, h: 12, spawn: { x: 4, y: 6 },
  buildings: [{ x: 5, y: 3, kind: 'center' }, { x: 9, y: 3, kind: 'shop' }],
  npcs: [{ x: 7, y: 6, id: 'aethel' }],
  exits: [{ x: 19, y: 6, to: chain[1] }],
  path: [{ x: 4, y: 6 }, { x: 19, y: 6 }],
});

// One route per rift.
ALL_RIFTS.forEach((rift, i) => {
  const id = riftZoneId(rift.id);
  const prev = chain[i];       // zone before this rift
  const next = chain[i + 2];   // zone after this rift
  ZONE_MAPS[id] = genArea({
    id, biome: rift.biomeA, w: 24, h: 11, spawn: { x: 1, y: 5 },
    exits: [{ x: 0, y: 5, to: prev }, { x: 23, y: 5, to: next }],
    grass: [{ x: 8, y: 4, r: 2.4 }, { x: 14, y: 6, r: 2.4 }, { x: 18, y: 4, r: 1.8 }],
    // the rift Warden stands on the path before the exit — beat them to pass
    npcs: [{ x: 20, y: 5, id: `warden:${rift.id}` }],
    // a Center on every other route so healing is reachable
    buildings: i % 2 === 1 ? [{ x: 4, y: 3, kind: 'center' }] : undefined,
    path: [{ x: 0, y: 5 }, { x: 23, y: 5 }],
  });
  ZONE_RIFT[id] = rift.id;
});

// World Core — the destination (the ending wires up in a later milestone).
ZONE_MAPS[CORE_ID] = genArea({
  id: CORE_ID, biome: 'paldea-wilds', w: 16, h: 13, spawn: { x: 1, y: 6 },
  npcs: [{ x: 12, y: 6, id: 'core' }],
  exits: [{ x: 0, y: 6, to: chain[chain.length - 2] }],
  path: [{ x: 1, y: 6 }, { x: 12, y: 6 }],
});

export const ZONE_CHAIN = chain;
