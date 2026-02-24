const express = require('express');
const { createExpense, getExpensesByGroup } = require('../controllers/expensesController');

const router = express.Router();

// Route to add an expense
router.post('/create', createExpense);

// Route to get all expenses for a specific group
router.get('/get-all/:group_id', getExpensesByGroup);

module.exports = router;
