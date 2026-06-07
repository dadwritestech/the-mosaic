import type { GameState } from './types';

const SCHEMA_VERSION = 1;

export function serialize(state: GameState): string {
  return JSON.stringify({
    ...state,
    schemaVersion: SCHEMA_VERSION,
    pokedex: { seen: [...state.pokedex.seen], caught: [...state.pokedex.caught] },
  });
}

export function deserialize(json: string): GameState {
  const raw = JSON.parse(json);
  return {
    ...raw,
    pokedex: { seen: new Set<number>(raw.pokedex.seen), caught: new Set<number>(raw.pokedex.caught) },
  } as GameState;
}

/** Clamp/repair an untrusted or evolved save so it can't crash the game. */
export function validateAndRepair(state: GameState): GameState {
  const party = state.party.slice(0, 6);
  for (const mon of party) {
    for (const k of Object.keys(mon.evs) as (keyof typeof mon.evs)[]) mon.evs[k] = Math.max(0, Math.min(252, mon.evs[k]));
    let total = Object.values(mon.evs).reduce((a, b) => a + b, 0);
    for (const k of Object.keys(mon.evs) as (keyof typeof mon.evs)[]) { if (total <= 510) break; const cut = Math.min(mon.evs[k], total - 510); mon.evs[k] -= cut; total -= cut; }
  }
  return { ...state, party, money: Math.max(0, state.money) };
}

export interface SlotInfo { slot: string; }
export interface SaveStore {
  save(slot: string, json: string): Promise<void>;
  load(slot: string): Promise<string | null>;
  list(): Promise<SlotInfo[]>;
  delete(slot: string): Promise<void>;
}

export class InMemorySaveStore implements SaveStore {
  private data = new Map<string, string>();
  async save(slot: string, json: string) { this.data.set(slot, json); }
  async load(slot: string) { return this.data.get(slot) ?? null; }
  async list() { return [...this.data.keys()].map((slot) => ({ slot })); }
  async delete(slot: string) { this.data.delete(slot); }
}
