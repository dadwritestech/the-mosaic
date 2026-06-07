import { describe, it, expect } from 'vitest';
import { canSaveHere, applyFaintConsequences, markEncounterUsed, isEncounterUsed } from './rules';
import { createNewGame, addToParty } from './game-state';
import { createOwned, setHp } from './owned-pokemon';

describe('rules', () => {
  it('canSaveHere: anywhere on normal/hard, Centers-only on hardest', () => {
    const base = createNewGame({ difficultyMode: 'normal', nuzlocke: false });
    expect(canSaveHere({ ...base, location: { ...base.location, atPokemonCenter: false } })).toBe(true);
    const hardest = createNewGame({ difficultyMode: 'hardest', nuzlocke: false });
    expect(canSaveHere({ ...hardest, location: { ...hardest.location, atPokemonCenter: false } })).toBe(false);
    expect(canSaveHere({ ...hardest, location: { ...hardest.location, atPokemonCenter: true } })).toBe(true);
  });

  it('applyFaintConsequences sends fainted party mons to the graveyard ONLY when nuzlocke on', () => {
    let g = createNewGame({ difficultyMode: 'normal', nuzlocke: true });
    const alive = createOwned({ species: 'Pikachu', level: 10 });
    let fainted = createOwned({ species: 'Caterpie', level: 8 }); fainted = setHp(fainted, 0);
    g = addToParty(addToParty(g, alive), fainted);
    g = applyFaintConsequences(g);
    expect(g.party.map((m) => m.species)).toEqual(['Pikachu']);
    expect(g.graveyard.map((m) => m.species)).toEqual(['Caterpie']);
  });

  it('applyFaintConsequences is a no-op when nuzlocke off', () => {
    let g = createNewGame({ difficultyMode: 'normal', nuzlocke: false });
    let fainted = createOwned({ species: 'Caterpie', level: 8 }); fainted = setHp(fainted, 0);
    g = addToParty(g, fainted);
    g = applyFaintConsequences(g);
    expect(g.party.length).toBe(1);
    expect(g.graveyard.length).toBe(0);
  });

  it('encounter markers track per-area first encounter', () => {
    let g = createNewGame({ difficultyMode: 'normal', nuzlocke: true });
    expect(isEncounterUsed(g, 'route1')).toBe(false);
    g = markEncounterUsed(g, 'route1');
    expect(isEncounterUsed(g, 'route1')).toBe(true);
    expect(isEncounterUsed(g, 'route2')).toBe(false);
  });
});
