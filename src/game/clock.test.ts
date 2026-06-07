import { describe, it, expect } from 'vitest';
import { advanceTime, advanceStep, currentDay, timeOfDay } from './clock';
import { createNewGame } from './game-state';

const fresh = () => createNewGame({ difficultyMode: 'normal', nuzlocke: false });

describe('clock', () => {
  it('advanceTime carries minutes into days', () => {
    let g = fresh(); g.time = { day: 0, minutes: 1430 };
    g = advanceTime(g, 20); // 1450 -> day 1, 10 min
    expect(g.time.day).toBe(1);
    expect(g.time.minutes).toBe(10);
  });
  it('advanceTime handles multi-day jumps', () => {
    let g = fresh();
    g = advanceTime(g, 1440 * 3 + 5);
    expect(g.time.day).toBe(3);
    expect(g.time.minutes).toBe(5);
  });
  it('advanceStep adds 5 minutes', () => {
    let g = fresh(); const before = g.time.minutes;
    g = advanceStep(g);
    expect(g.time.minutes).toBe(before + 5);
  });
  it('currentDay returns the day', () => {
    const g = fresh(); g.time.day = 7;
    expect(currentDay(g)).toBe(7);
  });
  it('timeOfDay buckets minutes', () => {
    const at = (m: number) => { const g = fresh(); g.time.minutes = m; return timeOfDay(g); };
    expect(at(300)).toBe('morning'); // 05:00
    expect(at(720)).toBe('day');     // 12:00
    expect(at(1200)).toBe('night');  // 20:00
    expect(at(60)).toBe('night');    // 01:00
  });
});
