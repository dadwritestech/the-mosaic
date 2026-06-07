import { describe, it, expect } from 'vitest';
import { availableEndings, applyEnding } from './ending';
import { createNewGame, addToParty } from './game-state';
import { createOwned } from './owned-pokemon';
import { pushMeter } from './story';

describe('ending', () => {
  it('available endings depend on the meter tier', () => {
    const balance = createNewGame({ difficultyMode: 'normal', nuzlocke: false });
    expect(availableEndings(balance).sort()).toEqual(['balance', 'embrace', 'reset']);
    expect(availableEndings(pushMeter(balance, -50))).toEqual(['reset', 'balance']);
    expect(availableEndings(pushMeter(balance, 50))).toEqual(['embrace', 'balance']);
  });

  it('reset wipes the party and boxes into the graveyard', () => {
    let g = createNewGame({ difficultyMode: 'normal', nuzlocke: false });
    g = addToParty(g, createOwned({ species: 'Pikachu', level: 50 }));
    const out = applyEnding(g, 'reset');
    expect(out.state.party.length).toBe(0);
    expect(out.state.graveyard.length).toBe(1);
    expect(out.state.flags.ending).toBe('reset');
    expect(out.narrationKey).toBe('ending.reset');
  });

  it('embrace and balance keep the team', () => {
    let g = addToParty(createNewGame({ difficultyMode: 'normal', nuzlocke: false }), createOwned({ species: 'Pikachu', level: 50 }));
    expect(applyEnding(g, 'embrace').state.party.length).toBe(1);
    expect(applyEnding(g, 'balance').state.flags.ending).toBe('balance');
  });
});
