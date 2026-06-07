import { updateTendency, type PlayerModel, type TendencyName } from './player-model';
import { reputationLevel, deriveNotableTraits } from './reputation';

export interface BattleSummary {
  outcome: 'win' | 'loss';     // player's perspective
  attackRatio: number;         // fraction of player turns spent attacking -> aggression
  switchRatio: number;         // fraction of player turns spent switching -> switchiness
  statusRatio: number;         // fraction of player moves that were status -> statusUsage
  superEffectiveRatio: number; // fraction of damaging moves that were SE -> typeReliance
  sacrificeRatio: number;      // fraction of faints that were avoidable sacks -> sacrificeWillingness
  leadSpecies: string;         // -> leadPattern (cross-battle consistency)
  teamSpecies: string[];       // -> rosterStability (cross-battle overlap)
  badgesAtTime?: number;
  trainerId?: string;          // present for recurring characters (rival, gym leaders)
}

export interface ObserveOpts { globalRate?: number; characterRate?: number; }

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a), B = new Set(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 1 : inter / union;
}

export function observeBattle(model: PlayerModel, s: BattleSummary, opts: ObserveOpts = {}): PlayerModel {
  const rate = opts.globalRate ?? 0.15;
  const upd = (name: TendencyName, observed: number) => {
    model.tendencies[name] = updateTendency(model.tendencies[name], observed, rate);
  };

  upd('aggression', s.attackRatio);
  upd('switchiness', s.switchRatio);
  upd('statusUsage', s.statusRatio);
  upd('typeReliance', s.superEffectiveRatio);
  upd('sacrificeWillingness', s.sacrificeRatio);

  // leadPattern: how repetitive the player's lead is so far.
  model._leadCounts[s.leadSpecies] = (model._leadCounts[s.leadSpecies] ?? 0) + 1;
  const maxLead = Math.max(...Object.values(model._leadCounts));
  upd('leadPattern', maxLead / (model.battlesObserved + 1));

  // rosterStability: overlap with the previous battle's team (1 = identical).
  if (model._lastTeam) upd('rosterStability', jaccard(model._lastTeam, s.teamSpecies));
  model._lastTeam = s.teamSpecies.slice();

  // Per-character memory updates sharper (the "personal grudge" reacts faster).
  if (s.trainerId) {
    const prev = model.characters[s.trainerId];
    model.characters[s.trainerId] = {
      encounters: (prev?.encounters ?? 0) + 1,
      lastOutcome: s.outcome,
      lastTeam: s.teamSpecies.slice(),
    };
  }

  model.battlesObserved += 1;

  // Reputation: grows on wins (small bump on losses for sheer notoriety).
  model.reputation.score += s.outcome === 'win' ? 1 : 0.2;
  model.reputation.level = reputationLevel(model.reputation.score, s.badgesAtTime ?? 0);
  model.reputation.notableTraits = deriveNotableTraits(model.tendencies);

  return model;
}
