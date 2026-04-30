const isTest = process.env.NODE_ENV === 'test';

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

// =========================
// MongoDB Connection
// =========================
const mongoUri =
  process.env.MONGODB_URI ||
  process.env.MONGODB_URL ||
  'mongodb://localhost:27017/chatdb';

if (!isTest) {
  mongoose.connect(mongoUri)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => {
      console.error('❌ MongoDB connection error:', err);
      process.exit(1);
    });
}

// =========================
// RabbitMQ Init
// =========================
if (!isTest) {
  initRabbitMQ().catch(err =>
    console.error('[RabbitMQ] init failed:', err)
  );
}

// =========================
// Routes
// =========================
app.use('/rooms', roomRoutes);
app.use('/rooms', messageRoutes);
app.use('/', messageRoutes);

// =========================
// Health Check
// =========================
app.get('/health', (req, res) =>
  res.json({
    status: 'ok',
    service: 'chat-service',
    timestamp: new Date().toISOString(),
  })
);

// =========================
// HTTP + Socket Server
// =========================
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Socket.io
if (!isTest) {
  socketHandler(io);
}

// =========================
// Start Server
// =========================
const PORT = process.env.PORT || 3002;

if (!isTest) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Chat service running on port ${PORT}`);
    console.log(' Socket.io ready for real-time messaging');
  });
}

// =========================
// Graceful Shutdown
// =========================
if (!isTest) {
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');

    io.close(() => {
      console.log('Socket.io closed');
    });

    server.close(() => {
      console.log('HTTP server closed');

      mongoose.connection.close(() => {
        console.log('MongoDB connection closed');
        process.exit(0);
      });
    });
  });
}

// =========================
// Crash Handlers (prod only)
// =========================
if (!isTest) {
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
}

// =========================
// Export (for tests)
// =========================
module.exports = { server, app, io };