import { describe, it, expect } from 'vitest';
import { createOwned, levelFromExp, gainExp, healFull, setHp, addEvs } from './owned-pokemon';
import { maxHp } from './stats';

describe('owned pokemon', () => {
  it('creates a full-HP mon whose exp matches its starting level', () => {
    const mon = createOwned({ species: 'Pikachu', level: 10 });
    expect(mon.level).toBe(10);
    expect(mon.exp).toBe(1000); // mediumfast: 10^3
    expect(mon.currentHp).toBe(maxHp(mon));
    expect(mon.uid).toBeTruthy();
  });

  it('levelFromExp finds the right level and caps at 100', () => {
    expect(levelFromExp(125, 'mediumfast')).toBe(5);
    expect(levelFromExp(124, 'mediumfast')).toBe(4);
    expect(levelFromExp(9_999_999, 'mediumfast')).toBe(100);
  });

  it('gainExp levels the mon up', () => {
    let mon = createOwned({ species: 'Pikachu', level: 5 }); // exp 125
    mon = gainExp(mon, 875); // -> 1000 = level 10
    expect(mon.level).toBe(10);
  });

  it('addEvs respects the 252 per-stat and 510 total caps', () => {
    let mon = createOwned({ species: 'Pikachu', level: 5 });
    mon = addEvs(mon, { spa: 300 }); // clamps to 252
    expect(mon.evs.spa).toBe(252);
    mon = addEvs(mon, { hp: 252, atk: 252 }); // total would be 756 -> clamp to 510 total
    const total = Object.values(mon.evs).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(510);
  });

  it('healFull restores HP and status; setHp clamps to [0,max]', () => {
    let mon = createOwned({ species: 'Snorlax', level: 50 });
    mon = setHp(mon, -5); expect(mon.currentHp).toBe(0);
    mon = healFull(mon); expect(mon.status).toBe(''); expect(mon.currentHp).toBe(maxHp(mon));
    mon = setHp(mon, 999999); expect(mon.currentHp).toBe(maxHp(mon));
  });
});
