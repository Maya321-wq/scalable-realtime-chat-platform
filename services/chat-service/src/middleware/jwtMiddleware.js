// // PLACEHOLDER — will be replaced when Issue #8 (Member A) merges
// //  allows local development and CI to run independently

// exports.authenticateJWT = (req, res, next) => {
//   // TODO: Replace with real JWT verification from auth-service
//   // Real implementation will:
//   // 1. Extract token from Authorization header
//   // 2. Verify with JWT_SECRET or public key
//   // 3. Attach decoded user to req.user
//   // 4. Return 401 if invalid/missing

//   // Mock user for development/testing
//   req.user = {
//     userId: 'test-user-123',
//     email: 'test@example.com',
//     role: 'user'
//   };
  
//   // Allow bypass via header for integration tests
//   if (req.headers['x-bypass-auth'] === 'true') {
//     req.user = { userId: req.headers['x-test-user-id'] || 'bypass-user' };
//   }
  
//   next();
// };



const jwt = require('jsonwebtoken');
const fs  = require('fs');

// Load public key once at startup — same key that auth-service uses to sign
const publicKey = fs.readFileSync(
  process.env.JWT_PUBLIC_KEY_PATH || './keys/public.pem'
);

/**
 * authenticateJWT — Express middleware
 * Validates RS256 JWT issued by the auth-service.
 * Attaches decoded payload to req.user.
 */
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    const payload = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
    req.user = payload;
    next();
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ error: message });
  }
}

// Keep verifyJWT as alias so nothing else in chat service breaks
const verifyJWT = authenticateJWT;

const ROLE_RANK = { user: 0, admin: 1 };

function requireRole(minRole) {
  return (req, res, next) => {
    const userRank = ROLE_RANK[req.user?.role] ?? -1;
    const minRank  = ROLE_RANK[minRole]         ?? 99;
    if (userRank < minRank) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authenticateJWT, verifyJWT, requireRole };
