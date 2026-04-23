const { sendMessage, getMessages } = require('../../src/controllers/messageController');

describe('Message Controller', () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  test('sendMessage returns 400 if content missing', async () => {
    const req = { body: {}, params: { id: 'room123' }, user: { userId: 'user1' } };
    const res = mockRes();
    await sendMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('getMessages returns structure with nextCursor', async () => {
    const req = { params: { id: 'room123' }, query: { limit: '10' } };
    const res = mockRes();
    await getMessages(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      messages: expect.any(Array),
      nextCursor: expect.anything()
    }));
  });
});