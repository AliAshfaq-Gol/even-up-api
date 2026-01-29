const express = require('express');
const router = express.Router();
const { addFriend, getFriends } = require('../controllers/friendsController');
const { verifyToken } = require('../middleware/auth');

// ✅ Protect routes
router.post('/add', verifyToken, addFriend);
router.get('/', verifyToken, getFriends);

module.exports = router;
