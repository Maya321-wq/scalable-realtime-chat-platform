const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || 'postgresql://admin:secret@localhost:5432/appdb',
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      google_id  TEXT UNIQUE,
      email      TEXT UNIQUE NOT NULL,
      name       TEXT,
      avatar     TEXT,
      role       TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('[DB] Schema ready');
}

module.exports = { pool, initDB };