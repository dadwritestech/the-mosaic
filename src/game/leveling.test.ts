import { describe, it, expect } from 'vitest';
import { expForKO, distributeExp, applyExpGain } from './leveling';
import { createOwned } from './owned-pokemon';

describe('leveling', () => {
  it('expForKO matches the Gen-5 scaled formula', () => {
    expect(expForKO(112, 20, 20, 1)).toBe(449);
  });
  it('an over-leveled winner earns less from the same KO', () => {
    expect(expForKO(112, 20, 40, 1)).toBeLessThan(expForKO(112, 20, 20, 1));
  });

  it('distributeExp: bench gets a partial share on normal, zero on hard', () => {
    const a = createOwned({ species: 'Pikachu', level: 20 });
    const b = createOwned({ species: 'Bulbasaur', level: 20 });
    const defeated = [{ species: 'Pikachu', level: 20 }];
    const normal = distributeExp([a, b], { defeatedTeam: defeated, participantUids: [a.uid], mode: 'normal' });
    expect(normal.get(a.uid)!).toBeGreaterThan(0);
    expect(normal.get(b.uid)!).toBeGreaterThan(0);
    expect(normal.get(b.uid)!).toBeLessThan(normal.get(a.uid)!); // bench gets less
    const hard = distributeExp([a, b], { defeatedTeam: defeated, participantUids: [a.uid], mode: 'hard' });
    expect(hard.get(b.uid)!).toBe(0); // bench gets nothing on hard
  });

  it('applyExpGain levels up and surfaces evolution at the evo level', () => {
    const charm = createOwned({ species: 'Charmander', level: 15, moves: ['scratch', 'growl', 'ember', 'smokescreen'] });
    // enough exp to reach level 16 (mediumslow)
    const res = applyExpGain(charm, 100000);
    expect(res.levelsGained).toBeGreaterThan(0);
    expect(res.evolutionInto).toBe('Charmeleon');
  });

  it('applyExpGain auto-learns into a free slot but queues when the moveset is full', () => {
    const free = createOwned({ species: 'Charmander', level: 3, moves: ['scratch'] });
    const r1 = applyExpGain(free, 1000); // crosses L4 -> learns ember into a free slot
    expect(r1.mon.moves.some((m) => m.id === 'ember')).toBe(true);
    const full = createOwned({ species: 'Charmander', level: 3, moves: ['scratch', 'growl', 'tackle', 'leer'] });
    const r2 = applyExpGain(full, 1000);
    expect(r2.movesToLearn.some((m) => m.moveId === 'ember')).toBe(true); // queued, not forced
  });
});
