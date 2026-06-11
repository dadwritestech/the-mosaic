import { describe, it, expect } from 'vitest';
import { serialize, deserialize, validateAndRepair, InMemorySaveStore } from './save';
import { createNewGame, registerCaught, addToParty } from './game-state';
import { createOwned } from './owned-pokemon';

describe('save/load', () => {
  it('round-trips a game state including pokedex Sets', () => {
    let g = createNewGame({ difficultyMode: 'hard', nuzlocke: true });
    g = registerCaught(g, 6); g = addToParty(g, createOwned({ species: 'Charizard', level: 36 }));
    const back = deserialize(serialize(g));
    expect(back.pokedex.caught.has(6)).toBe(true);
    expect(back.pokedex.caught instanceof Set).toBe(true);
    expect(back.party[0].species).toBe('Charizard');
    expect(back).toEqual(g);
  });

  it('stamps schemaVersion in the serialized payload', () => {
    const g = createNewGame({ difficultyMode: 'normal', nuzlocke: false });
    expect(JSON.parse(serialize(g)).schemaVersion).toBe(2);
  });

  it('validateAndRepair clamps an over-cap save', () => {
    const g = createNewGame({ difficultyMode: 'normal', nuzlocke: false });
    (g.party as any).push(createOwned({ species: 'Pikachu', level: 5 }), createOwned({ species: 'Pikachu', level: 5 }),
      createOwned({ species: 'Pikachu', level: 5 }), createOwned({ species: 'Pikachu', level: 5 }),
      createOwned({ species: 'Pikachu', level: 5 }), createOwned({ species: 'Pikachu', level: 5 }),
      createOwned({ species: 'Pikachu', level: 5 })); // 7 in party
    g.money = -50;
    const fixed = validateAndRepair(g);
    expect(fixed.party.length).toBe(6);
    expect(fixed.money).toBe(0);
  });

  it('SaveStore saves, loads, and deletes a slot', async () => {
    const store = new InMemorySaveStore();
    const g = createNewGame({ difficultyMode: 'normal', nuzlocke: false });
    await store.save('slot1', serialize(g));
    expect(await store.load('slot1')).toBeTruthy();
    await store.delete('slot1');
    expect(await store.load('slot1')).toBeNull();
  });
});
