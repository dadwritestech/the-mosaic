// Node-side SaveStore: persists serialized GameState JSON to disk so saves
// survive a server restart. Implements the same SaveStore interface the logic
// layer defines (src/game/save.ts), reusing its tested serialize/deserialize.
import { promises as fs } from 'fs';
import * as path from 'path';
import type { SaveStore, SlotInfo } from '../src/game/save';

export class FileSaveStore implements SaveStore {
  constructor(private dir: string) {}

  private file(slot: string): string {
    // Keep slot names filesystem-safe.
    const safe = slot.replace(/[^a-z0-9_-]/gi, '_');
    return path.join(this.dir, `${safe}.json`);
  }

  async save(slot: string, json: string): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(this.file(slot), json, 'utf8');
  }

  async load(slot: string): Promise<string | null> {
    try { return await fs.readFile(this.file(slot), 'utf8'); }
    catch { return null; }
  }

  async list(): Promise<SlotInfo[]> {
    try {
      const files = await fs.readdir(this.dir);
      return files.filter((f: string) => f.endsWith('.json')).map((f: string) => ({ slot: f.replace(/\.json$/, '') }));
    } catch { return []; }
  }

  async delete(slot: string): Promise<void> {
    try { await fs.unlink(this.file(slot)); } catch { /* already gone */ }
  }
}
