const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');

// Routes
const roomRoutes = require('./routes/roomRoutes');
const messageRoutes = require('./routes/messageRoutes');

// Services & Publishers
const { initRabbitMQ } = require('./publishers/rabbitPublisher');
const socketHandler = require('./socket/socketHandler');

const app = express();
app.use(express.json());

// MongoDB connection: Support both local dev AND Docker Compose
const mongoUri = process.env.MONGODB_URI || 
                 process.env.MONGODB_URL || 
                 'mongodb://localhost:27017/chatdb';

mongoose.connect(mongoUri)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1); // Exit if DB fails to connect
  });

// Initialize RabbitMQ publisher (Issue #15)
initRabbitMQ().catch(err => console.error('[RabbitMQ] init failed:', err));

// Register routes
app.use('/rooms', roomRoutes);              // Room CRUD: POST/GET /rooms
app.use('/rooms', messageRoutes);           // Message CRUD: POST/GET /rooms/:roomId/messages
app.use('/', messageRoutes);                // Message CRUD: PUT/DELETE /messages/:messageId

// Health check endpoint (Docker healthchecks + CI)
app.get('/health', (req, res) => res.json({ 
  status: 'ok', 
  service: 'chat-service',
  timestamp: new Date().toISOString()
}));

// === Socket.io Setup (Issue #13) ===
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    // origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    origin: "*",  // Allow all origins for local testing
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Attach Socket.io handler (auth middleware + event listeners)
socketHandler(io);

// === Server Startup ===
const PORT = process.env.PORT || 3002;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Chat service running on port ${PORT}`);
  console.log(` Socket.io ready for real-time messaging`);
});

// === Graceful Shutdown (Docker/Kubernetes) ===
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  // Close Socket.io connections
  io.close(() => {
    console.log('Socket.io closed');
  });
  
  // Close HTTP server
  server.close(() => {
    console.log('HTTP server closed');
    
    // Close MongoDB connection
    mongoose.connection.close(() => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Export for testing
module.exports = { server, app, io };