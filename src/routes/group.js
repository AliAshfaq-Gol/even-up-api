const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/auth');
const { createGroup, getUserGroups, removeMemberFromGroup, addMemberToGroup,  } = require('../controllers/groupController');

router.post('/create', verifyToken, createGroup);
router.get('/user-groups', verifyToken, getUserGroups);
router.post('/add-member', verifyToken, addMemberToGroup);
router.post('/remove-member', verifyToken, removeMemberFromGroup);

module.exports = router;