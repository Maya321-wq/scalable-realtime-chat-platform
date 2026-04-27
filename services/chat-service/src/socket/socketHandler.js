// const jwt = require('jsonwebtoken');
// const fs = require('fs');
// const path = require('path');
// const { createAdapter } = require('@socket.io/redis-adapter');
// const { redis } = require('../services/cacheService');
// const Message = require('../models/Message');
// const { invalidateCache } = require('../services/cacheService');
// const { publishMessageCreated } = require('../publishers/rabbitPublisher');

// // JWT verification: Try RSA public key first, fallback to HS256 secret for local dev
// const JWT_PUBLIC_KEY_PATH = process.env.JWT_PUBLIC_KEY_PATH || './keys/public.pem';
// const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// let publicKey = null;
// let useRS256 = false;

// try {
//   publicKey = fs.readFileSync(path.resolve(__dirname, JWT_PUBLIC_KEY_PATH));
//   useRS256 = true;
//   console.log('[Socket.io] ✅ Using RS256 JWT verification');
// } catch (err) {
//   console.warn(`[Socket.io] ⚠️  Public key not found (${JWT_PUBLIC_KEY_PATH}), falling back to HS256 secret for local dev`);
//   console.warn('[Socket.io] ⚠️  Set JWT_PUBLIC_KEY_PATH env var to use RS256 in production');
// }

// const verifyToken = async (token) => {
//   if (!token) throw new Error('No token');
//   const clean = token.replace('Bearer ', '');
  
//   let decoded;
//   if (useRS256 && publicKey) {
//     decoded = jwt.verify(clean, publicKey, { algorithms: ['RS256'] });
//   } else {
//     // Fallback for local dev: use HS256 with secret
//     decoded = jwt.verify(clean, JWT_SECRET, { algorithms: ['HS256'] });
//   }

//   // Check Redis invalidation (same logic as HTTP middleware)
//   const crypto = require('crypto');
//   const hash = crypto.createHash('sha256').update(clean).digest('hex');
//   const invalidated = await redis.get(`invalidated:${hash}`);
//   if (invalidated) throw new Error('Token invalidated');

//   return decoded;
// };

// module.exports = (io) => {
//   // Enable Redis adapter for multi-instance broadcasting
//   if (process.env.NODE_ENV !== 'test') {
//     io.adapter(createAdapter(redis, redis.duplicate()));
//     console.log('[Socket.io] ✅ Redis adapter enabled for multi-instance broadcasting');
//   }

//   // Auth middleware for every socket connection
//   io.use(async (socket, next) => {
//     try {
//       const token = socket.handshake.auth?.token;
//       socket.user = await verifyToken(token);
//       next();
//     } catch (err) {
//       console.warn(`[Socket.io] Auth failed: ${err.message}`);
//       next(new Error('Authentication failed'));
//     }
//   });

//   io.on('connection', (socket) => {
//     console.log(`[Socket] ✅ user connected: ${socket.user.userId}`);

//     socket.on('join-room', (roomId) => {
//       socket.join(roomId);
//       console.log(`[Socket] ${socket.user.userId} joined room ${roomId}`);
//       socket.to(roomId).emit('user-joined', {
//         userId: socket.user.userId,
//         roomId,
//       });
//     });

//     socket.on('leave-room', (roomId) => {
//       socket.leave(roomId);
//       socket.to(roomId).emit('user-left', {
//         userId: socket.user.userId,
//         roomId,
//       });
//     });

//     socket.on('send-message', async ({ roomId, content }) => {
//       try {
//         const message = await Message.create({
//           roomId,
//           userId: socket.user.userId,
//           content,
//         });

//         // Broadcast to everyone in the room (Redis adapter handles multi-instance)
//         io.to(roomId).emit('message-received', {
//           _id: message._id,
//           roomId,
//           userId: socket.user.userId,
//           content,
//           createdAt: message.createdAt.toISOString(),
//         });

//         // Reuse existing cache + RabbitMQ logic
//         await invalidateCache(roomId);
//         await publishMessageCreated({
//           roomId,
//           userId: socket.user.userId,
//           messageId: message._id.toString(),
//           timestamp: message.createdAt.toISOString(),
//         });
//       } catch (err) {
//         console.error(`[Socket] send-message error: ${err.message}`);
//         socket.emit('error', { message: err.message });
//       }
//     });

//     socket.on('disconnect', () => {
//       console.log(`[Socket] user disconnected: ${socket.user.userId}`);
//     });
//   });
// };


const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { createAdapter } = require('@socket.io/redis-adapter');
const { redis } = require('../services/cacheService');
const Message = require('../models/Message');
const { invalidateCache } = require('../services/cacheService');
const { publishMessageCreated } = require('../publishers/rabbitPublisher');

// ✅ Load public key ONLY (RS256)
const publicKey = fs.readFileSync(
  path.resolve(__dirname, process.env.JWT_PUBLIC_KEY_PATH || './keys/public.pem')
);

// ✅ Simplified verification (matches Member A)
const verifyToken = (token) => {
  if (!token) throw new Error('No token provided');

  const clean = token.startsWith('Bearer ')
    ? token.slice(7)
    : token;

  return jwt.verify(clean, publicKey, { algorithms: ['RS256'] });
};

module.exports = (io) => {
  // ✅ Redis adapter (unchanged)
  if (process.env.NODE_ENV !== 'test') {
    io.adapter(createAdapter(redis, redis.duplicate()));
    console.log('[Socket.io] ✅ Redis adapter enabled for multi-instance broadcasting');
  }

  // ✅ Auth middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      socket.user = verifyToken(token);
      next();
    } catch (err) {
      console.warn(`[Socket.io] Auth failed: ${err.message}`);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] ✅ user connected: ${socket.user.userId}`);

    socket.on('join-room', (roomId) => {
      socket.join(roomId);
      console.log(`[Socket] ${socket.user.userId} joined room ${roomId}`);
      socket.to(roomId).emit('user-joined', {
        userId: socket.user.userId,
        roomId,
      });
    });

    socket.on('leave-room', (roomId) => {
      socket.leave(roomId);
      socket.to(roomId).emit('user-left', {
        userId: socket.user.userId,
        roomId,
      });
    });

    socket.on('send-message', async ({ roomId, content }) => {
      try {
        const message = await Message.create({
          roomId,
          userId: socket.user.userId,
          content,
        });

        io.to(roomId).emit('message-received', {
          _id: message._id,
          roomId,
          userId: socket.user.userId,
          content,
          createdAt: message.createdAt.toISOString(),
        });

        await invalidateCache(roomId);

        await publishMessageCreated({
          roomId,
          userId: socket.user.userId,
          messageId: message._id.toString(),
          timestamp: message.createdAt.toISOString(),
        });
      } catch (err) {
        console.error(`[Socket] send-message error: ${err.message}`);
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] user disconnected: ${socket.user.userId}`);
    });
  });
};
