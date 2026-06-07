import type { Action } from '../bridge/types';
import type { BattleView, BrainContext, MoveOption, ActiveView } from './types';
import { evaluateMove } from './calc-evaluator';

interface Scored { action: Action; score: number; }

// Best expected damage% the `attacker` view can do to the `defender` view this turn,
// across the attacker's own moveset. Used for matchup + self-risk lookahead.
function bestOutgoing(view: BattleView, ctx: BrainContext, attacker: ActiveView, defender: ActiveView): number {
  let best = 0;
  for (const moveName of attacker.set.moves) {
    const e = evaluateMove(ctx.gen, attacker, defender, moveName);
    const val = e.avgDamagePercent + e.koThisTurnChance * 1000;
    if (val > best) best = val;
  }
  return best;
}

function scoreMove(view: BattleView, ctx: BrainContext, move: MoveOption): number {
  const e = evaluateMove(ctx.gen, view.self, view.opponent, move.name);
  let score = e.avgDamagePercent * ctx.personality.aggression;
  score += e.koThisTurnChance * 1000;
  // Shallow lookahead: subtract the opponent's best retaliation against us (self-risk).
  if (ctx.knobs.lookaheadDepth >= 1) {
    const risk = bestOutgoing(view, ctx, view.opponent, view.self);
    score -= risk * ctx.personality.caution * 0.5;
  }
  return score;
}

// Score a switch: value of the incoming mon's matchup minus the free hit we take
// coming in. Scaled by switchSmarts so it can be tuned/disabled per difficulty.
function scoreSwitch(view: BattleView, ctx: BrainContext, benchIdx: number, switchSlot: number): number {
  const incoming = view.selfBench[benchIdx];
  const ourOffense = bestOutgoing(view, ctx, incoming, view.opponent);
  const incomingRisk = bestOutgoing(view, ctx, view.opponent, incoming);
  const matchup = ourOffense - incomingRisk;
  return matchup * ctx.knobs.switchSmarts;
}

export function chooseAction(view: BattleView, ctx: BrainContext): Action {
  const candidates: Scored[] = view.moves.map((m) => ({
    action: { kind: 'move', index: m.index } as Action,
    score: scoreMove(view, ctx, m),
  }));

  const slots = view.switchIndices ?? [];
  slots.forEach((slot, i) => {
    if (i < view.selfBench.length && ctx.knobs.switchSmarts > 0) {
      candidates.push({
        action: { kind: 'switch', index: slot } as Action,
        score: scoreSwitch(view, ctx, i, slot),
      });
    }
  });

  if (ctx.rng() < ctx.knobs.randomness) {
    const pick = candidates[Math.floor(ctx.rng() * candidates.length)];
    return pick.action;
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].action;
}
