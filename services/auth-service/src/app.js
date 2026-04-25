const express = require('express');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const { Pool } = require('pg');
const cors = require('cors');
const redisService = require('./services/redisService');

const app = express();
app.use(express.json());
app.use(cors());
app.use(passport.initialize());

// ─── DB ───────────────────────────────────────────────────────────────
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// ─── Keys ─────────────────────────────────────────────────────────────────────
const privateKey = fs.readFileSync(process.env.JWT_PRIVATE_KEY_PATH, "utf8");
const publicKey  = fs.readFileSync(process.env.JWT_PUBLIC_KEY_PATH, "utf8");

// ─── DB Init ──────────────────────────────────────────────────────────────────
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
}
initDB().catch(console.error);

// ─── Passport Google Strategy ─────────────────────────────────────────────────
passport.use(new GoogleStrategy(
  {
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  process.env.GOOGLE_CALLBACK_URL,
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const { rows } = await pool.query(
        `INSERT INTO users (google_id, email, name, avatar)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (google_id) DO UPDATE
           SET name = EXCLUDED.name, avatar = EXCLUDED.avatar
         RETURNING *`,
        [
          profile.id,
          profile.emails[0].value,
          profile.displayName,
          profile.photos?.[0]?.value,
        ]
      );
      return done(null, rows[0]);
    } catch (err) {
      return done(err);
    }
  }
));

// ─── Routes ───────────────────────────────────────────────────────────────────

// 1. Kick off Google login
app.get('/auth/google/login', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

// 2. Google callback — issue JWT
app.get(
  '/auth/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/auth/failure' }),
  async (req, res) => {
    const user = req.user;
    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role, name: user.name },
      privateKey,
      { algorithm: 'RS256', expiresIn: '1h' }
    );

    // Store session in Redis so we can invalidate on logout
    await redisService.saveSession(token, user.id);

    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  }
);

// 3. Logout — invalidate token
app.post('/auth/logout', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (token) {
    await redisService.deleteSession(token);
  }
  res.json({ message: 'Logged out' });
});

// 4. Validate token (called by API Gateway or other services)
app.post('/auth/validate', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const payload = jwt.verify(token, publicKey, { algorithms: ['RS256'] });

    // Check Redis — token may have been invalidated on logout
    const stored = await redisService.getSession(token);
    if (!stored) return res.status(401).json({ error: 'Token invalidated' });

    res.json({ valid: true, user: payload });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// 5. Expose public key so other services can verify JWTs locally
app.get('/auth/public-key', (_req, res) => {
  res.type('text/plain').send(publicKey);
});

app.get('/auth/failure', (_req, res) => res.status(401).json({ error: 'Google auth failed' }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

module.exports = app;