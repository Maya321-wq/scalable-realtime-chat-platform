const jwt = require('jsonwebtoken');
const fs  = require('fs');
const redisService = require('../services/redisService');

// Load the RS256 private and public keys once at startup
const privateKey = fs.readFileSync(process.env.JWT_PRIVATE_KEY_PATH || './keys/private.pem');
const publicKey  = fs.readFileSync(process.env.JWT_PUBLIC_KEY_PATH  || './keys/public.pem');

/**
 * googleCallback
 * Called after Passport successfully authenticates via Google OAuth2.
 * req.user is already set by Passport with the DB user row.
 *
 * 1. Signs a JWT (RS256, 1-hour expiry)
 * 2. Stores a session hash in Redis
 * 3. Returns { token, user } to the client
 */
async function googleCallback(req, res) {
  try {
    const user = req.user;

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role, name: user.name },
      privateKey,
      { algorithm: 'RS256', expiresIn: '1h' }
    );

    await redisService.saveSession(token, user.id);

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error('[Auth] googleCallback error:', err);
    res.status(500).json({ error: 'Failed to issue token' });
  }
}

/**
 * logout
 * Deletes the session hash from Redis — invalidates the JWT before natural expiry.
 */
async function logout(req, res) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      await redisService.deleteSession(token);
    }
    res.json({ message: 'Logged out' });
  } catch (err) {
    console.error('[Auth] logout error:', err);
    res.status(500).json({ error: 'Logout failed' });
  }
}

/**
 * validateToken
 * Called by the API Gateway or other services to verify a JWT.
 * Checks BOTH the RS256 signature AND the Redis session store.
 */
async function validateToken(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'No token' });
  }

  try {
    // Step 1: Verify RS256 signature and expiry
    const payload = jwt.verify(token, publicKey, { algorithms: ['RS256'] });

    // Step 2: Check Redis — token may have been invalidated by logout
    const sessionUserId = await redisService.getSession(token);
    if (!sessionUserId) {
      return res.status(401).json({ error: 'Token invalidated' });
    }

    res.json({ valid: true, user: payload });
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    res.status(401).json({ error: message });
  }
}

/**
 * getPublicKey
 * Returns the RSA public key so other services can verify JWTs locally.
 */
function getPublicKey(_req, res) {
  res.type('text/plain').send(publicKey);
}

module.exports = { googleCallback, logout, validateToken, getPublicKey };