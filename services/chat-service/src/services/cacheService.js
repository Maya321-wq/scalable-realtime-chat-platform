const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// ✅ Prevent Jest "log after tests are done"
if (process.env.NODE_ENV !== 'test') {
  redis.on('connect', () => console.log('[Redis] connected'));
  redis.on('error', (err) =>
    console.error('[Redis] connection error:', err)
  );
}

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
    return null;
  }
};

exports.cacheMessages = async (roomId, messages) => {
  try {
    await redis.setex(
      cacheKey(roomId),
      CACHE_TTL,
      JSON.stringify(messages)
    );
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