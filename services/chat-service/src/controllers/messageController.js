const mongoose = require('mongoose');
const Message = require('../models/Message');
const Room = require('../models/Room');
const { cacheMessages, getCachedMessages, invalidateCache } = require('../services/cacheService');
const { publishMessageCreated } = require('../publishers/rabbitPublisher');

exports.sendMessage = async (req, res) => {
  try {
    const { content } = req.body;
    
    // ✅ Validation FIRST
    if (!content || content.trim().length === 0) 
      return res.status(400).json({ error: 'content is required' });
    if (content.length > 5000) 
      return res.status(400).json({ error: 'content exceeds 5000 character limit' });

    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const message = await Message.create({
      roomId: req.params.roomId,
      userId: req.user.userId,
      content,
    });

    await invalidateCache(req.params.roomId);

    await publishMessageCreated({
      roomId: req.params.roomId,
      userId: req.user.userId,
      messageId: message._id.toString(),
      timestamp: message.createdAt.toISOString(),
    });

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { cursor, limit = 50 } = req.query;
    const roomId = req.params.roomId;

    // ✅ Validate cursor format
    if (cursor && !mongoose.Types.ObjectId.isValid(cursor)) {
      return res.status(400).json({ error: 'Invalid cursor format' });
    }

    // ✅ Sanitize and clamp limit (1-100)
    const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 100);

    // Try cache first (Issue #14)
    const cached = await getCachedMessages(roomId);
    if (cached && !cursor) {
      return res.json({ messages: cached, nextCursor: null, source: 'cache' });
    }

    const query = { roomId };
    if (cursor) query._id = { $lt: cursor };

    const messages = await Message.find(query)
      .sort({ _id: -1 })
      .limit(limitNum + 1);

    const hasMore = messages.length > limitNum;
    if (hasMore) messages.pop();

    const nextCursor = hasMore ? messages[messages.length - 1]._id : null;

    if (!cursor) await cacheMessages(roomId, messages);

    res.json({ messages, nextCursor });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.editMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.userId !== req.user.userId)
      return res.status(403).json({ error: 'You can only edit your own messages' });

    const { content } = req.body;
    if (!content || content.trim().length === 0) 
      return res.status(400).json({ error: 'content is required' });
    if (content.length > 5000) 
      return res.status(400).json({ error: 'content exceeds 5000 character limit' });

    message.content = content;
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
    const message = await Message.findById(req.params.messageId);
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
