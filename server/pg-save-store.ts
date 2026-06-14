import { Pool } from 'pg';
import type { SaveStore, SlotInfo } from '../src/game/save';

export class PgSaveStore implements SaveStore {
  private pool: Pool;
  private initPromise: Promise<void>;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
    this.initPromise = this.init();
  }

  private async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS saves (
        slot VARCHAR(255) PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  async save(slot: string, json: string): Promise<void> {
    await this.initPromise;
    // We parse the JSON to let Postgres store it cleanly as JSONB,
    // though storing it as text works too. JSONB ensures validity.
    const data = JSON.parse(json);
    await this.pool.query(
      `
      INSERT INTO saves (slot, data, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (slot) DO UPDATE
      SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP;
      `,
      [slot, data]
    );
  }

  async load(slot: string): Promise<string | null> {
    await this.initPromise;
    const res = await this.pool.query('SELECT data FROM saves WHERE slot = $1', [slot]);
    if (res.rows.length === 0) return null;
    return JSON.stringify(res.rows[0].data);
  }

  async list(): Promise<SlotInfo[]> {
    await this.initPromise;
    // Fast path: just extract the top-level player name and location from the JSONB
    const res = await this.pool.query(`
      SELECT slot, 
             data->'player'->>'name' as player_name, 
             data->'player'->>'location' as location,
             updated_at
      FROM saves
      ORDER BY updated_at DESC
    `);

    return res.rows.map(row => ({
      slot: row.slot,
      playerName: row.player_name || 'Unknown',
      location: row.location || 'Unknown',
      lastSaved: new Date(row.updated_at).getTime()
    }));
  }

  async close() {
    await this.pool.end();
  }
}
