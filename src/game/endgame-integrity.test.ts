import { describe, it, expect } from 'vitest';
import * as Sim from 'pokemon-showdown';
import { STORY_BEATS } from '../content/story/beats';
import { ELITE_FOUR, CHAMPION, VRISKA_GAUNTLET, ENDING_NARRATION } from '../content/elite/index';
import { startSequence, recordBattle } from './battle-sequence';
import { BattleBridge } from '../bridge/battle-bridge';

const dex = (Sim.Dex as any).forGen(9);
const legal = async (team: any[]) => {
  const bridge = new BattleBridge();
  await bridge.startBattle(team, team, { formatid: 'gen9customgame' });
  return bridge.state.winner === undefined && team.every((s: any) => dex.species.get(s.species).exists);
};

describe('endgame content integrity', () => {
  it('5 story beats, rift-gated in ascending order, with faction choices', () => {
    expect(STORY_BEATS.length).toBe(5);
    let prev = -1;
    for (const b of STORY_BEATS) {
      expect(b.requiredRifts).toBeGreaterThanOrEqual(prev); prev = b.requiredRifts ?? prev;
      expect(b.choices.some((c) => c.faction === 'purist' && c.meterDelta < 0)).toBe(true);
      expect(b.choices.some((c) => c.faction === 'synthesist' && c.meterDelta > 0)).toBe(true);
    }
  });

  it('Elite Four = 4 opponents with legal teams', async () => {
    expect(ELITE_FOUR.length).toBe(4);
    for (const e of ELITE_FOUR) { expect(e.team.length).toBeGreaterThan(0); expect(await legal(e.team)).toBe(true); }
  });

  it('Champion has a legal 6-mon team', async () => {
    expect(CHAMPION.team.length).toBe(6);
    expect(await legal(CHAMPION.team)).toBe(true);
  });

  it('Vriska gauntlet = 3 Dragon-led legal rooms', async () => {
    expect(VRISKA_GAUNTLET.length).toBe(3);
    for (const r of VRISKA_GAUNTLET) {
      expect(await legal(r.team)).toBe(true);
      expect(r.team.some((s) => dex.species.get(s.species).types.includes('Dragon'))).toBe(true);
    }
  });

  it('a full E4 -> Champion sequence runs start to complete', () => {
    let s = startSequence([...ELITE_FOUR, CHAMPION], { itemsAllowed: true });
    for (let i = 0; i < 5; i++) s = recordBattle(s, true);
    expect(s.status).toBe('complete');
  });

  it('ending narration exists for all three endings', () => {
    for (const k of ['reset', 'embrace', 'balance'] as const) expect(ENDING_NARRATION[k]).toBeTruthy();
  });
});
