import type { GameState, OwnedPokemon } from '../types';
import { getItem } from './catalog';
import { setHp, addEvs } from '../owned-pokemon';
import { maxHp } from '../stats';
import { restorePp, maxPp } from '../pp';
import { evolutionFor, evolve } from '../evolution';
import { teachMove } from '../tm';

export interface ItemUseResult { ok: boolean; reason?: string; evolvedInto?: string; }

function replaceMon(state: GameState, uid: string, fn: (m: OwnedPokemon) => { mon: OwnedPokemon; result: ItemUseResult }): { state: GameState; result: ItemUseResult } {
  const idx = state.party.findIndex((m) => m.uid === uid);
  if (idx < 0) return { state, result: { ok: false, reason: 'target not in party' } };
  const { mon, result } = fn(state.party[idx]);
  if (!result.ok) return { state, result };
  const party = state.party.slice(); party[idx] = mon;
  return { state: { ...state, party }, result };
}

export function applyItem(state: GameState, itemId: string, targetUid?: string, moveIndex?: number): { state: GameState; result: ItemUseResult } {
  const def = getItem(itemId);
  const e = def.effect;

  // State-level effects (no target mon).
  if (e.kind === 'repel') return { state: { ...state, flags: { ...state.flags, repelSteps: e.steps } }, result: { ok: true } };
  if (e.kind === 'escapeRope') return { state: { ...state, flags: { ...state.flags, escapeRope: true } }, result: { ok: true } };
  if (e.kind === 'ball') return { state, result: { ok: false, reason: 'balls are used via the battle catch action' } };

  if (!targetUid) return { state, result: { ok: false, reason: 'target required' } };

  return replaceMon(state, targetUid, (mon) => {
    switch (e.kind) {
      case 'heal': {
        if (mon.currentHp <= 0) return { mon, result: { ok: false, reason: 'fainted; use Revive' } };
        const max = maxHp(mon);
        if (mon.currentHp >= max) return { mon, result: { ok: false, reason: 'already full' } };
        const amt = e.amount === 'full' ? max : e.amount;
        return { mon: setHp(mon, mon.currentHp + amt), result: { ok: true } };
      }
      case 'cure': {
        if (!mon.status) return { mon, result: { ok: false, reason: 'no status' } };
        if (e.status !== 'all' && mon.status !== e.status && !(e.status === 'psn' && mon.status === 'tox')) return { mon, result: { ok: false, reason: 'status mismatch' } };
        return { mon: { ...mon, status: '' }, result: { ok: true } };
      }
      case 'revive': {
        if (mon.currentHp > 0) return { mon, result: { ok: false, reason: 'not fainted' } };
        return { mon: setHp(mon, Math.round(maxHp(mon) * e.fraction)), result: { ok: true } };
      }
      case 'ev': {
        const after = addEvs(mon, { [e.stat]: e.amount } as any);
        if (after.evs[e.stat] === mon.evs[e.stat]) return { mon, result: { ok: false, reason: 'no EV change (capped)' } };
        return { mon: after, result: { ok: true } };
      }
      case 'pp': {
        if (e.mode === 'restoreAll') return { mon: restorePp(mon), result: { ok: true } };
        if (e.mode === 'up') {
          const m0 = mon.moves[moveIndex ?? 0]; if (!m0 || m0.ppUps >= 3) return { mon, result: { ok: false, reason: 'max PP ups' } };
          const moves = mon.moves.slice(); moves[moveIndex ?? 0] = { ...m0, ppUps: m0.ppUps + 1 };
          return { mon: { ...mon, moves }, result: { ok: true } };
        }
        const i = moveIndex ?? 0; const mv = mon.moves[i];
        if (!mv || mv.pp >= maxPp(mv)) return { mon, result: { ok: false, reason: 'PP already full' } };
        const moves = mon.moves.slice(); moves[i] = { ...mv, pp: Math.min(maxPp(mv), mv.pp + (e.amount ?? 10)) };
        return { mon: { ...mon, moves }, result: { ok: true } };
      }
      case 'evoStone': {
        const into = evolutionFor(mon, { kind: 'item', item: e.stone });
        if (!into) return { mon, result: { ok: false, reason: 'no effect' } };
        return { mon: evolve(mon, into), result: { ok: true, evolvedInto: into } };
      }
      case 'tm': {
        const { mon: taught, result } = teachMove(mon, e.move, moveIndex);
        return { mon: taught, result: { ok: result.ok, reason: result.reason } };
      }
      default:
        return { mon, result: { ok: false, reason: 'unhandled effect' } };
    }
  });
}
