const express  = require('express');
const passport = require('passport');
const { googleCallback, logout, validateToken, getPublicKey } = require('../controllers/authController');

const router = express.Router();

/**
 * GET /auth/google/login
 * Redirects the user to Google's OAuth2 consent screen.
 * Passport handles the redirect — no controller needed here.
 */
router.get(
  '/google/login',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

/**
 * GET /auth/google/callback
 * Google redirects here after consent.
 * Passport verifies the code and populates req.user.
 * Our controller then issues the JWT.
 */
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/auth/failure' }),
  googleCallback
);

/**
 * POST /auth/logout
 * Invalidates the current JWT by removing its hash from Redis.
 */
router.post('/logout', logout);

/**
 * POST /auth/validate
 * Validates a Bearer token (signature + Redis session check).
 * Called by API Gateway and other services.
 */
router.post('/validate', validateToken);

/**
 * GET /auth/public-key
 * Returns the RSA public key so other services can verify JWTs locally.
 */
router.get('/public-key', getPublicKey);

/**
 * GET /auth/failure
 * Fallback when Google OAuth fails.
 */
router.get('/failure', (_req, res) => res.status(401).json({ error: 'Google authentication failed' }));

module.exports = router;