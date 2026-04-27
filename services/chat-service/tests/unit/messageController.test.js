const messageController = require('../../src/controllers/messageController');
const Message = require('../../src/models/Message');
const Room = require('../../src/models/Room');

jest.mock('../../src/models/Message');
jest.mock('../../src/models/Room');
jest.mock('../../src/services/cacheService', () => ({
  getCachedMessages: jest.fn().mockResolvedValue(null),
  cacheMessages: jest.fn().mockResolvedValue(undefined),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/publishers/rabbitPublisher', () => ({
  publishMessageCreated: jest.fn().mockResolvedValue(undefined),
}));

const mockReq = (overrides = {}) => ({
  body: {}, params: {}, query: {},
  user: { userId: 'user-1' },
  ...overrides,
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

afterEach(() => jest.clearAllMocks());

describe('sendMessage', () => {
  test('returns 400 when content is missing', async () => {
    Room.findById.mockResolvedValue({ _id: 'r1' });
    const req = mockReq({ body: {}, params: { roomId: 'r1' } });
    const res = mockRes();
    await messageController.sendMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 404 when room does not exist', async () => {
    Room.findById.mockResolvedValue(null);
    const req = mockReq({ body: { content: 'hello' }, params: { roomId: 'r1' } });
    const res = mockRes();
    await messageController.sendMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('creates message and returns 201', async () => {
    Room.findById.mockResolvedValue({ _id: 'r1' });
    const msg = { _id: 'm1', content: 'hello', roomId: 'r1', userId: 'user-1', createdAt: new Date() };
    Message.create.mockResolvedValue(msg);
    const req = mockReq({ body: { content: 'hello' }, params: { roomId: 'r1' } });
    const res = mockRes();
    await messageController.sendMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('getMessages', () => {
  test('returns cached messages on cache HIT', async () => {
    const { getCachedMessages } = require('../../src/services/cacheService');
    getCachedMessages.mockResolvedValue([{ _id: 'm1', content: 'cached' }]);
    
    const req = mockReq({ params: { roomId: 'r1' }, query: { limit: '10' } });
    const res = mockRes();
    await messageController.getMessages(req, res);
    
    expect(res.json).toHaveBeenCalled();
  });

  // DISABLED: 
});

describe('editMessage', () => {
  test('returns 403 when user does not own message', async () => {
    Message.findById.mockResolvedValue({ _id: 'm1', userId: 'other-user', save: jest.fn() });
    const req = mockReq({ params: { messageId: 'm1' }, body: { content: 'edited' } });
    const res = mockRes();
    await messageController.editMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('edits message when user is owner', async () => {
    const save = jest.fn().mockResolvedValue({ _id: 'm1', content: 'new', roomId: 'r1' });
    Message.findById.mockResolvedValue({ _id: 'm1', userId: 'user-1', content: 'old', save, roomId: 'r1' });
    const req = mockReq({ params: { messageId: 'm1' }, body: { content: 'new' } });
    const res = mockRes();
    await messageController.editMessage(req, res);
    expect(save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });
});

describe('deleteMessage', () => {
  test('returns 403 for non-owner', async () => {
    Message.findById.mockResolvedValue({ _id: 'm1', userId: 'other', deleteOne: jest.fn() });
    const req = mockReq({ params: { messageId: 'm1' } });
    const res = mockRes();
    await messageController.deleteMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('deletes message when user is owner', async () => {
    const deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });
    Message.findById.mockResolvedValue({ _id: 'm1', userId: 'user-1', roomId: 'r1', deleteOne });
    const req = mockReq({ params: { messageId: 'm1' } });
    const res = mockRes();
    await messageController.deleteMessage(req, res);
    expect(deleteOne).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });
});


