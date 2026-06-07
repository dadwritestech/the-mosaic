import { describe, it, expect } from 'vitest';
import type { Action, BattleState, TurnResult, CatchResult } from './types';

describe('types contract', () => {
  it('allows constructing each Action variant', () => {
    const move: Action = { kind: 'move', index: 1 };
    const swap: Action = { kind: 'switch', index: 2 };
    const ball: Action = { kind: 'catch', ball: 'poke' };
    expect([move.kind, swap.kind, ball.kind]).toEqual(['move', 'switch', 'catch']);
  });
});
