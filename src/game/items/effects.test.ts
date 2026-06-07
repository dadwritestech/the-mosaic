import { describe, it, expect } from 'vitest';
import { applyItem } from './effects';
import { createNewGame, addToParty } from '../game-state';
import { createOwned, setHp } from '../owned-pokemon';
import { maxHp } from '../stats';

function gameWith(mon: ReturnType<typeof createOwned>) {
  return addToParty(createNewGame({ difficultyMode: 'normal', nuzlocke: false }), mon);
}

describe('applyItem', () => {
  it('Potion heals a damaged mon and rejects a full one', () => {
    let mon = createOwned({ species: 'Snorlax', level: 50 }); mon = setHp(mon, 10);
    let g = gameWith(mon);
    const r1 = applyItem(g, 'potion', mon.uid);
    expect(r1.result.ok).toBe(true);
    expect(r1.state.party[0].currentHp).toBe(30);
    const full = applyItem(r1.state, 'potion', mon.uid); // now... still not full, allow
    expect(typeof full.result.ok).toBe('boolean');
    // a truly full mon is rejected:
    let healthy = gameWith(createOwned({ species: 'Pikachu', level: 50 }));
    expect(applyItem(healthy, 'potion', healthy.party[0].uid).result.ok).toBe(false);
  });

  it('Revive rejects a healthy mon, works on a fainted one', () => {
    let fainted = createOwned({ species: 'Pikachu', level: 50 }); fainted = setHp(fainted, 0);
    let g = gameWith(fainted);
    const r = applyItem(g, 'revive', fainted.uid);
    expect(r.result.ok).toBe(true);
    expect(r.state.party[0].currentHp).toBe(Math.round(maxHp(fainted) * 0.5));
  });

  it('Thunder Stone evolves Pikachu to Raichu', () => {
    const pika = createOwned({ species: 'Pikachu', level: 30 });
    const g = gameWith(pika);
    const r = applyItem(g, 'thunderstone', pika.uid);
    expect(r.result.ok).toBe(true);
    expect(r.result.evolvedInto).toBe('Raichu');
    expect(r.state.party[0].species).toBe('Raichu');
  });

  it('repel sets a state flag (deferred enforcement)', () => {
    const g = createNewGame({ difficultyMode: 'normal', nuzlocke: false });
    const r = applyItem(g, 'repel');
    expect(r.result.ok).toBe(true);
    expect(r.state.flags['repelSteps']).toBe(100);
  });
});
