import { describe, it, expect } from 'vitest';
import { SLICE_MAPS } from './maps/slice';
import { tileAt, isWalkable } from './tilemap';

describe('tilemap', () => {
  it('every slice map is rectangular and has a spawn', () => {
    for (const m of Object.values(SLICE_MAPS)) {
      const w = m.tiles[0].length;
      for (const row of m.tiles) expect(row.length).toBe(w);
      expect(m.spawn.x).toBeGreaterThanOrEqual(0);
    }
  });
  it('walls block movement; out of bounds is wall', () => {
    const m = SLICE_MAPS['aethels-rest'];
    expect(isWalkable(m, m.spawn.x, m.spawn.y)).toBe(true);
    expect(tileAt(m, -1, 0)).toBe('wall');
  });
});
