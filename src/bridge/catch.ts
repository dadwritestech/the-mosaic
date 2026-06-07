import type { BallType } from './types';

export const BALL_MODIFIERS: Record<BallType, number> = {
  poke: 1, great: 1.5, ultra: 2, master: 255,
};

const STATUS_BONUS: Record<string, number> = {
  slp: 2.5, frz: 2.5, par: 1.5, psn: 1.5, brn: 1.5, tox: 1.5, '': 1,
};

export interface CatchInput { baseRate: number; hpPercent: number; status: string; ball: BallType; }

// Gen-style modified catch rate -> probability of a single successful catch.
export function catchChance({ baseRate, hpPercent, status, ball }: CatchInput): number {
  if (ball === 'master') return 1;
  const hp = Math.max(1, Math.min(100, hpPercent));
  const maxHP = 100, curHP = hp;
  const ballMod = BALL_MODIFIERS[ball];
  const statusMod = STATUS_BONUS[status] ?? 1;
  // a = ((3*max - 2*cur) * rate * ball) / (3*max) * status
  const a = (((3 * maxHP - 2 * curHP) * baseRate * ballMod) / (3 * maxHP)) * statusMod;
  if (a >= 255) return 1;
  // shake check probability b = 65536 / (255/a)^0.1875, overall = (b/65536)^4
  const b = 65536 / Math.pow(255 / a, 0.1875);
  const p = Math.pow(b / 65536, 4);
  return Math.max(0, Math.min(1, p));
}

// Roll a catch: returns shakes (0-3) and whether caught (4 shakes).
export function rollCatch(chance: number, rng: () => number = Math.random): { caught: boolean; shakes: number } {
  if (chance >= 1) return { caught: true, shakes: 4 };
  const per = Math.pow(chance, 1 / 4); // per-shake success
  let shakes = 0;
  for (let i = 0; i < 4; i++) {
    if (rng() <= per) shakes++;
    else return { caught: false, shakes };
  }
  return { caught: true, shakes: 4 };
}
