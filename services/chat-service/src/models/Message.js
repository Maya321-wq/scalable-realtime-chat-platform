const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  userId: { type: String, required: true },
  content: { type: String, required: true, trim: true },
  editedAt: { type: Date, default: null },
}, { timestamps: true });

// Index for fast cursor-based pagination
messageSchema.index({ roomId: 1, _id: -1 });

module.exports = mongoose.model('Message', messageSchema);