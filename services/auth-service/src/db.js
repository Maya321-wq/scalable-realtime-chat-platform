const { Pool } = require('pg');

/**
 * Shared PostgreSQL connection pool for the auth-service.
 * All models import from here so we never create multiple pools.
 */
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || 'postgresql://admin:secret@localhost:5432/appdb',
});

/**
 * Run the initial schema migration.
 * Called once at app startup — idempotent (CREATE TABLE IF NOT EXISTS).
 */
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      google_id  TEXT UNIQUE NOT NULL,
      email      TEXT UNIQUE NOT NULL,
      name       TEXT,
      avatar     TEXT,
      role       TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('[DB] Schema ready');
}

module.exports = { pool, initDB };