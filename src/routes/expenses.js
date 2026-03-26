const express = require('express');
const { createExpense, getExpensesByGroup } = require('../controllers/expensesController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Route to add an expense
router.post('/create', verifyToken, createExpense);

// Route to get all expenses for a specific group
router.get('/:group_id/get-expenses', verifyToken, getExpensesByGroup);


module.exports = router;
