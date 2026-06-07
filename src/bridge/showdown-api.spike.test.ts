import { describe, it, expect } from 'vitest';
import * as Sim from 'pokemon-showdown';

/**
 * Characterization test: this pins the REAL Showdown engine API that the rest of
 * the Battle Bridge is built on. Verified empirically on pokemon-showdown 0.11.x.
 *
 * Ground truth captured here:
 *  - getPlayerStreams is a TOP-LEVEL export (Sim.getPlayerStreams), NOT Sim.BattleStreams.
 *  - getPlayerStreams(stream) -> { omniscient, spectator, p1, p2, p3, p4 }.
 *  - gen9customgame issues a `teamPreview` request FIRST; answer it with `default`.
 *  - Request kinds to handle: teamPreview | active (move) | forceSwitch | wait.
 *  - Output is consumed via `for await (const chunk of stream)`, NOT a one-shot read().
 *  - Species data has NO catchRate field (we own a catch-rate table separately).
 */
describe('Showdown engine API (characterization)', () => {
  it('exposes the entry points we rely on', () => {
    expect(typeof Sim.BattleStream).toBe('function');
    expect(typeof Sim.getPlayerStreams).toBe('function');
    expect(typeof Sim.Teams.pack).toBe('function');
    expect(typeof Sim.Dex.species.get).toBe('function');
    // Confirms WHY we bundle our own catch rates:
    expect((Sim.Dex.species.get('Pikachu') as any).catchRate).toBeUndefined();
  });

  it('runs a full battle to |win| via getPlayerStreams', async () => {
    const team = [{
      name: 'Pikachu', species: 'Pikachu', ability: 'Static', item: '',
      moves: ['thunderbolt', 'quickattack', 'irontail', 'thunderwave'],
      nature: 'Hardy',
      evs: { hp: 0, atk: 85, def: 0, spa: 85, spd: 0, spe: 85 },
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50,
    }];
    const packed = Sim.Teams.pack(team as any);

    const stream = new Sim.BattleStream();
    const streams = Sim.getPlayerStreams(stream);
    expect(Object.keys(streams)).toEqual(
      expect.arrayContaining(['omniscient', 'p1', 'p2']),
    );

    void streams.omniscient.write(
      `>start ${JSON.stringify({ formatid: 'gen9customgame' })}\n` +
      `>player p1 ${JSON.stringify({ name: 'P1', team: packed })}\n` +
      `>player p2 ${JSON.stringify({ name: 'P2', team: packed })}`,
    );

    const drive = async (s: any) => {
      for await (const chunk of s) {
        for (const line of String(chunk).split('\n')) {
          if (!line.startsWith('|request|')) continue;
          const json = line.slice('|request|'.length);
          if (!json) continue;
          const req = JSON.parse(json);
          if (req.wait) continue;
          if (req.teamPreview) void s.write('default');
          else if (req.forceSwitch) void s.write('default');
          else if (req.active) void s.write('move 1');
          else void s.write('default');
        }
      }
    };
    void drive(streams.p1);
    void drive(streams.p2);

    let sawWin = false;
    for await (const chunk of streams.omniscient) {
      if (String(chunk).includes('|win|')) { sawWin = true; break; }
    }
    expect(sawWin).toBe(true);
  });
});
