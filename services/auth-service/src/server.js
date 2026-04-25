/**
 * server.js
 * Entry point for the auth-service.
 * Separates app initialization from server startup.
 * This allows tests to import the app without triggering the server.
 */

const app = require('./app');
const redisService = require('./services/redisService');

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    // Connect to Redis before starting the server
    await redisService.connect();
    
    // Start the Express server
    app.listen(PORT, () => {
      console.log(`[Auth Service] Listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('[Auth Service] Failed to start:', err);
    process.exit(1);
  }
}

// Only start if this is the main module (not imported by tests)
if (require.main === module) {
  start();
}

module.exports = { start };
