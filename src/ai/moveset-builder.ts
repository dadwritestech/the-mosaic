import * as Sim from 'pokemon-showdown';
import type { BaseTier } from './difficulty-controller';

interface MoveLite { id: string; category: string; basePower: number; type: string; }

function poolMoves(gen: number, speciesId: string): MoveLite[] {
  const dex = (Sim.Dex as any).forGen(gen);
  const ids: string[] = Array.from(dex.species.getMovePool(speciesId));
  return ids.map((id) => {
    const m = dex.moves.get(id);
    return { id, category: m.category, basePower: m.basePower, type: m.type };
  });
}

/**
 * Up to 4 moves, tier-scaled. Hard = the strongest damaging coverage (distinct
 * types) + a utility move. Easy = weaker damaging moves. Always >=1 damaging move.
 * Deterministic: sorts by basePower, no RNG.
 */
export function buildMoveset(gen: number, speciesId: string, tier: BaseTier): string[] {
  const all = poolMoves(gen, speciesId);
  const damaging = all.filter((m) => m.category !== 'Status' && m.basePower > 0)
    .sort((a, b) => b.basePower - a.basePower);
  const status = all.filter((m) => m.category === 'Status').map((m) => m.id);

  if (damaging.length === 0) return all.slice(0, 4).map((m) => m.id); // pathological fallback

  // Tier selects the slice of damaging moves to draw from.
  const ranked = tier === 'hard' ? damaging
    : tier === 'normal' ? damaging.slice(Math.floor(damaging.length * 0.15))
    : damaging.slice(Math.floor(damaging.length * 0.5)); // easy = weaker half

  // Pick distinct-type coverage from the ranked list.
  const picked: string[] = [];
  const seenTypes = new Set<string>();
  for (const m of ranked) {
    if (seenTypes.has(m.type)) continue;
    picked.push(m.id); seenTypes.add(m.type);
    if (picked.length >= (tier === 'hard' ? 3 : 4)) break;
  }
  // Top up with next-best damaging if coverage was thin.
  for (const m of ranked) { if (picked.length >= 4) break; if (!picked.includes(m.id)) picked.push(m.id); }
  // Hard tier gets one utility/status move if room remains.
  if (tier === 'hard' && picked.length < 4 && status.length) picked.push(status[0]);

  return picked.slice(0, 4);
}
