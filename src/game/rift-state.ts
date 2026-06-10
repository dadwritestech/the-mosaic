import * as Sim from 'pokemon-showdown';
import type { GameState, RiftStatus } from './types';
import type { Biome, RiftDef } from '../content/types';
import { BIOME_GEN, speciesGeneration } from './generations';

const DEX = (Sim.Dex as any).forGen(9);
function genOf(species: string): number {
  const sp = DEX.species.get(species);
  return sp && sp.exists ? speciesGeneration(sp.num) : 0;
}

export function riftStatus(state: GameState, riftId: string): RiftStatus {
  return state.riftStates[riftId]?.status ?? 'unsealed';
}

export function riftsAddressedCount(state: GameState): number {
  return Object.values(state.riftStates).filter((r) => r.status !== 'unsealed').length;
}

/** 'new' iff the party has at least as many Gen-5+ mons as Gen-4-and-below. */
export function partyGenLean(party: { species: string }[]): 'new' | 'old' {
  let newLean = 0, oldLean = 0;
  for (const p of party) { const g = genOf(p.species); if (g >= 5) newLean++; else if (g >= 1) oldLean++; }
  return newLean >= oldLean ? 'new' : 'old';
}

/** Which of the rift's two regions survives a seal, by the team's gen lean. */
export function sealDirectionBiome(rift: RiftDef, party: { species: string }[]): Biome {
  const lean = partyGenLean(party);
  const a = rift.biomeA, b = rift.biomeB;
  const higher = BIOME_GEN[a] >= BIOME_GEN[b] ? a : b;
  const lower = higher === a ? b : a;
  return lean === 'new' ? higher : lower;
}
