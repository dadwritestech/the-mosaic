import type { Entry } from './run';

// Arc-1 location -> Essentials demo map, with door-warp links (RMXP map id -> our location id).
// Lerucean Town (23) has a Poke Center (24) and Mart (25) as separate interior maps with
// TransferPlayer door events — ideal for proving the town<->interior warp loop.
export const ARC1_MANIFEST: Record<string, Entry> = {
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
