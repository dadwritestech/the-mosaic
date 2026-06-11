import * as Sim from 'pokemon-showdown';
import type { GameState, RiftStatus } from './types';
import type { Biome, RiftDef, EncounterTable, TimeBucket } from '../content/types';
import { BIOME_GEN, speciesGeneration } from './generations';
import { pushMeter } from './story';

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

export const SEAL_DELTA = 16;       // toward Reset (negative)
export const ATTUNE_DELTA = 16;     // toward Embrace (positive)

function addressed(state: GameState, riftId: string): boolean {
  return riftStatus(state, riftId) !== 'unsealed';
}

export function sealRift(state: GameState, rift: RiftDef): GameState {
  if (addressed(state, rift.id)) return state;
  const biome = sealDirectionBiome(rift, state.party as { species: string }[]);
  const pushed = pushMeter(state, -SEAL_DELTA);
  return { ...pushed, riftStates: { ...pushed.riftStates, [rift.id]: { status: 'sealed', biome } } };
}

export function attuneRift(state: GameState, rift: RiftDef): GameState {
  if (addressed(state, rift.id)) return state;
  const pushed = pushMeter(state, +ATTUNE_DELTA);
  return { ...pushed, riftStates: { ...pushed.riftStates, [rift.id]: { status: 'attuned' } } };
}

export const ATTUNE_LEVEL_BUMP = 4;

function bumpLevels(table: EncounterTable, by: number): EncounterTable {
  const out: EncounterTable = {};
  for (const bucket of Object.keys(table) as TimeBucket[]) {
    const list = table[bucket];
    if (!list) continue;
    out[bucket] = list.map((e) => ({ ...e, minLevel: e.minLevel + by, maxLevel: e.maxLevel + by }));
  }
  return out;
}

/** The encounter table a rift's zone yields in its current state. */
export function zoneEncounters(state: GameState, rift: RiftDef): EncounterTable {
  const st = state.riftStates[rift.id];
  if (!st || st.status === 'unsealed') return rift.fusedEncounters;
  if (st.status === 'attuned') return bumpLevels(rift.fusedEncounters, ATTUNE_LEVEL_BUMP);
  return st.biome === rift.biomeA ? rift.pureEncountersA : rift.pureEncountersB;
}
