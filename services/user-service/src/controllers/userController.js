const User = require('../models/User');

/**
 * userController.js
 * Handles HTTP request/response logic for all user endpoints.
 * Delegates data access entirely to the User model.
 */

/**
 * GET /users
 * List all users. Admin only.
 * Supports ?q=search&page=1&limit=20
 */
async function listUsers(req, res) {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const users  = await User.findAll({ search: q, limit: Number(limit), offset });
    res.json({ users, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('[User] listUsers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /users/me
 * Returns the profile of the currently authenticated user.
 * req.user is set by verifyJWT middleware.
 */
async function getMe(req, res) {
  try {
    const user = await User.findById(req.user.sub);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('[User] getMe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /users/:id
 * Get a specific user by UUID.
 */
async function getUserById(req, res) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('[User] getUserById error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PATCH /users/me
 * Update own profile (name and/or avatar).
 */
async function updateMe(req, res) {
  try {
    const { name, avatar } = req.body;

    // Reject if neither field is provided
    if (name === undefined && avatar === undefined) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const updated = await User.updateProfile(req.user.sub, { name, avatar });
    if (!updated) return res.status(404).json({ error: 'User not found' });
    res.json(updated);
  } catch (err) {
    console.error('[User] updateMe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PATCH /users/:id/role
 * Change a user's role. Admin only.
 */
async function updateRole(req, res) {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be "user" or "admin"' });
    }

    const updated = await User.updateRole(req.params.id, role);
    if (!updated) return res.status(404).json({ error: 'User not found' });
    res.json(updated);
  } catch (err) {
    console.error('[User] updateRole error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * DELETE /users/:id
 * Delete a user. Admin only.
 */
async function deleteUser(req, res) {
  try {
    const deleted = await User.deleteById(req.params.id);
    if (deleted === 0) return res.status(404).json({ error: 'User not found' });
    res.status(204).send();
  } catch (err) {
    console.error('[User] deleteUser error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /users/search?q=term
 * Search users by name or email. Returns up to 20 matches.
 */
async function searchUsers(req, res) {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Query param "q" is required' });
    const users = await User.search(q);
    res.json({ users });
  } catch (err) {
    console.error('[User] searchUsers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { listUsers, getMe, getUserById, updateMe, updateRole, deleteUser, searchUsers };