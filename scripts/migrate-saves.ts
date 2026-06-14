import { promises as fs } from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import { FileSaveStore } from '../server/file-save-store';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://game_user:game_password@localhost:5432/game_db';

async function migrate() {
  console.log(`Connecting to Postgres at ${DATABASE_URL}...`);
  const pool = new Pool({ connectionString: DATABASE_URL });

  // Initialize table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS saves (
      slot VARCHAR(255) PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const fileStore = new FileSaveStore(path.join(__dirname, '..', '.saves'));
  const list = await fileStore.list();

  if (list.length === 0) {
    console.log('No local saves found in .saves/');
  } else {
    for (const entry of list) {
      console.log(`Migrating slot: ${entry.slot}...`);
      const dataStr = await fileStore.load(entry.slot);
      if (!dataStr) continue;

      const data = JSON.parse(dataStr);
      await pool.query(
        `
        INSERT INTO saves (slot, data, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (slot) DO UPDATE
        SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP;
        `,
        [entry.slot, data]
      );
      console.log(` -> Successfully migrated ${entry.slot} (${entry.playerName})`);
    }
  }

  await pool.end();
  console.log('Migration complete!');
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
