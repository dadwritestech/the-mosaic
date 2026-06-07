import { describe, it, expect } from 'vitest';
import { observeBattle } from './observer';
import { createPlayerModel } from './player-model';
import type { BattleSummary } from './observer';

const aggressiveBattle = (over: Partial<BattleSummary> = {}): BattleSummary => ({
  outcome: 'win', attackRatio: 1, switchRatio: 0, statusRatio: 0,
  superEffectiveRatio: 0.9, sacrificeRatio: 0, leadSpecies: 'Charizard',
  teamSpecies: ['Charizard', 'Blastoise', 'Venusaur'], badgesAtTime: 0, ...over,
});

describe('observeBattle', () => {
  it('gradually raises aggression over repeated aggressive battles', () => {
    const after1 = observeBattle(createPlayerModel(), aggressiveBattle());
    expect(after1.tendencies.aggression.value).toBeLessThan(0.65); // barely moved
    let mm = createPlayerModel();
    for (let i = 0; i < 10; i++) mm = observeBattle(mm, aggressiveBattle());
    expect(mm.tendencies.aggression.value).toBeGreaterThan(0.8);
    expect(mm.tendencies.aggression.confidence).toBeGreaterThan(0.5);
    expect(mm.battlesObserved).toBe(10);
  });

  it('detects an unstable roster (low rosterStability) across differing teams', () => {
    let m = createPlayerModel();
    m = observeBattle(m, aggressiveBattle({ teamSpecies: ['Pikachu', 'Snorlax'] }));
    for (let i = 0; i < 8; i++) {
      m = observeBattle(m, aggressiveBattle({ teamSpecies: i % 2 ? ['Gengar', 'Onix'] : ['Lapras', 'Jolteon'] }));
    }
    expect(m.tendencies.rosterStability.value).toBeLessThan(0.4);
  });

  it('records per-character memory faster than the global model', () => {
    let m = createPlayerModel();
    m = observeBattle(m, aggressiveBattle({ trainerId: 'rival', outcome: 'win' }));
    expect(m.characters.rival.encounters).toBe(1);
    expect(m.characters.rival.lastOutcome).toBe('win');
  });

  it('climbs reputation with wins', () => {
    let m = createPlayerModel();
    for (let i = 0; i < 10; i++) m = observeBattle(m, aggressiveBattle({ outcome: 'win' }));
    expect(m.reputation.score).toBeGreaterThan(0);
    expect(m.reputation.level).not.toBe('Unknown');
  });
});
