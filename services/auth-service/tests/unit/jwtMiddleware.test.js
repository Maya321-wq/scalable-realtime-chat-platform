/**
 * Unit tests for jwtMiddleware.js
 * These tests run in isolation — no real Redis, no real DB.
 * We mock jsonwebtoken to control what verify() returns.
 */
const { verifyJWT, requireRole } = require('../../src/middleware/jwtMiddleware');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeReq(token) {
  return { headers: { authorization: token ? `Bearer ${token}` : '' } };
}

function makeRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json   = jest.fn(() => res);
  return res;
}

// ─── Mock jwt & fs ────────────────────────────────────────────────────────────
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));
jest.mock('fs', () => ({ readFileSync: jest.fn(() => 'mock-public-key') }));

const jwt = require('jsonwebtoken');

// ─── verifyJWT ────────────────────────────────────────────────────────────────
describe('verifyJWT middleware', () => {
  beforeEach(() => jest.clearAllMocks());

  test('calls next() and sets req.user when token is valid', () => {
    const payload = { sub: 'user-1', email: 'a@b.com', role: 'user' };
    jwt.verify.mockReturnValue(payload);

    const req  = makeReq('valid-token');
    const res  = makeRes();
    const next = jest.fn();

    verifyJWT(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual(payload);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('returns 401 when Authorization header is missing', () => {
    const req  = makeReq(null);
    const res  = makeRes();
    const next = jest.fn();

    verifyJWT(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 with "Token expired" when TokenExpiredError is thrown', () => {
    const err  = new Error('jwt expired');
    err.name   = 'TokenExpiredError';
    jwt.verify.mockImplementation(() => { throw err; });

    const req  = makeReq('expired-token');
    const res  = makeRes();
    const next = jest.fn();

    verifyJWT(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token expired' });
  });

  test('returns 401 with "Invalid token" for other jwt errors', () => {
    jwt.verify.mockImplementation(() => { throw new Error('bad signature'); });

    const req  = makeReq('tampered-token');
    const res  = makeRes();
    const next = jest.fn();

    verifyJWT(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
  });
});

// ─── requireRole ─────────────────────────────────────────────────────────────
describe('requireRole middleware', () => {
  test('calls next() when user has exactly the required role', () => {
    const req  = { user: { role: 'admin' } };
    const res  = makeRes();
    const next = jest.fn();

    requireRole('admin')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test('calls next() when user role is higher than required', () => {
    // admin satisfies requireRole('user') since admin rank > user rank
    const req  = { user: { role: 'admin' } };
    const res  = makeRes();
    const next = jest.fn();

    requireRole('user')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test('returns 403 when user role is insufficient', () => {
    const req  = { user: { role: 'user' } };
    const res  = makeRes();
    const next = jest.fn();

    requireRole('admin')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 when req.user is undefined', () => {
    const req  = {};
    const res  = makeRes();
    const next = jest.fn();

    requireRole('user')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});