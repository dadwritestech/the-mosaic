import type { Tendency, TendencyName } from './player-model';

export type ReputationLevel = 'Unknown' | 'Noticed' | 'Known' | 'Renowned' | 'Legendary';

export function reputationLevel(score: number, badges: number): ReputationLevel {
  const s = score + badges * 2;
  if (s >= 40) return 'Legendary';
  if (s >= 20) return 'Renowned';
  if (s >= 8) return 'Known';
  if (s >= 3) return 'Noticed';
  return 'Unknown';
}

const TRAIT_LABELS: Partial<Record<TendencyName, { high: string; low: string }>> = {
  typeReliance: { high: 'type-matchup specialist', low: 'unpredictable coverage' },
  statusUsage: { high: 'status spammer', low: 'rarely uses status' },
  aggression: { high: 'relentless attacker', low: 'defensive player' },
  switchiness: { high: 'constant pivoter', low: 'stands and fights' },
  rosterStability: { high: 'loyal to one team', low: 'ever-changing roster' },
};

/** Only confident (>=0.6) and extreme (<=0.2 or >=0.8) tendencies become traits. */
export function deriveNotableTraits(tendencies: Record<TendencyName, Tendency>): string[] {
  const out: string[] = [];
  for (const [name, t] of Object.entries(tendencies) as [TendencyName, Tendency][]) {
    const label = TRAIT_LABELS[name];
    if (!label || t.confidence < 0.6) continue;
    if (t.value >= 0.8) out.push(label.high);
    else if (t.value <= 0.2) out.push(label.low);
  }
  return out;
}
