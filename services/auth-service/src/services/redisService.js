const redis = require('redis');
const crypto = require('crypto');

/**
 * redisService.js
 * Wraps all Redis operations for the auth-service.
 * Responsibilities:
 *   - Store JWT session hashes on login (enables logout-before-expiry)
 *   - Check session validity on /auth/validate
 *   - Delete session on /auth/logout
 */

let client;

/**
 * Connect to Redis. Called once at app startup.
 */
async function connect() {
  client = redis.createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  client.on('error', (err) => console.error('[Redis] Client error:', err));
  await client.connect();
  console.log('[Redis] Connected');
}

/**
 * Store a session when a JWT is issued.
 * Key:   session:<SHA-256 of token>
 * Value: userId
 * TTL:   1 hour (matches JWT expiry)
 */
async function saveSession(token, userId) {
  const hash = hashToken(token);
  await client.set(`session:${hash}`, userId, { EX: 3600 });
}

/**
 * Check if a session is still active.
 * Returns userId string if valid, null if expired or deleted (logged out).
 */
async function getSession(token) {
  const hash = hashToken(token);
  return client.get(`session:${hash}`);
}

/**
 * Delete a session (logout).
 */
async function deleteSession(token) {
  const hash = hashToken(token);
  return client.del(`session:${hash}`);
}

/**
 * SHA-256 hash of the token.
 * We store a hash (not the token itself) so Redis doesn't hold raw bearer tokens.
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { connect, saveSession, getSession, deleteSession };