import { describe, it, expect } from 'vitest';
import { recordTrainerDefeat, isReadyForRematch, listReadyRematches, rematchLevelCap } from './rematch';
import { createNewGame, addToParty, grantBadge } from './game-state';
import { advanceTime } from './clock';
import { createOwned } from './owned-pokemon';

const fresh = () => createNewGame({ difficultyMode: 'normal', nuzlocke: false });

describe('rematch lifecycle', () => {
  it('records a defeat with a 1-day cooldown', () => {
    let g = fresh(); g.time.day = 5;
    g = recordTrainerDefeat(g, 'gymSteel');
    expect(g.trainerLog.gymSteel.defeats).toBe(1);
    expect(g.trainerLog.gymSteel.lastDefeatedDay).toBe(5);
    expect(g.trainerLog.gymSteel.readyDay).toBe(6);
  });

  it('is not ready on the same day, ready after the cooldown passes', () => {
    let g = fresh(); g.time.day = 5;
    g = recordTrainerDefeat(g, 'gymSteel');
    expect(isReadyForRematch(g, 'gymSteel')).toBe(false);
    g = advanceTime(g, 1440); // -> day 6
    expect(isReadyForRematch(g, 'gymSteel')).toBe(true);
  });

  it('an undefeated trainer is never ready', () => {
    expect(isReadyForRematch(fresh(), 'whoever')).toBe(false);
  });

  it('listReadyRematches returns exactly the ready ids', () => {
    let g = fresh(); g.time.day = 0;
    g = recordTrainerDefeat(g, 'a');         // readyDay 1
    g.time.day = 10;
    g = recordTrainerDefeat(g, 'b');         // readyDay 11 (not ready at day 10)
    expect(listReadyRematches(g).sort()).toEqual(['a']);
  });

  it('rematchLevelCap scales with party level + badges, capped at 75', () => {
    let g = fresh();
    expect(rematchLevelCap(g)).toBe(2); // empty party, 0 badges -> 0 + 2 + 0
    g = addToParty(g, createOwned({ species: 'Charizard', level: 40 }));
    g = grantBadge(grantBadge(g, 'x'), 'y'); // 2 badges
    expect(rematchLevelCap(g)).toBe(40 + 2 + 6); // 48
    g = addToParty(g, createOwned({ species: 'Mewtwo', level: 100 }));
    expect(rematchLevelCap(g)).toBe(75); // clamped
  });
});
