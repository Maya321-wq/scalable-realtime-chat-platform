/**
 * Minimal Unit Tests for RabbitMQ Publisher (Issue #15 + #16)
 * Fixed for CI stability (mocking + module isolation)
 */

const mockChannel = {
  assertExchange: jest.fn().mockResolvedValue(undefined),
  publish: jest.fn(),
};

const mockConn = {
  createChannel: jest.fn().mockResolvedValue(mockChannel),
  on: jest.fn(),
};

// Mock amqplib globally
jest.mock('amqplib', () => ({
  connect: jest.fn().mockResolvedValue(mockConn),
}));

let initRabbitMQ, publishMessageCreated;

// 🔥 CRITICAL: Reset module state before each test
beforeEach(() => {
  jest.resetModules();

  const publisher = require('../../src/publishers/rabbitPublisher');
  initRabbitMQ = publisher.initRabbitMQ;
  publishMessageCreated = publisher.publishMessageCreated;
});

// Clean mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});

describe('initRabbitMQ', () => {
  test('connects and asserts exchange', async () => {
    await initRabbitMQ();

    expect(mockConn.createChannel).toHaveBeenCalled();
    expect(mockChannel.assertExchange).toHaveBeenCalledWith(
      'chat.events',
      'topic',
      { durable: true }
    );
  });
});

describe('publishMessageCreated', () => {
  beforeEach(async () => {
    const amqplib = require('amqplib');
    amqplib.connect.mockResolvedValue(mockConn);

    await initRabbitMQ();
  });

  test('publishes with correct exchange and routing key', async () => {
    const payload = {
      roomId: 'r1',
      userId: 'u1',
      messageId: 'm1',
      timestamp: new Date().toISOString(),
    };

    await publishMessageCreated(payload);

    expect(mockChannel.publish).toHaveBeenCalledWith(
      'chat.events',
      'message.created',
      expect.any(Buffer),
      { persistent: true }
    );
  });

  test('stringifies payload as Buffer', async () => {
    const payload = {
      roomId: 'r1',
      userId: 'u1',
      messageId: 'm1',
      timestamp: '2026-01-01T00:00:00.000Z',
    };

    await publishMessageCreated(payload);

    const bufferArg = mockChannel.publish.mock.calls[0][2];

    expect(Buffer.isBuffer(bufferArg)).toBe(true);

    const parsed = JSON.parse(bufferArg.toString());
    expect(parsed.timestamp).toBe('2026-01-01T00:00:00.000Z');
  });

  test('does not throw when channel is null', async () => {
    const publisher = require('../../src/publishers/rabbitPublisher');

    // Simulate missing channel
    publisher.channel = null;

    await expect(
      publishMessageCreated({ roomId: 'r1' })
    ).resolves.not.toThrow();
  });

  test('does not throw when publish fails', async () => {
    mockChannel.publish.mockImplementation(() => {
      throw new Error('Publish failed');
    });

    await expect(
      publishMessageCreated({
        roomId: 'r1',
        userId: 'u1',
        messageId: 'm1',
        timestamp: '2026-01-01T00:00:00.000Z',
      })
    ).resolves.not.toThrow();
  });
});