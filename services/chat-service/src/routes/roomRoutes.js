const router = require('express').Router();
const { authenticateJWT } = require('../middleware/jwtMiddleware');
const ctrl = require('../controllers/roomController');

router.post('/', authenticateJWT, ctrl.createRoom);
router.get('/', authenticateJWT, ctrl.getRooms);
router.get('/:id', authenticateJWT, ctrl.getRoom);
router.delete('/:id', authenticateJWT, ctrl.deleteRoom);

module.exports = router;