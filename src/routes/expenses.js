const express = require('express');
const { createExpense, getExpensesByGroup, getGroupBalances } = require('../controllers/expensesController');

const router = express.Router();

// Route to add an expense
router.post('/create', createExpense);

// Route to get all expenses for a specific group
router.get('/:group_id/get-expenses', getExpensesByGroup);

router.get('/:group_id/balance-sheet', getGroupBalances);

module.exports = router;
