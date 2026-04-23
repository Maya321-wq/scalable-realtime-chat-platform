const express = require('express');
const mongoose = require('mongoose');
const roomRoutes = require('./routes/roomRoutes');

const app = express();
app.use(express.json());

// MongoDB connection: Support both local dev AND Docker Compose
// Priority: MONGODB_URI (Docker) → MONGODB_URL (local) → localhost fallback
const mongoUri = process.env.MONGODB_URI || 
                 process.env.MONGODB_URL || 
                 'mongodb://localhost:27017/chatdb';

mongoose.connect(mongoUri)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Register room routes
app.use('/rooms', roomRoutes);

// Health check endpoint (useful for Docker healthchecks + CI)
app.get('/health', (req, res) => res.json({ 
  status: 'ok', 
  service: 'chat-service',
  timestamp: new Date().toISOString()
}));

// Graceful shutdown for Docker/Kubernetes
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Chat service running on port ${PORT}`);
});