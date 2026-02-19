const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/auth');
const { createGroup, getGroupsByUser } = require('../controllers/groupController');

router.post('/create', verifyToken, createGroup);
router.get('/by-user/:user_id', verifyToken, getGroupsByUser);

module.exports = router;