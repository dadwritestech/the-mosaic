import type { Entry } from './run';

// Arc-1 location -> Essentials demo map, with door-warp links (RMXP map id -> our location id).
// Lerucean Town (23) has a Poke Center (24) and Mart (25) as separate interior maps with
// TransferPlayer door events — ideal for proving the town<->interior warp loop.
export const ARC1_MANIFEST: Record<string, Entry> = {
  // Start town: Lappet Town (2) + its interiors (Player's house 3, Lab 4, neighbour 8).
  'aethels-rest': {
    mapNo: 2, spawn: { x: 16, y: 18 },
    mapIdToLocation: { 3: 'aethels-house', 4: 'aethels-lab', 8: 'aethels-house2' },
  },
  'aethels-house': { mapNo: 3, spawn: { x: 3, y: 9 }, mapIdToLocation: { 2: 'aethels-rest' } },
  'aethels-lab': { mapNo: 4, spawn: { x: 6, y: 13 }, mapIdToLocation: { 2: 'aethels-rest' } },
  'aethels-house2': { mapNo: 8, spawn: { x: 3, y: 9 }, mapIdToLocation: { 2: 'aethels-rest' } },

  'cerulean-deep': {
    mapNo: 23, spawn: { x: 13, y: 18 },
    mapIdToLocation: { 24: 'cerulean-deep-center', 25: 'cerulean-deep-mart' },
  },
  'cerulean-deep-center': {
    mapNo: 24, spawn: { x: 4, y: 8 },
    mapIdToLocation: { 23: 'cerulean-deep' },
  },
  'cerulean-deep-mart': {
    mapNo: 25, spawn: { x: 4, y: 8 },
    mapIdToLocation: { 23: 'cerulean-deep' },
  },
};
