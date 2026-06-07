export type DifficultyMode = 'normal' | 'hard' | 'hardest';

export function moneyMod(mode: DifficultyMode): number {
  if (mode === 'hard') return 0.9;
  if (mode === 'hardest') return 0.8;
  return 1.0;
}

export interface TrainerReward {
  basePayout: number; tier: string;
  dropTable?: { itemId: string; chance: number }[];
}
export interface RewardContext {
  isWild: boolean;
  trainer?: TrainerReward;
  opponentLevels: number[];
  mode: DifficultyMode;
  rng: () => number;
}

export function computeRewards(ctx: RewardContext): { money: number; items: string[] } {
  let money = 0;
  if (!ctx.isWild && ctx.trainer) {
    const highest = Math.max(...ctx.opponentLevels);
    money = Math.floor(ctx.trainer.basePayout * highest * moneyMod(ctx.mode));
  }
  const items: string[] = [];
  for (const drop of ctx.trainer?.dropTable ?? []) {
    if (ctx.rng() < drop.chance) items.push(drop.itemId);
  }
  return { money, items };
}
