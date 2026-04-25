/**
 * Integration tests for auth-service — CLEAN FIXED VERSION
 */

// ── RSA key injection ─────────────────────────────────────────────────────────
jest.mock('fs', () => {
  const crypto = require('crypto');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });

  const priv = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const pub  = publicKey.export({ type: 'spki', format: 'pem' });

  return {
    readFileSync: jest.fn((path) => {
      if (String(path).includes('private')) return priv;
      return pub;
    }),
  };
});

// ── pg mock ───────────────────────────────────────────────────────────────────
const mockPgQuery = jest.fn().mockResolvedValue({ rows: [] });

jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    query: mockPgQuery,
  })),
}));

// ── Redis SERVICE MOCK (MUST BE BEFORE app import) ───────────────────────────
jest.mock('../../src/services/redisService', () => ({
  connect: jest.fn().mockResolvedValue(undefined),
  saveSession: jest.fn(),
  getSession: jest.fn(),
  deleteSession: jest.fn(),
}));

// ✅ MUST come immediately after mock
//const mockRedisService = require('../../src/services/redisService');

// ── passport mock ─────────────────────────────────────────────────────────────
jest.mock('passport', () => {
  const original = jest.requireActual('passport');

  return {
    ...original,
    authenticate: jest.fn((_strategy, _opts, cb) => (req, res, next) => {
      req.user = {
        id: 'user-uuid-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };

      if (cb) cb(null, req.user, null);
      else next();
    }),
    use: jest.fn(),
    initialize: jest.fn(() => (_req, _res, next) => next()),
  };
});

// ── ENV ───────────────────────────────────────────────────────────────────────
process.env.JWT_PRIVATE_KEY_PATH = './keys/private.pem';
process.env.JWT_PUBLIC_KEY_PATH  = './keys/public.pem';
process.env.POSTGRES_URL         = 'postgresql://test:test@localhost/test';
process.env.REDIS_URL            = 'redis://localhost:6379';
process.env.GOOGLE_CLIENT_ID     = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';

// ── APP (MUST BE LAST IMPORT) ─────────────────────────────────────────────────
const request = require('supertest');
const app     = require('../../src/app');
const mockRedisService = require('../../src/services/redisService');

// ── RESET MOCK STATE ──────────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
});

// ── TESTS ─────────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /auth/google/callback', () => {
  it('returns a JWT token and user', async () => {
    const res = await request(app).get('/auth/google/callback');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.token.split('.').length).toBe(3);
    expect(res.body.user.email).toBe('test@example.com');
  });

  it('saves session to Redis on login', async () => {
    await request(app).get('/auth/google/callback');

    expect(mockRedisService.saveSession).toHaveBeenCalledTimes(1);
    expect(mockRedisService.saveSession.mock.calls[0][1]).toBe('user-uuid-1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /auth/validate', () => {
  let validToken;

  beforeAll(async () => {
    mockRedisService.saveSession.mockResolvedValue(undefined);

    const res = await request(app).get('/auth/google/callback');
    validToken = res.body.token;
  });

  it('returns valid:true when session active', async () => {
    mockRedisService.getSession.mockResolvedValue('user-uuid-1');

    const res = await request(app)
      .post('/auth/validate')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
  });

  it('returns 401 when session deleted (logout)', async () => {
    mockRedisService.getSession.mockResolvedValue(null);

    const res = await request(app)
      .post('/auth/validate')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token invalidated');
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).post('/auth/validate');

    expect(res.status).toBe(401);
  });
});
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /auth/logout', () => {
  beforeEach(() => {
    mockRedisService.deleteSession.mockReset();
  });

  it('calls deleteSession and returns 200', async () => {
    mockRedisService.deleteSession.mockResolvedValue(1);

    const res = await request(app)
      .post('/auth/logout')
      .set('Authorization', 'Bearer some-token');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged out');
    expect(mockRedisService.deleteSession).toHaveBeenCalledTimes(1);
  });

  it('returns 200 even with no token (idempotent logout)', async () => {
    mockRedisService.deleteSession.mockResolvedValue(1);

    const res = await request(app).post('/auth/logout');

    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /auth/public-key', () => {
  it('returns PEM public key', async () => {
    const res = await request(app).get('/auth/public-key');

    expect(res.status).toBe(200);
    expect(res.text).toContain('PUBLIC KEY');
  });
});