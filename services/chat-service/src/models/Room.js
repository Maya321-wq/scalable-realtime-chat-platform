const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  createdBy: { type: String, required: true },  // userId from JWT
  members: [{ type: String }],                   // array of userIds
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);