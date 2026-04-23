// // Placeholder for Issue #14 (Redis caching)
// // Real implementation will use ioredis to cache message lists

// exports.cacheMessages = async (roomId, messages) => {
//   // TODO: Implement Redis SETEX with TTL
//   console.log(`[CACHE] Would cache ${messages.length} messages for room ${roomId}`);
// };

// exports.getCachedMessages = async (roomId) => {
//   // TODO: Implement Redis GET
//   return null; // Return null to skip cache during scaffold phase
// };

// exports.invalidateCache = async (roomId) => {
//   // TODO: Implement Redis DEL
//   console.log(`[CACHE] Would invalidate cache for room ${roomId}`);
// };


const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redis.on('error', (err) => console.error('[Redis] connection error:', err));
redis.on('connect', () => console.log('[Redis] connected'));

const CACHE_TTL = 300; // 5 minutes
const cacheKey = (roomId) => `messages:${roomId}`;

exports.getCachedMessages = async (roomId) => {
  try {
    const data = await redis.get(cacheKey(roomId));
    if (data) {
      console.log(`[Cache] HIT for room ${roomId}`);
      return JSON.parse(data);
    }
    console.log(`[Cache] MISS for room ${roomId}`);
    return null;
  } catch (err) {
    console.error('[Cache] get error:', err.message);
    return null;  // graceful degradation — don't crash if Redis is down
  }
};

exports.cacheMessages = async (roomId, messages) => {
  try {
    await redis.setex(cacheKey(roomId), CACHE_TTL, JSON.stringify(messages));
  } catch (err) {
    console.error('[Cache] set error:', err.message);
  }
};

exports.invalidateCache = async (roomId) => {
  try {
    await redis.del(cacheKey(roomId));
    console.log(`[Cache] invalidated for room ${roomId}`);
  } catch (err) {
    console.error('[Cache] invalidate error:', err.message);
  }
};

exports.redis = redis;
