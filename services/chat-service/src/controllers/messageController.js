const Message = require('../models/Message');
const Room = require('../models/Room');
const { cacheMessages, getCachedMessages, invalidateCache } = require('../services/cacheService');
const { publishMessageCreated } = require('../publishers/rabbitPublisher');

exports.sendMessage = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'content is required' });

    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const message = await Message.create({
      roomId: req.params.id,
      userId: req.user.userId,
      content,
    });

    // Invalidate cache for this room
    await invalidateCache(req.params.id);

    // Publish event to RabbitMQ (Issue #15)
    await publishMessageCreated({
      roomId: req.params.id,
      userId: req.user.userId,
      messageId: message._id.toString(),
      timestamp: message.createdAt,
    });

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { cursor, limit = 50 } = req.query;
    const roomId = req.params.id;

    // Try cache first (Issue #14)
    const cached = await getCachedMessages(roomId);
    if (cached && !cursor) {
      return res.json({ messages: cached, nextCursor: null, source: 'cache' });
    }

    const query = { roomId };
    if (cursor) query._id = { $lt: cursor };  // cursor-based: fetch older messages

    const messages = await Message.find(query)
      .sort({ _id: -1 })
      .limit(parseInt(limit) + 1);  // fetch one extra to know if there's a next page

    const hasMore = messages.length > limit;
    if (hasMore) messages.pop();

    const nextCursor = hasMore ? messages[messages.length - 1]._id : null;

    // Cache first page (no cursor = most recent messages)
    if (!cursor) await cacheMessages(roomId, messages);

    res.json({ messages, nextCursor });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.editMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.userId !== req.user.userId)
      return res.status(403).json({ error: 'You can only edit your own messages' });

    message.content = req.body.content;
    message.editedAt = new Date();
    await message.save();

    await invalidateCache(message.roomId.toString());
    res.json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.userId !== req.user.userId)
      return res.status(403).json({ error: 'You can only delete your own messages' });

    await message.deleteOne();
    await invalidateCache(message.roomId.toString());
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};