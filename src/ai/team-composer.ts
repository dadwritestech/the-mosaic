import type { TeamSpec, PokemonSet } from '../bridge/types';
import type { BaseTier } from './difficulty-controller';
import { gymSpeciesPool, baseStatTotal, type SpeciesLite } from './species-pool';
import { buildMoveset } from './moveset-builder';

export interface TrainerDef {
  baseTier: BaseTier;
  teamSize: number;
  levelCap: number;
  gymType?: string;
}

export interface ComposeContext {
  gen: number;
  counterDraftStrength: number; // 0..1 — higher = prefer stronger mons (tougher tailored team)
  rng: () => number;
}

function pickWeighted(pool: SpeciesLite[], counter: number, rng: () => number): SpeciesLite {
  // weight = 1 + counter * (normalized BST). counter=0 -> uniform; counter=1 -> favor strong.
  const bsts = pool.map((s) => baseStatTotal(s.baseStats));
  const min = Math.min(...bsts), max = Math.max(...bsts);
  const span = max - min || 1;
  const weights = pool.map((s, i) => 1 + counter * 3 * ((bsts[i] - min) / span));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

const EVS_BY_TIER: Record<BaseTier, PokemonSet['evs']> = {
  easy:   { hp: 85, atk: 85, def: 85, spa: 85, spd: 85, spe: 85 },
  normal: { hp: 0, atk: 128, def: 64, spa: 128, spd: 64, spe: 128 },
  hard:   { hp: 0, atk: 252, def: 4, spa: 252, spd: 0, spe: 252 },
};

export function composeTeam(def: TrainerDef, ctx: ComposeContext): TeamSpec {
  const pool = gymSpeciesPool(ctx.gen, def.gymType);
  const chosen: SpeciesLite[] = [];
  const used = new Set<string>();
  let guard = 0;
  while (chosen.length < def.teamSize && guard++ < def.teamSize * 50 && used.size < pool.length) {
    const pick = pickWeighted(pool, ctx.counterDraftStrength, ctx.rng);
    if (used.has(pick.id)) continue;
    used.add(pick.id); chosen.push(pick);
  }

  const ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
  return chosen.map((s): PokemonSet => ({
    name: s.name,
    species: s.name,
    ability: s.ability,
    item: def.baseTier === 'hard' ? 'Leftovers' : '',
    moves: buildMoveset(ctx.gen, s.id, def.baseTier),
    nature: 'Hardy',
    evs: EVS_BY_TIER[def.baseTier],
    ivs,
    level: def.levelCap,
  }));
}
