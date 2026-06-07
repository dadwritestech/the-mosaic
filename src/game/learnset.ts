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
