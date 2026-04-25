/**
 * server.js
 * Entry point for the user-service.
 * Separates app initialization from server startup.
 * This allows tests to import the app without triggering the server.
 */

const app = require('./app');

const PORT = process.env.PORT || 3003;

async function start() {
  try {
    // Start the Express server
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[User Service] Listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('[User Service] Failed to start:', err);
    process.exit(1);
  }
}

// Only start if this is the main module (not imported by tests)
if (require.main === module) {
  start();
}

module.exports = { start };
