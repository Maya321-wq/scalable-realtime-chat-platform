const { pool } = require('../db');

/**
 * User model for the auth-service.
 * Thin wrapper around parameterized SQL queries — no ORM.
 * All queries use $1/$2 placeholders (pg driver) to prevent SQL injection.
 */

/**
 * Upsert a user from Google OAuth profile.
 * If the google_id already exists, update name and avatar.
 * Returns the full user row.
 */
async function upsertFromGoogle({ googleId, email, name, avatar }) {
  const { rows } = await pool.query(
    `INSERT INTO users (google_id, email, name, avatar)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (google_id) DO UPDATE
       SET name   = EXCLUDED.name,
           avatar = EXCLUDED.avatar
     RETURNING id, google_id, email, name, avatar, role, created_at`,
    [googleId, email, name, avatar]
  );
  return rows[0];
}

/**
 * Find a user by their internal UUID.
 */
async function findById(id) {
  const { rows } = await pool.query(
    'SELECT id, email, name, avatar, role, created_at FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

/**
 * Find a user by Google ID.
 */
async function findByGoogleId(googleId) {
  const { rows } = await pool.query(
    'SELECT id, email, name, avatar, role FROM users WHERE google_id = $1',
    [googleId]
  );
  return rows[0] || null;
}

module.exports = { upsertFromGoogle, findById, findByGoogleId };