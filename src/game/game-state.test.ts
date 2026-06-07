import { describe, it, expect } from 'vitest';
import {
  createNewGame, addToParty, depositToBox, withdrawFromBox,
  addItem, useItem, addMoney, spendMoney, grantBadge, registerCaught,
} from './game-state';
import { createOwned } from './owned-pokemon';

describe('game state containers', () => {
  it('creates a new game with empty party and starting settings', () => {
    const g = createNewGame({ difficultyMode: 'hardest', nuzlocke: true });
    expect(g.party).toEqual([]);
    expect(g.settings.nuzlocke).toBe(true);
    expect(g.money).toBe(0);
    expect(g.boxes.length).toBeGreaterThan(0);
  });

  it('adds to party up to 6, then overflows to a box', () => {
    let g = createNewGame({ difficultyMode: 'normal', nuzlocke: false });
    for (let i = 0; i < 7; i++) g = addToParty(g, createOwned({ species: 'Pikachu', level: 5 }));
    expect(g.party.length).toBe(6);
    const inBoxes = g.boxes.reduce((a, b) => a + b.slots.filter((s) => s).length, 0);
    expect(inBoxes).toBe(1);
  });

  it('deposits and withdraws from a box by uid', () => {
    let g = createNewGame({ difficultyMode: 'normal', nuzlocke: false });
    const mon = createOwned({ species: 'Snorlax', level: 20 });
    g = addToParty(g, mon);
    g = depositToBox(g, mon.uid);
    expect(g.party.find((m) => m.uid === mon.uid)).toBeUndefined();
    g = withdrawFromBox(g, mon.uid);
    expect(g.party.find((m) => m.uid === mon.uid)).toBeTruthy();
  });

  it('bag add/use and money add/spend respect floors', () => {
    let g = createNewGame({ difficultyMode: 'normal', nuzlocke: false });
    g = addItem(g, 'medicine', 'potion', 3);
    g = useItem(g, 'medicine', 'potion');
    expect(g.bag.medicine.potion).toBe(2);
    g = addMoney(g, 500);
    expect(spendMoney(g, 999)).toBeNull();          // can't overspend
    g = spendMoney(g, 200)!;
    expect(g.money).toBe(300);
  });

  it('grants badges (no duplicates) and registers pokedex caught', () => {
    let g = createNewGame({ difficultyMode: 'normal', nuzlocke: false });
    g = grantBadge(g, 'steel'); g = grantBadge(g, 'steel');
    expect(g.badges).toEqual(['steel']);
    g = registerCaught(g, 25);
    expect(g.pokedex.caught.has(25)).toBe(true);
    expect(g.pokedex.seen.has(25)).toBe(true);
  });
});
