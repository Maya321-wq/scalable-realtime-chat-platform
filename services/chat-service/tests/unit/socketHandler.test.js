process.env.NODE_ENV = 'test';

const socketHandler = require('../../src/socket/socketHandler');

describe('socketHandler', () => {
  let mockIO;
  let mockSocket;

  beforeEach(() => {
    mockSocket = {
      join: jest.fn(),
      leave: jest.fn(),
      to: jest.fn(() => ({
        emit: jest.fn(),
      })),
      on: jest.fn(),
      handshake: {
        auth: { token: 'valid-token' },
      },
    };

    mockIO = {
      use: jest.fn((fn) => fn(mockSocket, jest.fn())),
      on: jest.fn((event, cb) => {
        if (event === 'connection') cb(mockSocket);
      }),
    };
  });

  test('initializes socket handler correctly', () => {
    expect(() => socketHandler(mockIO)).not.toThrow();
  });

  test('registers socket events', () => {
    socketHandler(mockIO);
    expect(mockIO.on).toHaveBeenCalledWith('connection', expect.any(Function));
  });
});