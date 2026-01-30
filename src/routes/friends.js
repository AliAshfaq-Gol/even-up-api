const express = require('express');
const router = express.Router();
const { addFriend, getFriends, removeFriend } = require('../controllers/friendsController');
const { verifyToken } = require('../middleware/auth');

router.post('/add', verifyToken, addFriend);
router.get('/', verifyToken, getFriends);
router.delete('/:friend_id', verifyToken, removeFriend);

module.exports = router;
