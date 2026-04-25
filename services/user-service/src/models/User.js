const { pool } = require('../db');

/**
 * User model for the user-service.
 * Pure SQL functions — no ORM.
 * All queries are parameterized to prevent SQL injection.
 */

/**
 * Find all users with optional search filter and pagination.
 * Used by the admin-only GET /users endpoint.
 */
async function findAll({ search, limit = 20, offset = 0 } = {}) {
  if (search) {
    const { rows } = await pool.query(
      `SELECT id, email, name, avatar, role, created_at
       FROM users
       WHERE name ILIKE $1 OR email ILIKE $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [`%${search}%`, limit, offset]
    );
    return rows;
  }

  const { rows } = await pool.query(
    `SELECT id, email, name, avatar, role, created_at
     FROM users
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

/**
 * Find a single user by their UUID.
 */
async function findById(id) {
  const { rows } = await pool.query(
    'SELECT id, email, name, avatar, role, created_at FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

/**
 * Update a user's name and/or avatar.
 * Only updates fields that are explicitly provided (not undefined).
 */
async function updateProfile(id, { name, avatar }) {
  const setClauses = [];
  const params     = [];

  if (name   !== undefined) { params.push(name);   setClauses.push(`name = $${params.length}`); }
  if (avatar !== undefined) { params.push(avatar); setClauses.push(`avatar = $${params.length}`); }

  if (setClauses.length === 0) return null;

  params.push(new Date().toISOString());
  setClauses.push(`updated_at = $${params.length}`);

  params.push(id);

  const { rows } = await pool.query(
    `UPDATE users SET ${setClauses.join(', ')}
     WHERE id = $${params.length}
     RETURNING id, email, name, avatar, role`,
    params
  );
  return rows[0] || null;
}

/**
 * Change a user's role. Admin-only operation.
 */
async function updateRole(id, role) {
  const { rows } = await pool.query(
    `UPDATE users SET role = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, email, role`,
    [role, id]
  );
  return rows[0] || null;
}

/**
 * Delete a user by UUID. Admin-only operation.
 * Returns the number of deleted rows (0 = not found).
 */
async function deleteById(id) {
  const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [id]);
  return rowCount;
}

/**
 * Search users by name or email (case-insensitive).
 */
async function search(query) {
  const { rows } = await pool.query(
    `SELECT id, email, name, avatar
     FROM users
     WHERE name ILIKE $1 OR email ILIKE $1
     LIMIT 20`,
    [`%${query}%`]
  );
  return rows;
}

module.exports = { findAll, findById, updateProfile, updateRole, deleteById, search };