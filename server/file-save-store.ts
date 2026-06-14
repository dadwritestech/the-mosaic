// Node-side SaveStore: persists serialized GameState JSON to disk so saves
// survive a server restart. Implements the same SaveStore interface the logic
// layer defines (src/game/save.ts), reusing its tested serialize/deserialize.
//
// Safety guarantees:
//   1. Atomic write  — data is written to a .tmp file first, then renamed into
//      place. A crash mid-write leaves the old save intact (rename is atomic on
//      virtually all modern OS/filesystems).
//   2. Backup        — before overwriting an existing save the old file is
//      copied to <slot>.bak.json. If the new write somehow fails you still have
//      the previous session.
//   3. Corrupt-save recovery — on load, if the primary file cannot be parsed as
//      valid JSON the loader automatically tries the .bak file and logs a warning.
import { promises as fs } from 'fs';
import * as path from 'path';
import type { SaveStore, SlotInfo } from '../src/game/save';

export class FileSaveStore implements SaveStore {
  constructor(private dir: string) {}

  private file(slot: string, ext = '.json'): string {
    const safe = slot.replace(/[^a-z0-9_-]/gi, '_');
    return path.join(this.dir, `${safe}${ext}`);
  }

  async save(slot: string, json: string): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });

    const dest = this.file(slot);
    const tmp  = this.file(slot, '.tmp.json');
    const bak  = this.file(slot, '.bak.json');

    // 1. Write to a temp file so a crash here leaves the old save untouched.
    await fs.writeFile(tmp, json, 'utf8');

    // 2. Back up the current save (if it exists) before overwriting.
    try { await fs.copyFile(dest, bak); } catch { /* no existing save — fine */ }

    // 3. Atomically replace the real save with the newly written temp file.
    await fs.rename(tmp, dest);
  }

  async load(slot: string): Promise<string | null> {
    // Try the primary file first; fall back to .bak if it's missing or corrupt.
    for (const ext of ['.json', '.bak.json']) {
      try {
        const data = await fs.readFile(this.file(slot, ext), 'utf8');
        JSON.parse(data); // validate — throws if corrupt
        if (ext === '.bak.json') {
          console.warn(`[save] Primary save for "${slot}" was corrupt — loaded from backup.`);
        }
        return data;
      } catch {
        // missing or corrupt — try next candidate
      }
    }
    return null;
  }

  async list(): Promise<SlotInfo[]> {
    try {
      const files = await fs.readdir(this.dir);
      return files
        .filter((f: string) => f.endsWith('.json') && !f.endsWith('.bak.json') && !f.endsWith('.tmp.json'))
        .map((f: string) => ({ slot: f.replace(/\.json$/, '') }));
    } catch { return []; }
  }

  async delete(slot: string): Promise<void> {
    for (const ext of ['.json', '.bak.json', '.tmp.json']) {
      try { await fs.unlink(this.file(slot, ext)); } catch { /* already gone */ }
    }
  }
}

