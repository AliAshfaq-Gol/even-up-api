const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { addMemberAsUser, getMyFriends } = require('../controllers/friendController');

// ✅ Protect routes
router.post('/add-member', verifyToken, addMemberAsUser);
router.get('/my-friends', verifyToken, getMyFriends);

module.exports = router;
