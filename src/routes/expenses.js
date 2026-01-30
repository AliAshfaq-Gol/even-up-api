const express = require('express');
const {
  createExpense,
  getGroupExpenses,
  getExpenseById,
} = require('../controllers/expensesController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.post('/', verifyToken, createExpense);
router.get('/group/:group_id', verifyToken, getGroupExpenses);
router.get('/:expense_id', verifyToken, getExpenseById);

module.exports = router;
