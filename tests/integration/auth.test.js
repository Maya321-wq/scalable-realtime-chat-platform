/**
 * Cross-service integration tests (tests/integration/)
 *
 * These tests verify that the auth-service JWT is correctly accepted
 * by the user-service — simulating the real inter-service contract.
 *
 * No running containers needed: we mock pg, redis, and google oauth.
 * The real RS256 key pair is generated fresh each test run.
 */

// ─── Shared RSA key pair ──────────────────────────────────────────────────────
const crypto = require('crypto');
const { privateKey: RSA_PRIV, publicKey: RSA_PUB } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM_PRIV = RSA_PRIV.export({ type: 'pkcs8', format: 'pem' });
const PEM_PUB  = RSA_PUB.export({ type: 'spki', format: 'pem' });

// ─── Inject keys via fs mock (must happen before any require of the services) ─
jest.mock('fs', () => {
  const real = jest.requireActual('fs');
  return {
    ...real,
    readFileSync: jest.fn((path) => {
      if (String(path).includes('private')) return PEM_PRIV;
      if (String(path).includes('public'))  return PEM_PUB;
      return real.readFileSync(path);
    }),
  };
});

// ─── Mock pg ──────────────────────────────────────────────────────────────────
const authDbQuery  = jest.fn();
const userDbQuery  = jest.fn();

jest.mock('pg', () => {
  let callCount = 0;
  return {
    Pool: jest.fn(() => {
      callCount++;
      if (callCount === 1) return { query: authDbQuery };  // auth-service
      return            { query: userDbQuery };             // user-service
    }),
  };
});

// ─── Mock redis ───────────────────────────────────────────────────────────────
const redisMock = {
  connect: jest.fn().mockResolvedValue(undefined),
  set:     jest.fn().mockResolvedValue('OK'),
  get:     jest.fn().mockResolvedValue('user-uuid-1'),   // valid session by default
  del:     jest.fn().mockResolvedValue(1),
};
jest.mock('redis', () => ({ createClient: jest.fn(() => redisMock) }));

// ─── Mock passport ────────────────────────────────────────────────────────────
jest.mock('passport', () => {
  const original = jest.requireActual('passport');
  return {
    ...original,
    authenticate: jest.fn((_strategy, _opts, cb) => (req, res, next) => {
      req.user = { id: 'user-uuid-1', email: 'cross@test.com', name: 'Cross Test', role: 'user' };
      if (cb) cb(null, req.user, null);
      else next();
    }),
    use:        jest.fn(),
    initialize: jest.fn(() => (_req, _res, next) => next()),
  };
});

process.env.JWT_PRIVATE_KEY_PATH = './keys/private.pem';
process.env.JWT_PUBLIC_KEY_PATH  = './keys/public.pem';
process.env.POSTGRES_URL         = 'postgresql://test:test@localhost/test';
process.env.REDIS_URL            = 'redis://localhost:6379';

const request  = require('supertest');
const authApp  = require('../../services/auth-service/src/app');
const userApp  = require('../../services/user-service/src/app');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Cross-service flow: auth token accepted by user-service', () => {
  let token;

  beforeAll(async () => {
    // Setup pg mocks
    authDbQuery.mockResolvedValue({ rows: [] });
    userDbQuery.mockResolvedValue({ rows: [] });

    // Step 1: obtain a JWT from the auth service
    const res = await request(authApp).get('/auth/google/callback');
    expect(res.status).toBe(200);
    token = res.body.token;
    expect(token).toBeTruthy();
  });

  it('user-service returns 200 /users/me when auth token is presented', async () => {
    const fakeUser = { id: 'user-uuid-1', email: 'cross@test.com', name: 'Cross Test', role: 'user', created_at: new Date().toISOString() };
    userDbQuery.mockResolvedValue({ rows: [fakeUser] });

    const res = await request(userApp)
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('cross@test.com');
  });

  it('user-service returns 401 when no token is provided', async () => {
    const res = await request(userApp).get('/users/me');
    expect(res.status).toBe(401);
  });

  it('user-service returns 401 for a tampered token', async () => {
    const tampered = token.slice(0, -5) + 'XXXXX';
    const res = await request(userApp)
      .get('/users/me')
      .set('Authorization', `Bearer ${tampered}`);
    expect(res.status).toBe(401);
  });

  it('RBAC: user role cannot access admin endpoint in user-service', async () => {
    const res = await request(userApp)
      .delete('/users/some-other-user')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});