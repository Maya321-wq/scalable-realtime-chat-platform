const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const { verifyJWT, requireRole } = require('./middleware/jwtMiddleware');

const app = express();
app.use(express.json());
app.use(cors());

// ─── DB ───────────────────────────────────────────────────────────────────────
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

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
}
initDB().catch(console.error);

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /users — list all users (admin only, with search)
app.get('/users', verifyJWT, requireRole('admin'), async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let queryText = 'SELECT id, email, name, avatar, role, created_at FROM users';
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      queryText += ` WHERE name ILIKE $1 OR email ILIKE $1`;
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit), offset);

    const { rows } = await pool.query(queryText, params);
    res.json({ users: rows, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /users/me — current user profile
app.get('/users/me', verifyJWT, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, name, avatar, role, created_at FROM users WHERE id = $1',
      [req.user.sub]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /users/:id — get a specific user
app.get('/users/:id', verifyJWT, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, name, avatar, role, created_at FROM users WHERE id = $1',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /users/me — update own profile
app.patch('/users/me', verifyJWT, async (req, res) => {
  try {
    const { name, avatar } = req.body;

    // Build dynamic SET clause — only update provided fields
    const updates = [];
    const params  = [];
    if (name   !== undefined) { params.push(name);   updates.push(`name = $${params.length}`); }
    if (avatar !== undefined) { params.push(avatar); updates.push(`avatar = $${params.length}`); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(new Date().toISOString());
    updates.push(`updated_at = $${params.length}`);

    params.push(req.user.sub);
    const { rows } = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING id, email, name, avatar, role`,
      params
    );

    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /users/:id/role — admin-only: change user role
app.patch('/users/:id/role', verifyJWT, requireRole('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be "user" or "admin"' });
    }

    const { rows } = await pool.query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, role',
      [role, req.params.id]
    );

    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /users/:id — admin only
app.delete('/users/:id', verifyJWT, requireRole('admin'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'User not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /users/search — search by name or email
app.get('/users/search', verifyJWT, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Query param "q" is required' });

    const { rows } = await pool.query(
      `SELECT id, email, name, avatar FROM users
       WHERE name ILIKE $1 OR email ILIKE $1
       LIMIT 20`,
      [`%${q}%`]
    );
    res.json({ users: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

module.exports = app;