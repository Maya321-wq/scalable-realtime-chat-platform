// PLACEHOLDER — will be replaced when Issue #8 (Member A) merges
//  allows local development and CI to run independently

exports.authenticateJWT = (req, res, next) => {
  // TODO: Replace with real JWT verification from auth-service
  // Real implementation will:
  // 1. Extract token from Authorization header
  // 2. Verify with JWT_SECRET or public key
  // 3. Attach decoded user to req.user
  // 4. Return 401 if invalid/missing

  // Mock user for development/testing
  req.user = {
    userId: 'test-user-123',
    email: 'test@example.com',
    role: 'user'
  };
  
  // Allow bypass via header for integration tests
  if (req.headers['x-bypass-auth'] === 'true') {
    req.user = { userId: req.headers['x-test-user-id'] || 'bypass-user' };
  }
  
  next();
};
