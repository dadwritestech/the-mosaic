import type { BattleState, Side, TeamSpec } from '../bridge/types';
import type { BattleView, MoveOption, ActiveView } from './types';

function activeView(species: string, hpPercent: number, status: string, team: TeamSpec): ActiveView {
  const set = team.find((s) => s.species === species) ?? team[0];
  return { set, hpPercent, status };
}

export function buildView(
  aiSide: Side,
  state: BattleState,
  aiTeam: TeamSpec,
  oppTeam: TeamSpec,
  moves: MoveOption[],
  switchIndices: number[],
): BattleView {
  const oppSide: Side = aiSide === 'p1' ? 'p2' : 'p1';
  const selfActive = state.active[aiSide]!;
  const oppActive = state.active[oppSide]!;
  const selfView = activeView(selfActive.species, selfActive.hpPercent, selfActive.status, aiTeam);
  const bench = aiTeam
    .filter((s) => s.species !== selfActive.species)
    .map((s) => ({ set: s, hpPercent: 100, status: '' } as ActiveView));
  return {
    self: selfView,
    selfBench: bench,
    opponent: activeView(oppActive.species, oppActive.hpPercent, oppActive.status, oppTeam),
    moves,
    switchIndices,
  };
}
