import { genArea } from './slice';
import type { TileMap } from '../tilemap';
import { ALL_RIFTS } from '../../../src/content/rifts';
import type { RiftDef } from '../../../src/content/types';

// The Mosaic region: a hand-laid journey, not a bare corridor. The path runs
//   Aethel's Rest (start town) → Rift 1 → Town → Rift 2 → Town → … → Rift 7 → World Core
// Towns (Center + Mart + townsfolk) sit between every rift so you can heal and
// shop before each Warden. Rift routes carry their rift's wild encounters + Warden.

export const HUB_ID = 'mosaic-hub';
export const CORE_ID = 'world-core';
const riftZoneId = (id: string) => `rift-${id}`;

// Six towns, one after each of the first six rifts (the seventh rift opens the Core).
const TOWN_IDS = ['verdant-hollow', 'tidehaven', 'cinderport', 'neon-junction', 'petalbourne', 'frosthold'];

export const ZONE_MAPS: Record<string, TileMap> = {};
/** zone id -> rift id, for resolving wild encounters from the rift tables. */
export const ZONE_RIFT: Record<string, string> = {};

// chain[0]=hub, then rift,town,rift,town,…,rift,CORE
const chain: string[] = [HUB_ID];
ALL_RIFTS.forEach((r, i) => {
  chain.push(riftZoneId(r.id));
  chain.push(i < ALL_RIFTS.length - 1 ? TOWN_IDS[i] : CORE_ID);
});

// ── builders ──────────────────────────────────────────────────────────────

// A town: Center + Mart + a couple of houses + townsfolk, road running west→east.
function town(id: string, biome: string, prev: string, next: string): TileMap {
  return genArea({
    id, biome, w: 24, h: 15, spawn: { x: 2, y: 8 },
    buildings: [
      { x: 6, y: 4, kind: 'center' },
      { x: 16, y: 4, kind: 'shop' },
    ],
    npcs: [
      { x: 9, y: 7, id: 'townsfolk' },
      { x: 13, y: 10, id: 'townsfolk' },
      { x: 19, y: 6, id: 'townsfolk' },
    ],
    exits: [{ x: 0, y: 8, to: prev }, { x: 23, y: 8, to: next }],
    path: [{ x: 0, y: 8 }, { x: 23, y: 8 }],
  });
}

// The starting town: Aethel's Rest — Center, Mart, and the professor.
function startTown(next: string): TileMap {
  return genArea({
    id: HUB_ID, biome: 'kanto-plains', w: 22, h: 14, spawn: { x: 11, y: 10 },
    buildings: [
      { x: 6, y: 4, kind: 'center' },
      { x: 15, y: 4, kind: 'shop' },
    ],
    npcs: [
      { x: 11, y: 6, id: 'aethel' },
      { x: 7, y: 9, id: 'townsfolk' },
      { x: 15, y: 9, id: 'townsfolk' },
    ],
    exits: [{ x: 21, y: 7, to: next }],
    path: [{ x: 11, y: 10 }, { x: 11, y: 6 }, { x: 21, y: 7 }],
  });
}

// A rift route: grass encounters, then the Warden guarding the exit, west→east.
function riftZone(rift: RiftDef, prev: string, next: string): TileMap {
  const id = riftZoneId(rift.id);
  ZONE_RIFT[id] = rift.id;
  return genArea({
    id, biome: rift.biomeA, w: 26, h: 13, spawn: { x: 1, y: 6 },
    exits: [{ x: 0, y: 6, to: prev }, { x: 25, y: 6, to: next }],
    grass: [{ x: 8, y: 5, r: 2.6 }, { x: 13, y: 8, r: 2.6 }, { x: 18, y: 5, r: 2.2 }],
    npcs: [{ x: 22, y: 6, id: `warden:${rift.id}` }],
    path: [{ x: 0, y: 6 }, { x: 25, y: 6 }],
  });
}

// The World Core — the destination (ending wires up in a later milestone).
function coreZone(prev: string): TileMap {
  return genArea({
    id: CORE_ID, biome: 'paldea-wilds', w: 18, h: 14, spawn: { x: 1, y: 7 },
    npcs: [{ x: 13, y: 7, id: 'core' }],
    exits: [{ x: 0, y: 7, to: prev }],
    path: [{ x: 1, y: 7 }, { x: 13, y: 7 }],
  });
}

// ── assemble the chain ──────────────────────────────────────────────────────

ZONE_MAPS[HUB_ID] = startTown(chain[1]);
ALL_RIFTS.forEach((rift) => {
  const id = riftZoneId(rift.id);
  const i = chain.indexOf(id);
  ZONE_MAPS[id] = riftZone(rift, chain[i - 1], chain[i + 1]);
});
TOWN_IDS.forEach((tid, i) => {
  const idx = chain.indexOf(tid);
  ZONE_MAPS[tid] = town(tid, ALL_RIFTS[i].biomeB, chain[idx - 1], chain[idx + 1]);
});
ZONE_MAPS[CORE_ID] = coreZone(chain[chain.indexOf(CORE_ID) - 1]);

export const ZONE_CHAIN = chain;
