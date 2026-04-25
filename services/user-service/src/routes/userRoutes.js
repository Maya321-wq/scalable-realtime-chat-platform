const express = require('express');
const { verifyJWT, requireRole } = require('../middleware/jwtMiddleware');
const {
  listUsers,
  getMe,
  getUserById,
  updateMe,
  updateRole,
  deleteUser,
  searchUsers,
} = require('../controllers/userController');

const router = express.Router();

/**
 * All routes require a valid JWT.
 * Some additionally require the 'admin' role.
 *
 * Route order matters in Express:
 * /users/me and /users/search must come BEFORE /users/:id
 * or Express will try to match "me" and "search" as UUIDs.
 */

// ── Public (any authenticated user) ─────────────────────────────────────────

/** GET  /users/me       — own profile */
router.get('/me',     verifyJWT, getMe);

/** PATCH /users/me      — update own name/avatar */
router.patch('/me',   verifyJWT, updateMe);

/** GET  /users/search   — search by name or email */
router.get('/search', verifyJWT, searchUsers);

/** GET  /users/:id      — get any user's profile */
router.get('/:id',    verifyJWT, getUserById);

// ── Admin only ───────────────────────────────────────────────────────────────

/** GET  /users          — list all users (paginated) */
router.get('/',       verifyJWT, requireRole('admin'), listUsers);

/** PATCH /users/:id/role — change a user's role */
router.patch('/:id/role', verifyJWT, requireRole('admin'), updateRole);

/** DELETE /users/:id   — delete a user */
router.delete('/:id', verifyJWT, requireRole('admin'), deleteUser);

module.exports = router;