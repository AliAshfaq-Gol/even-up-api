const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { createActivity, getUserActivities } = require('../controllers/activityController');

router.post('/add', verifyToken, createActivity);
router.get('/', verifyToken, getUserActivities);

module.exports = router;