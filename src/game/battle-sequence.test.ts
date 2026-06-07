import { describe, it, expect } from 'vitest';
import { startSequence, currentOpponent, recordBattle, carryConditions } from './battle-sequence';
import type { SeqOpponent } from './battle-sequence';
import { createOwned, setHp } from './owned-pokemon';
import { maxHp } from './stats';

const opp = (id: string): SeqOpponent => ({ id, name: id, team: [] });

describe('battle sequence', () => {
  it('advances on wins and completes after the last opponent', () => {
    let s = startSequence([opp('a'), opp('b')], { itemsAllowed: true });
    expect(currentOpponent(s)!.id).toBe('a');
    s = recordBattle(s, true); expect(currentOpponent(s)!.id).toBe('b');
    s = recordBattle(s, true); expect(s.status).toBe('complete'); expect(currentOpponent(s)).toBeNull();
  });

  it('a loss fails the whole run', () => {
    let s = startSequence([opp('a'), opp('b')], { itemsAllowed: true });
    s = recordBattle(s, false);
    expect(s.status).toBe('failed');
  });

  it('carryConditions reflects party HP%/status (no heal)', () => {
    let mon = createOwned({ species: 'Snorlax', level: 50 });
    mon = setHp(mon, Math.floor(maxHp(mon) * 0.5)); mon.status = 'par';
    const cond = carryConditions([mon]);
    expect(cond.p1[0].hpPercent).toBeGreaterThanOrEqual(48);
    expect(cond.p1[0].hpPercent).toBeLessThanOrEqual(52);
    expect(cond.p1[0].status).toBe('par');
  });

  it('respects itemsAllowed (false on hardest sequences)', () => {
    expect(startSequence([opp('a')], { itemsAllowed: false }).itemsAllowed).toBe(false);
  });
});
