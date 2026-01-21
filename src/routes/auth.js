const express = require('express');
const { signup, login, updateUser } = require('../controllers/authController');

const router = express.Router();

router.post('/signup', signup);

router.post('/login', login);

router.put('/update-user/:user_id', updateUser);

module.exports = router;
