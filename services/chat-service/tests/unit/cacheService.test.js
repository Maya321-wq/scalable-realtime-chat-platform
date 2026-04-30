/**
 * Clean Unit Tests for Cache Service
 */

const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  on: jest.fn(),
};

// Mock ioredis ONCE
jest.mock('ioredis', () => {
  return jest.fn(() => mockRedis);
});

const {
  getCachedMessages,
  cacheMessages,
  invalidateCache,
  redis,
} = require('../../src/services/cacheService');

afterEach(() => {
  jest.clearAllMocks();
});

describe('getCachedMessages', () => {
  test('returns parsed data on cache HIT', async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify([{ content: 'hi' }]));

    const result = await getCachedMessages('room-1');

    expect(Array.isArray(result)).toBe(true);
    expect(mockRedis.get).toHaveBeenCalled();
  });

  test('returns null on cache MISS', async () => {
    mockRedis.get.mockResolvedValue(null);

    const result = await getCachedMessages('room-1');

    expect(result).toBeNull();
  });

  test('returns null when Redis fails', async () => {
    mockRedis.get.mockRejectedValue(new Error('connection refused'));

    const result = await getCachedMessages('room-1');

    expect(result).toBeNull();
  });
});

describe('cacheMessages', () => {
  test('calls setex with correct key and TTL', async () => {
    mockRedis.setex.mockResolvedValue('OK');

    await cacheMessages('room-1', [{ content: 'hi' }]);

    expect(mockRedis.setex).toHaveBeenCalledWith(
      'messages:room-1',
      300,
      expect.any(String)
    );
  });

  test('does not throw when Redis fails', async () => {
    mockRedis.setex.mockRejectedValue(new Error('connection refused'));

    await expect(
      cacheMessages('room-1', [{ content: 'hi' }])
    ).resolves.not.toThrow();
  });
});

describe('invalidateCache', () => {
  test('calls del with correct key', async () => {
    mockRedis.del.mockResolvedValue(1);

    await invalidateCache('room-1');

    expect(mockRedis.del).toHaveBeenCalledWith('messages:room-1');
  });

  test('does not throw when Redis fails', async () => {
    mockRedis.del.mockRejectedValue(new Error('connection refused'));

    await expect(invalidateCache('room-1')).resolves.not.toThrow();
  });
});