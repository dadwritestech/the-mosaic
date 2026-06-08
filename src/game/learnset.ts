import * as Sim from 'pokemon-showdown';

function rawLearnset(species: string): Record<string, string[]> {
  const dex = (Sim.Dex as any).forGen(9);
  const id = dex.species.get(species).id;
  return dex.species.getLearnsetData(id)?.learnset ?? {};
}

/** Moves a species learns by level-up at exactly `level` (Gen 9 `9L<level>` tags). */
export function levelUpMovesAt(species: string, level: number): string[] {
  const ls = rawLearnset(species);
  const out: string[] = [];
  for (const [moveId, tags] of Object.entries(ls)) {
    if (tags.some((t) => t === `9L${level}`)) out.push(moveId);
  }
  return out;
}

export function levelUpMovesBetween(species: string, from: number, to: number): { level: number; moveId: string }[] {
  const out: { level: number; moveId: string }[] = [];
  for (let l = from + 1; l <= to; l++) for (const moveId of levelUpMovesAt(species, l)) out.push({ level: l, moveId });
  return out;
}

/**
 * A wild Pokémon's natural moveset: the most recent (up to 4) distinct moves it
 * would know by `level` via level-up, exactly as the games trim to the last 4.
 * Deterministic. Falls back to Tackle if the species has no level-up data.
 */
export function wildMoveset(species: string, level: number): string[] {
  // from = -1 so level-0/1 (evolution/base) moves are included.
  const learned = levelUpMovesBetween(species, -1, level).map((m) => m.moveId);
  const recent: string[] = [];
  // Walk newest-first, keep the latest occurrence of each move, cap at 4.
  for (let i = learned.length - 1; i >= 0 && recent.length < 4; i--) {
    if (!recent.includes(learned[i])) recent.push(learned[i]);
  }
  return recent.length ? recent : ['tackle'];
}
