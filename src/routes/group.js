const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/auth');
const { createGroup, getUserGroups,  } = require('../controllers/groupController');

router.post('/create', verifyToken, createGroup);
router.get('/user-groups', verifyToken, getUserGroups);

module.exports = router;