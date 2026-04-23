const router = require('express').Router();
const { authenticateJWT } = require('../middleware/jwtMiddleware');
const ctrl = require('../controllers/messageController');

// POST /rooms/:roomId/messages, GET /rooms/:roomId/messages
router.post('/:roomId/messages', authenticateJWT, ctrl.sendMessage);
router.get('/:roomId/messages', authenticateJWT, ctrl.getMessages);

// Message-level routes (mounted at root in app.js, see note below)
// PUT /messages/:messageId, DELETE /messages/:messageId
router.put('/messages/:messageId', authenticateJWT, ctrl.editMessage);
router.delete('/messages/:messageId', authenticateJWT, ctrl.deleteMessage);

module.exports = router;