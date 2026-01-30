const express = require('express');
const router = express.Router();
const {
  createGroup,
  getUserGroups,
  getGroupById,
  addMembers,
  removeMember,
} = require('../controllers/groupsController');
const { verifyToken } = require('../middleware/auth');

router.post('/', verifyToken, createGroup);
router.get('/', verifyToken, getUserGroups);
router.get('/:group_id', verifyToken, getGroupById);
router.post('/:group_id/members', verifyToken, addMembers);
router.delete('/:group_id/members/:member_id', verifyToken, removeMember);

module.exports = router;
